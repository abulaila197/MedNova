-- Daily missions (Yazan 2026-10-26): Warm-up, Full Shift, Overtime, still one after the other, now paying tokens
-- (10 / 30 / 50) instead of chests. Games must be different games within a mission, and only plays that spent Sparks
-- count. Chests now come only from Grand Rounds; the Epic chest is for 4 Grand Rounds weeks in a row.

-- Wooden: no Epic; golden: no Legendary (the dropped share goes to the next rarity down).
create or replace function public.chest_odds(kind text) returns jsonb
language sql immutable set search_path = '' as $$
  select case kind
    when 'wooden' then '{"common":70,"uncommon":24,"rare":6}'::jsonb
    when 'golden' then '{"common":50,"uncommon":30,"rare":14,"epic":6}'::jsonb
    when 'diamond' then '{"common":30,"uncommon":32,"rare":22,"epic":12,"legendary":4}'::jsonb
    when 'epic' then '{"rare":40,"epic":35,"legendary":25}'::jsonb
  end
$$;

-- When the n-th different game after `since` was first finished (games[i] finished at ts[i]).
create or replace function public.mission_nth(games text[], ts timestamptz[], since timestamptz, n integer) returns timestamptz
language sql immutable set search_path = '' as $$
  select f from (select min(x.t) f from unnest(games, ts) x(g, t) where x.t > since group by x.g) y order by f offset n - 1 limit 1
$$;

-- Different games finished after `since`, up to `cap`.
create or replace function public.mission_count(games text[], ts timestamptz[], since timestamptz, cap integer) returns integer
language sql immutable set search_path = '' as $$
  select least(cap, count(distinct x.g)::int) from unnest(games, ts) x(g, t) where x.t > since
$$;

create or replace function public.challenges_status(tz_min integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  off interval; dday date; start timestamptz; far timestamptz := timestamptz '1970-01-01';
  gm text[]; g timestamptz[]; a timestamptz[]; sh timestamptz[]; rv timestamptz[];
  t1 timestamptz; t2 timestamptz; t3 timestamptz; step int;
  prizes int[] := array[10, 30, 50]; names text[] := array['Warm-up', 'Full Shift', 'Overtime']; paid int := 0; i int;
begin
  if tz_min is null or tz_min not between -840 and 840 then raise exception 'tz'; end if;
  off := make_interval(mins => tz_min);
  dday := (now() + off)::date;
  start := (dday::timestamp - off) at time zone 'UTC';
  if uid is null then
    return jsonb_build_object('signed_in', false, 'day', dday, 'step', 1,
      'resets', (extract(epoch from start + interval '1 day') * 1000)::bigint,
      'chests', jsonb_build_object('wooden', 0, 'golden', 0, 'diamond', 0, 'epic', 0),
      'names', to_jsonb(names), 'prizes', to_jsonb(prizes),
      'tasks', jsonb_build_array(
        jsonb_build_array(jsonb_build_object('k', 'games', 'n', 0, 'of', 3)),
        jsonb_build_array(jsonb_build_object('k', 'games', 'n', 0, 'of', 5), jsonb_build_object('k', 'ads', 'n', 0, 'of', 5)),
        jsonb_build_array(jsonb_build_object('k', 'games', 'n', 0, 'of', 7), jsonb_build_object('k', 'shares', 'n', 0, 'of', 5), jsonb_build_object('k', 'review', 'n', 0, 'of', 1))));
  end if;
  perform pg_advisory_xact_lock(hashtext('chest:' || uid::text));

  -- Finished plays of today that spent Sparks (free plays and your own cases spend none).
  select coalesce(array_agg(p.game order by p.ended_at), '{}'), coalesce(array_agg(p.ended_at order by p.ended_at), '{}') into gm, g
    from public.plays p
    where p.user_id = uid and p.status = 'finished' and p.ended_at >= start and not coalesce(p.settings ? 'custom', false)
      and exists (select 1 from public.sparks_log l where l.user_id = uid and l.kind = 'spend' and split_part(l.unit, ':', 1) = p.id);
  select coalesce(array_agg(v.at), '{}') into a from public.ad_views v where v.user_id = uid and v.at >= start;
  select coalesce(array_agg(e.at), '{}') into sh from public.challenge_events e where e.user_id = uid and e.kind = 'share' and e.at >= start;
  select coalesce(array_agg(e.at), '{}') into rv from public.challenge_events e where e.user_id = uid and e.kind = 'review' and e.at >= start;

  t1 := public.mission_nth(gm, g, far, 3);
  if t1 is not null then
    if public.mission_nth(gm, g, t1, 5) is not null and public.challenge_nth(a, t1, 5) is not null then
      t2 := greatest(public.mission_nth(gm, g, t1, 5), public.challenge_nth(a, t1, 5));
    end if;
  end if;
  if t2 is not null then
    if public.mission_nth(gm, g, t2, 7) is not null and public.challenge_nth(sh, t2, 5) is not null and public.challenge_nth(rv, t2, 1) is not null then
      t3 := greatest(public.mission_nth(gm, g, t2, 7), public.challenge_nth(sh, t2, 5), public.challenge_nth(rv, t2, 1));
    end if;
  end if;
  step := case when t3 is not null then 4 when t2 is not null then 3 when t1 is not null then 2 else 1 end;

  -- Pay each finished mission once a day.
  for i in 1..3 loop
    exit when step <= i;
    if not exists (select 1 from public.wallet_ledger w where w.user_id = uid and w.reason = 'mission:' || dday || ':' || i) then
      perform public.pay_free(uid, 'chest', prizes[i], 'mission:' || dday || ':' || i, 'Daily mission: ' || names[i]);
      paid := paid + prizes[i];
    end if;
  end loop;

  return jsonb_build_object('signed_in', true, 'day', dday, 'step', step, 'paid', paid,
    'resets', (extract(epoch from start + interval '1 day') * 1000)::bigint,
    'chests', public.chests_owned(uid),
    'names', to_jsonb(names), 'prizes', to_jsonb(prizes),
    'tasks', jsonb_build_array(
      jsonb_build_array(jsonb_build_object('k', 'games', 'n', public.mission_count(gm, g, far, 3), 'of', 3)),
      jsonb_build_array(
        jsonb_build_object('k', 'games', 'n', case when t1 is null then 0 else public.mission_count(gm, g, t1, 5) end, 'of', 5),
        jsonb_build_object('k', 'ads', 'n', case when t1 is null then 0 else public.challenge_count(a, t1, 5) end, 'of', 5)),
      jsonb_build_array(
        jsonb_build_object('k', 'games', 'n', case when t2 is null then 0 else public.mission_count(gm, g, t2, 7) end, 'of', 7),
        jsonb_build_object('k', 'shares', 'n', case when t2 is null then 0 else public.challenge_count(sh, t2, 5) end, 'of', 5),
        jsonb_build_object('k', 'review', 'n', case when t2 is null then 0 else public.challenge_count(rv, t2, 1) end, 'of', 1))));
end $$;

-- Weeks in a row with the Grand Rounds stamp, ending at week w.
create or replace function public.rounds_run(uid uuid, w integer) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare n int := 0;
begin
  while exists (select 1 from public.wallet_ledger l where l.user_id = uid and l.kind = 'rounds' and l.reason = 'rounds:' || (w - n)) loop
    n := n + 1;
    exit when n >= 400;
  end loop;
  return n;
end $$;
revoke all on function public.rounds_run(uuid, integer) from public, anon, authenticated;

-- rounds_claim as before (20261025120000), plus the Epic chest every 4 stamped weeks in a row.
create or replace function public.rounds_claim(tier integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); w int := public.week_index(); m jsonb := public.rounds_missions()->(tier - 1); d date; prize int := 0; n int; epic boolean := false;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if m is null then return jsonb_build_object('ok', false, 'why', 'tier'); end if;
  perform pg_advisory_xact_lock(hashtext('rounds:' || uid::text));
  d := date '2026-10-10' + w * 7;
  if exists (select 1 from public.chest_earned where user_id = uid and src = 'rounds' and day = d and kind = m->>'chest') then
    return jsonb_build_object('ok', false, 'why', 'done');
  end if;
  if public.rounds_used(uid, w) < (m->>'of')::int then return jsonb_build_object('ok', false, 'why', 'not yet'); end if;
  insert into public.chest_earned (user_id, day, kind, src) values (uid, d, m->>'chest', 'rounds');
  if tier = 3 then
    insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, at)
    values ('r' || replace(gen_random_uuid()::text, '-', ''), uid, 'rounds', 0, 0, 'rounds:' || w, now());
    if public.rounds_cycle_have(uid) >= 16 then
      select count(*) + 1 into n from public.wallet_ledger where user_id = uid and reason like 'rounds:cycle:%';
      perform public.pay_free(uid, 'chest', 3000, 'rounds:cycle:' || n, 'Grand Rounds: every week stamped');
      prize := 3000;
    end if;
    if public.rounds_run(uid, w) % 4 = 0 then
      insert into public.chest_earned (user_id, day, kind, src) values (uid, d, 'epic', 'rounds') on conflict do nothing;
      epic := true;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'chest', m->>'chest', 'stamp', tier = 3, 'prize', prize, 'epic', epic);
end $$;

-- rounds_status as before, plus `run`: stamped weeks in a row toward the next Epic chest (0-4).
create or replace function public.rounds_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  with w as (select public.week_index() i),
  used as (select case when auth.uid() is null then 0 else public.rounds_used(auth.uid(), w.i) end n from w),
  stamped as (select exists (select 1 from public.wallet_ledger l where l.user_id = auth.uid() and l.kind = 'rounds' and l.reason = 'rounds:' || w.i) yes from w),
  run as (select case when auth.uid() is null then 0
      when stamped.yes then (select r from (select public.rounds_run(auth.uid(), w.i) r) x)
      else public.rounds_run(auth.uid(), w.i - 1) end n from w, stamped)
  select jsonb_build_object(
    'week', w.i,
    'this', public.rounds_week(w.i),
    'next', public.rounds_week(w.i + 1),
    'ends', (extract(epoch from (timestamptz '2026-10-10 00:00:00+00' + (w.i + 1) * interval '7 days')) * 1000)::bigint,
    'used', used.n,
    'missions', (select jsonb_agg(m || jsonb_build_object('claimed', exists (select 1 from public.chest_earned e
        where e.user_id = auth.uid() and e.src = 'rounds' and e.kind = m->>'chest'
          and e.day = (date '2026-10-10' + w.i * 7))) order by o)
      from jsonb_array_elements(public.rounds_missions()) with ordinality x(m, o)),
    'claimed', stamped.yes,
    'stamps', coalesce((select jsonb_agg((substr(l.reason, 8))::int order by l.at) from public.wallet_ledger l
      where l.user_id = auth.uid() and l.kind = 'rounds' and l.reason ~ '^rounds:-?[0-9]+$'), '[]'::jsonb),
    'cycle', jsonb_build_object('have', case when auth.uid() is null then 0 else public.rounds_cycle_have(auth.uid()) end, 'of', 16, 'prize', 3000),
    'run', case when run.n > 0 and run.n % 4 = 0 and stamped.yes then 4 else run.n % 4 end
  ) from w, used, stamped, run
$$;
