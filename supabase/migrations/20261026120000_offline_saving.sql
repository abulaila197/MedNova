-- Offline saving (#57-#60, Yazan 2026-10-26). One rule: the server is the truth for what is earned and spent; the
-- phone shows its last copy plus changes waiting to go up, and sends them first when it is back online.
--   1. Wear changes made offline carry the time they were made; for each slot (frame, title, win effect, character)
--      the newest change wins, whichever phone sends it last.
--   2. A second chance (Streak, Riddler) bought offline is a phone wallet row 'second:<ref>'; wallet_sync checks its
--      price (5, 10, 20), the 3-a-run cap and the balance, as token_spend does online.
--   3. Sparks refilled with tokens offline: the phone sends a wallet row 'sparks:<id>' (checked against the balance)
--      and a Sparks entry with a negative cost and that id; sparks_sync adds the Sparks only if the tokens were taken.

-- 1. Newest wear change wins --------------------------------------------------------------------------------------

alter table public.style_worn add column if not exists slot_at jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists avatar_at timestamptz;

drop function if exists public.style_wear(text, text, text, boolean);
create or replace function public.style_wear(frame text default null, title text default null, effect text default null,
                                             clear_effect boolean default false, at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  own text[] := public.style_owned_all(auth.uid());
  t timestamptz := least(now(), coalesce(style_wear.at, now()));
  w public.style_worn;
  newer text[] := '{}';
  stale boolean;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if (frame is not null and not ('frame:' || frame) = any (own)) or (title is not null and not ('title:' || title) = any (own))
     or (effect is not null and not ('effect:' || effect) = any (own)) then
    return jsonb_build_object('ok', false, 'why', 'not owned');
  end if;
  insert into public.style_worn (user_id) values (uid) on conflict (user_id) do nothing;
  select * into w from public.style_worn s where s.user_id = uid for update;
  -- A slot changed later (on another phone) than this change keeps its value.
  stale := frame is not null and (w.slot_at->>'frame')::timestamptz > t;
  if stale then newer := newer || 'frame'::text; elsif frame is not null then
    w.frame := frame; w.slot_at := w.slot_at || jsonb_build_object('frame', t);
  end if;
  stale := title is not null and (w.slot_at->>'title')::timestamptz > t;
  if stale then newer := newer || 'title'::text; elsif title is not null then
    w.title := title; w.slot_at := w.slot_at || jsonb_build_object('title', t);
  end if;
  stale := (effect is not null or clear_effect) and (w.slot_at->>'effect')::timestamptz > t;
  if stale then newer := newer || 'effect'::text; elsif effect is not null or clear_effect then
    w.effect := case when clear_effect then null else effect end; w.slot_at := w.slot_at || jsonb_build_object('effect', t);
  end if;
  update public.style_worn s set frame = w.frame, title = w.title, effect = w.effect, slot_at = w.slot_at, updated_at = now()
  where s.user_id = uid;
  return jsonb_build_object('ok', true, 'newer', to_jsonb(newer));
end $$;
revoke all on function public.style_wear(text, text, text, boolean, timestamptz) from public, anon;
grant execute on function public.style_wear(text, text, text, boolean, timestamptz) to authenticated, service_role;

drop function if exists public.set_avatar(text);
create or replace function public.set_avatar(slug text, at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t timestamptz := least(now(), coalesce(set_avatar.at, now())); was timestamptz;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if slug not in ('yazan', 'yara', 'omar', 'layla', 'atlas', 'nova', 'bolt', 'iris', 'pip', 'sprocket', 'kit', 'vex', 'bulwark', 'echo', 'aurora', 'cortex', 'titan',
                  'bloop', 'pixel', 'nimbus', 'ember', 'zenith', 'linky', 'sovereign', 'admin') then
    return jsonb_build_object('ok', false, 'why', 'unknown');
  end if;
  if not public.avatar_open(uid, slug) then return jsonb_build_object('ok', false, 'why', 'not owned'); end if;
  select p.avatar_at into was from public.profiles p where p.id = uid for update;
  -- Changed later on another phone: that character stays.
  if was is not null and was > t then return jsonb_build_object('ok', true, 'newer', true); end if;
  update public.profiles set avatar = slug, avatar_at = t, updated_at = now() where id = uid;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.set_avatar(text, timestamptz) from public, anon;
grant execute on function public.set_avatar(text, timestamptz) to authenticated, service_role;

-- 2 + 3. Second chances and Sparks refills bought offline --------------------------------------------------------

create or replace function public.wallet_sync(entries jsonb) returns jsonb
language plpgsql security definer set search_path = 'public' as $$
declare
  uid uuid := auth.uid();
  e jsonb;
  p public.plays;
  sp public.wallet_ledger;
  refused text[] := '{}';
  ok boolean;
  at_ timestamptz;
  ref text;
  n int;
  cost int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('wallet:' || uid::text));
  -- Same lock as token_spend / sparks_buy, so an offline second chance and an online one can't both take the same slot.
  perform pg_advisory_xact_lock(hashtext('shop:' || uid::text));
  for e in select * from jsonb_array_elements(coalesce(entries, '[]'::jsonb)) order by (value->>'at') loop
    ok := false;
    if exists (select 1 from public.wallet_ledger where id = e->>'id') then
      continue;
    end if;
    at_ := least(now(), greatest(now() - interval '7 days', coalesce((e->>'at')::timestamptz, now())));
    if e->>'kind' = 'exp' then
      select * into p from public.plays where id = e->>'play_id' and user_id = uid and status = 'finished';
      ok := found
        and (e->>'exp')::int between 0 and public.wallet_exp_cap(p.game, p.mode, p.settings)
        and (e->>'exp')::int <= p.exp_earned
        and coalesce((e->>'tokens')::int, 0) = 0
        and not exists (select 1 from public.wallet_ledger where user_id = uid and kind = 'exp' and play_id = p.id)
        and (select count(*) from public.wallet_ledger w where w.user_id = uid and w.kind = 'exp'
               and w.at >= date_trunc('day', at_) and w.at < date_trunc('day', at_) + interval '1 day') < 60;
    elsif e->>'kind' = 'spend' and coalesce(e->>'reason', '') like 'second:%' then
      -- A second chance bought offline: the next price in 5 / 10 / 20, at most 3 a run, none after a refunded one.
      ref := substr(e->>'reason', 8);
      select count(*) into n from public.wallet_ledger where user_id = uid and kind = 'spend' and reason = 'second:' || ref;
      cost := (array[5, 10, 20])[n + 1];
      ok := coalesce(ref, '') <> '' and n < 3 and e->>'id' not like 's%'
        and (e->>'tokens')::int = -cost and coalesce((e->>'exp')::int, 0) = 0
        and not exists (select 1 from public.wallet_ledger s join public.wallet_ledger f
                          on f.user_id = uid and f.kind = 'refund' and f.reason = s.id
                        where s.user_id = uid and s.kind = 'spend' and s.reason = 'second:' || ref)
        and (public.wallet_balance(uid)->>'tokens')::int >= cost;
    elsif e->>'kind' = 'spend' and coalesce(e->>'reason', '') like 'sparks:%' then
      -- Sparks refilled offline, 1 token each (sparks_sync adds the Sparks once this row is in).
      ok := (e->>'tokens')::int between -100 and -1 and coalesce((e->>'exp')::int, 0) = 0 and e->>'id' not like 's%'
        and (public.wallet_balance(uid)->>'tokens')::int >= -(e->>'tokens')::int;
    elsif e->>'kind' = 'spend' then
      ok := (e->>'tokens')::int between -10 and -1 and coalesce((e->>'exp')::int, 0) = 0
        and e->>'id' not like 's%';
    elsif e->>'kind' = 'refund' then
      select * into sp from public.wallet_ledger where id = e->>'reason' and user_id = uid and kind = 'spend';
      ok := found and (e->>'tokens')::int = -sp.tokens
        -- Only phone spends can be undone; server purchases (style_buy, token_spend) are final. A phone second
        -- chance (up to 20) can be given back when the round ended while it was being bought.
        and sp.id not like 's%' and sp.reason not like 'sparks:%'
        and sp.tokens between case when sp.reason like 'second:%' then -20 else -10 end and -1
        and not exists (select 1 from public.wallet_ledger where user_id = uid and kind = 'refund' and reason = sp.id);
    end if;
    if ok then
      insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, play_id, at)
      values (e->>'id', uid, e->>'kind', coalesce((e->>'exp')::int, 0), coalesce((e->>'tokens')::int, 0),
              coalesce(e->>'reason', ''), e->>'play_id', at_);
    else
      refused := refused || (e->>'id');
    end if;
  end loop;
  return jsonb_build_object('refused', to_jsonb(refused));
end $$;

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
  unlimited boolean;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('sparks:' || uid::text));
  insert into public.sparks_state (user_id, at) values (uid, now() - interval '7 days') on conflict (user_id) do nothing;
  select * into st from public.sparks_state where user_id = uid for update;
  mins := public.sparks_refill_min(uid);
  unlimited := exists (select 1 from public.subscriptions b where b.user_id = uid and b.expires_at > now());
  for e in select x from jsonb_array_elements(coalesce(spends, '[]'::jsonb)) x order by x->>'at' loop
    if exists (select 1 from public.sparks_log where id = e->>'id') then continue; end if;
    c := (e->>'cost')::int;
    t := least(now(), greatest(st.at, now() - interval '7 days', coalesce((e->>'at')::timestamptz, now())));
    if c between -100 and -1 and coalesce(e->>'id', '') <> '' then
      -- An offline refill: only when its tokens were taken (wallet_sync runs first, row reason 'sparks:<id>').
      if not exists (select 1 from public.wallet_ledger w where w.user_id = uid and w.kind = 'spend'
                     and w.reason = 'sparks:' || (e->>'id') and w.tokens = c) then
        refused := refused || (e->>'id');
        continue;
      end if;
      select * into f from public.sparks_fill(st.value, st.at, t, mins);
      st.value := f.value - c;
      st.at := f.at_;
      insert into public.sparks_log (id, user_id, kind, amount, game, unit, at)
      values (e->>'id', uid, 'buy', -c, null, left(e->>'unit', 80), t);
      continue;
    end if;
    if c is null or c not between 1 and 60 or coalesce(e->>'id', '') = '' then
      refused := refused || coalesce(e->>'id', '');
      continue;
    end if;
    if not unlimited then
      select * into f from public.sparks_fill(st.value, st.at, t, mins);
      st.value := greatest(0, f.value - c);
      st.at := f.at_;
    end if;
    insert into public.sparks_log (id, user_id, kind, amount, game, unit, at)
    values (e->>'id', uid, 'spend', -c, left(e->>'game', 40), left(e->>'unit', 80), t);
  end loop;
  update public.sparks_state set value = st.value, at = st.at where user_id = uid;
  return public.sparks_view(uid) || jsonb_build_object('refused', to_jsonb(refused));
end $$;
