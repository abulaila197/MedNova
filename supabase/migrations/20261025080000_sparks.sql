-- Sparks (#4, #82, #88; Yazan 2026-10-25): one bar per account replaces the free plays. Full = 100, +1 every
-- 10 min, faster with the worn character's stars (2* 10, 3* 9, 4* 8, 5* 7, 6* 5). A play costs Sparks at its first
-- answer; the phone spends offline and sparks_sync replays those spends here in time order (#60). Ads (+5, 20 a day),
-- tokens (1 token = 1 Spark) and admin gifts add Sparks here only. Subscribers have unlimited Sparks.

create table if not exists public.sparks_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  value int not null default 100,
  at timestamptz not null default now()
);
alter table public.sparks_state enable row level security;
drop policy if exists "own sparks" on public.sparks_state;
create policy "own sparks" on public.sparks_state for select to authenticated using (user_id = auth.uid());

create table if not exists public.sparks_log (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('spend', 'ad', 'buy', 'grant')),
  amount int not null,
  game text,
  unit text,
  note text,
  at timestamptz not null default now()
);
create index if not exists sparks_log_user_kind_at on public.sparks_log (user_id, kind, at);
alter table public.sparks_log enable row level security;
drop policy if exists "own sparks log" on public.sparks_log;
create policy "own sparks log" on public.sparks_log for select to authenticated using (user_id = auth.uid());

-- Minutes per Spark from the worn character's stars (mirrors STAR_BONUS in src/features/shop/robots.ts).
create or replace function public.sparks_refill_min(uid uuid) returns int
language sql stable security definer set search_path = '' as $$
  select case
    when a in ('sovereign', 'admin') then 5
    when a in ('omar', 'aurora', 'cortex', 'titan', 'zenith') then 7
    when a in ('layla', 'vex', 'bulwark', 'echo', 'nimbus', 'ember', 'linky') then 8
    when a in ('pip', 'yara', 'yazan', 'sprocket', 'kit', 'bloop', 'pixel') then 9
    else 10 end
  from (select coalesce((select avatar from public.profiles where id = uid), 'bolt') a) x;
$$;

-- The bar at time t (the same rule as refill() in src/games/engine/sparks.ts).
create or replace function public.sparks_fill(v int, a timestamptz, t timestamptz, mins int, out value int, out at_ timestamptz)
language plpgsql immutable as $$
declare n int;
begin
  if t <= a then value := v; at_ := a; return; end if;
  if v >= 100 then value := v; at_ := t; return; end if;
  n := floor(extract(epoch from (t - a)) / (mins * 60));
  value := least(100, v + n);
  at_ := case when value >= 100 then t else a + make_interval(secs => n * mins * 60) end;
end $$;

-- What the phone keeps: the stored bar (it refills on the phone), the refill speed, ads left today, unlimited.
create or replace function public.sparks_view(uid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'value', s.value, 'at', s.at, 'refill_min', public.sparks_refill_min(uid),
    'ads_left', greatest(0, 20 - (select count(*) from public.sparks_log l where l.user_id = uid and l.kind = 'ad' and l.at >= date_trunc('day', now()))),
    'unlimited', exists (select 1 from public.subscriptions b where b.user_id = uid and b.expires_at > now()))
  from public.sparks_state s where s.user_id = uid;
$$;

-- Locks the player's bar row and refills it to now. A new account starts full; its time is set back a week so
-- offline spends from before its first sync keep their own times.
create or replace function public.sparks_now(uid uuid) returns public.sparks_state
language plpgsql security definer set search_path = '' as $$
declare st public.sparks_state; f record;
begin
  insert into public.sparks_state (user_id, at) values (uid, now() - interval '7 days') on conflict (user_id) do nothing;
  select * into st from public.sparks_state where user_id = uid for update;
  select * into f from public.sparks_fill(st.value, st.at, now(), public.sparks_refill_min(uid));
  st.value := f.value; st.at := f.at_;
  return st;
end $$;

-- Replays the phone's spends in time order; each id counts once. Returns the bar and the ids it refused.
create or replace function public.sparks_sync(spends jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  st public.sparks_state;
  mins int;
  e jsonb;
  f record;
  c int;
  t timestamptz;
  refused text[] := '{}';
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('sparks:' || uid::text));
  insert into public.sparks_state (user_id, at) values (uid, now() - interval '7 days') on conflict (user_id) do nothing;
  select * into st from public.sparks_state where user_id = uid for update;
  mins := public.sparks_refill_min(uid);
  for e in select x from jsonb_array_elements(coalesce(spends, '[]'::jsonb)) x order by x->>'at' loop
    if exists (select 1 from public.sparks_log where id = e->>'id') then continue; end if;
    c := (e->>'cost')::int;
    if c is null or c not between 1 and 60 or coalesce(e->>'id', '') = '' then
      refused := refused || coalesce(e->>'id', '');
      continue;
    end if;
    t := least(now(), greatest(st.at, now() - interval '7 days', coalesce((e->>'at')::timestamptz, now())));
    select * into f from public.sparks_fill(st.value, st.at, t, mins);
    st.value := greatest(0, f.value - c);
    st.at := f.at_;
    insert into public.sparks_log (id, user_id, kind, amount, game, unit, at)
    values (e->>'id', uid, 'spend', -c, left(e->>'game', 40), left(e->>'unit', 80), t);
  end loop;
  update public.sparks_state set value = st.value, at = st.at where user_id = uid;
  return public.sparks_view(uid) || jsonb_build_object('refused', to_jsonb(refused));
end $$;

-- Adds Sparks to a locked, refilled bar (above full they wait; refill starts again below 100).
create or replace function public.sparks_add(uid uuid, n int, kind text, note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare st public.sparks_state;
begin
  perform pg_advisory_xact_lock(hashtext('sparks:' || uid::text));
  st := public.sparks_now(uid);
  update public.sparks_state set value = st.value + n, at = st.at where user_id = uid;
  insert into public.sparks_log (id, user_id, kind, amount, note)
  values ('k' || replace(gen_random_uuid()::text, '-', ''), uid, kind, n, left(note, 200));
end $$;

-- Watch an ad: +5 Sparks, 20 a day (until ads are live the app shows no ad, TR5).
create or replace function public.sparks_ad() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('sparks:' || uid::text));
  select count(*) into n from public.sparks_log where user_id = uid and kind = 'ad' and at >= date_trunc('day', now());
  if n >= 20 then return public.sparks_view(uid) || jsonb_build_object('ok', false, 'why', 'cap'); end if;
  perform public.sparks_add(uid, 5, 'ad');
  return public.sparks_view(uid) || jsonb_build_object('ok', true);
end $$;

-- Refill with tokens: 1 token = 1 Spark, at most up to a full bar.
create or replace function public.sparks_buy(n int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); st public.sparks_state; bal int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if n is null or n not between 1 and 100 then return jsonb_build_object('ok', false, 'why', 'amount'); end if;
  perform pg_advisory_xact_lock(hashtext('sparks:' || uid::text));
  perform pg_advisory_xact_lock(hashtext('shop:' || uid::text));
  st := public.sparks_now(uid);
  if st.value + n > 100 then return public.sparks_view(uid) || jsonb_build_object('ok', false, 'why', 'full'); end if;
  bal := (public.wallet_balance(uid)->>'tokens')::int;
  if bal < n then return public.sparks_view(uid) || jsonb_build_object('ok', false, 'why', 'tokens', 'need', n - bal); end if;
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, at)
  values ('s' || replace(gen_random_uuid()::text, '-', ''), uid, 'spend', 0, -n, 'sparks', now());
  perform public.sparks_add(uid, n, 'buy');
  return public.sparks_view(uid) || jsonb_build_object('ok', true);
end $$;

-- Admin (#4): Sparks to one account, and tokens and/or Sparks to every account.
create or replace function public.admin_grant_sparks(target uuid, amount int, note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if amount is null or amount not between 1 and 1000 then raise exception 'amount'; end if;
  if not exists (select 1 from public.profiles where id = target) then raise exception 'no player'; end if;
  perform public.sparks_add(target, amount, 'grant', 'admin:' || auth.uid()::text || ' ' || coalesce(note, ''));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_grant_all(tokens int, sparks int, note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p record; n int := 0;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if coalesce(tokens, 0) not between 0 and 500 or coalesce(sparks, 0) not between 0 and 500 or coalesce(tokens, 0) + coalesce(sparks, 0) = 0 then
    raise exception 'amount';
  end if;
  for p in select id from public.profiles loop
    if coalesce(tokens, 0) > 0 then
      insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, note, at)
      values ('g' || replace(gen_random_uuid()::text, '-', ''), p.id, 'grant', 0, tokens, 'admin:' || auth.uid()::text, left(coalesce(note, ''), 200), now());
    end if;
    if coalesce(sparks, 0) > 0 then perform public.sparks_add(p.id, sparks, 'grant', 'all ' || coalesce(note, '')); end if;
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'players', n);
end $$;

revoke all on function public.sparks_refill_min(uuid), public.sparks_fill(int, timestamptz, timestamptz, int), public.sparks_view(uuid),
  public.sparks_now(uuid), public.sparks_add(uuid, int, text, text), public.sparks_sync(jsonb), public.sparks_ad(), public.sparks_buy(int),
  public.admin_grant_sparks(uuid, int, text), public.admin_grant_all(int, int, text) from public, anon, authenticated;
grant execute on function public.sparks_sync(jsonb), public.sparks_ad(), public.sparks_buy(int),
  public.admin_grant_sparks(uuid, int, text), public.admin_grant_all(int, int, text) to authenticated;
