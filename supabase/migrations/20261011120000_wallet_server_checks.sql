-- Session 3 stage 1: the server checks the wallet (EC1, LV4, LV5, AD1, OW1).
-- The phone no longer writes wallet rows itself: wallet_sync checks each row and keeps only valid ones.

alter table public.wallet_ledger drop constraint if exists wallet_ledger_kind_check;
alter table public.wallet_ledger add constraint wallet_ledger_kind_check
  check (kind = any (array['exp','spend','refund','convert','grant']));
alter table public.wallet_ledger add column if not exists note text;

alter policy "wallet: add own" on public.wallet_ledger with check (false);

-- Admins by sign-in email (works before and after the account exists). No client policies: only the functions read it.
create table if not exists public.admin_emails (email text primary key);
alter table public.admin_emails enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from public.admin_emails a join auth.users u on lower(u.email) = lower(a.email) where u.id = auth.uid());
$$;

-- Most EXP one play can pay, per game and mode (mirrors each game's expCap in the app).
create or replace function public.wallet_exp_cap(game text, mode text, settings jsonb) returns integer
language sql immutable as $$
  select case
    when mode = 'offline' then 0
    when game = 'case-files-unsolved' then 60
    when game = 'the-conqueror' then case when mode = 'online' then 400 else 0 end
    when game = 'nova-crossword' then case when mode = 'online' then 12 else 31 * 12 end
    when game = 'the-diagnostic-pursuit' then 12 * least(10, greatest(1, coalesce((settings->>'cases')::int, 5)))
    when game = 'nova-medicordle' then case
      when mode = 'online' then 12 * least(10, greatest(1, coalesce((settings->>'words')::int, 5)))
      when settings->>'word' = 'daily' then 24
      when settings->>'word' = 'endless' then 1800
      else 0 end
    when game = 'the-riddler' then case when mode = 'online' then 12 * least(10, greatest(1, coalesce((settings->>'photos')::int, 5))) else 86 * 12 end
    when game = 'the-silent-artist' then 0
    when game = 'the-streak-master' then 60
    when game = 'trust-me-not' then 250
    when game = 'the-wheels-of-chaos' then (least(100, greatest(50, coalesce((settings->>'target')::int, 50))) + case when mode = 'online' then 38 else 9 end) / 2
    else 0 end;
$$;

-- Level tokens (LV1, LV5): 1 per level up, plus 3 on every 5th level. Level climb LV2 + LV4.
create or replace function public.wallet_level(total_exp bigint) returns integer
language plpgsql immutable as $$
declare lvl int := 1; left_exp bigint := greatest(0, total_exp); step int;
begin
  loop
    step := case when lvl + 1 <= 10 then 60 + 20 * (lvl + 1 - 2) else floor(220 * power(1.06::float8, lvl + 1 - 10) + 0.5)::int end;
    exit when left_exp < step;
    left_exp := left_exp - step;
    lvl := lvl + 1;
  end loop;
  return lvl;
end $$;

create or replace function public.wallet_level_tokens(lvl int) returns integer
language sql immutable as $$ select (lvl - 1) + 3 * (lvl / 5) $$;

-- The account's balance as the server sees it. Tokens may go below 0 after offline overspending (OW1).
create or replace function public.wallet_balance(uid uuid default auth.uid()) returns jsonb
language sql stable security definer set search_path = public as $$
  with s as (
    select coalesce(sum(exp) filter (where kind = 'exp'), 0) exp,
           coalesce(sum(tokens) filter (where kind in ('spend','refund','grant')), 0) other
    from public.wallet_ledger where user_id = uid
  )
  select jsonb_build_object('exp', exp, 'level', public.wallet_level(exp), 'tokens', public.wallet_level_tokens(public.wallet_level(exp)) + other)
  from s where uid = auth.uid() or public.is_admin();
$$;

-- Uploads the phone's new wallet rows. Each is checked; returns the ids it refused so the phone drops them.
create or replace function public.wallet_sync(entries jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  e jsonb;
  p public.plays;
  sp public.wallet_ledger;
  refused text[] := '{}';
  ok boolean;
begin
  if uid is null then raise exception 'not signed in'; end if;
  for e in select * from jsonb_array_elements(coalesce(entries, '[]'::jsonb)) loop
    ok := false;
    if exists (select 1 from public.wallet_ledger where id = e->>'id') then
      continue; -- already here (sent twice)
    end if;
    if e->>'kind' = 'exp' then
      select * into p from public.plays where id = e->>'play_id' and user_id = uid and status = 'finished';
      ok := found
        and (e->>'exp')::int between 0 and public.wallet_exp_cap(p.game, p.mode, p.settings)
        and (e->>'exp')::int <= p.exp_earned
        and coalesce((e->>'tokens')::int, 0) = 0
        and not exists (select 1 from public.wallet_ledger where user_id = uid and kind = 'exp' and play_id = p.id);
    elsif e->>'kind' = 'spend' then
      ok := (e->>'tokens')::int between -10 and -1 and coalesce((e->>'exp')::int, 0) = 0;
    elsif e->>'kind' = 'refund' then
      select * into sp from public.wallet_ledger where id = e->>'reason' and user_id = uid and kind = 'spend';
      ok := found and (e->>'tokens')::int = -sp.tokens
        and not exists (select 1 from public.wallet_ledger where user_id = uid and kind = 'refund' and reason = sp.id);
    end if;
    if ok then
      insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, play_id, at)
      values (e->>'id', uid, e->>'kind', coalesce((e->>'exp')::int, 0), coalesce((e->>'tokens')::int, 0),
              coalesce(e->>'reason', ''), e->>'play_id', least(now(), coalesce((e->>'at')::timestamptz, now())));
    else
      refused := refused || (e->>'id');
    end if;
  end loop;
  return jsonb_build_object('refused', to_jsonb(refused));
end $$;

-- Admin (AD1): find players and give them tokens; every grant is a logged ledger row.
create or replace function public.admin_find_players(q text) returns table (id uuid, username text, display_name text, tokens int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query
    select pr.id, pr.username::text, pr.display_name, (public.wallet_balance(pr.id)->>'tokens')::int
    from public.profiles pr
    where pr.username ilike replace(replace(coalesce(q, ''), '%', ''), '_', '\_') || '%'
    order by pr.username limit 20;
end $$;

create or replace function public.admin_grant_tokens(target uuid, amount int, note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare rid text := 'g' || replace(gen_random_uuid()::text, '-', '');
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if amount = 0 or amount not between -1000 and 5000 then raise exception 'amount'; end if;
  if not exists (select 1 from public.profiles where id = target) then raise exception 'no player'; end if;
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, note, at)
  values (rid, target, 'grant', 0, amount, 'admin:' || auth.uid()::text, left(coalesce(note, ''), 200), now());
  return public.wallet_balance(target);
end $$;

revoke all on function public.wallet_sync(jsonb), public.wallet_balance(uuid), public.admin_find_players(text),
  public.admin_grant_tokens(uuid, int, text), public.is_admin() from public, anon;
grant execute on function public.wallet_sync(jsonb), public.wallet_balance(uuid), public.admin_find_players(text),
  public.admin_grant_tokens(uuid, int, text), public.is_admin() to authenticated;
insert into public.admin_emails (email) values ('abulaila197@gmail.com') on conflict do nothing;
