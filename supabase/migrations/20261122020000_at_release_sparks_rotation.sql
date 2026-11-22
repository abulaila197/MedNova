-- 2026-11-22 (Yazan). Run at the PRODUCTION release that ships this app version, not before: older apps still have
-- a 100 bar and the old Full Rotation list, and the server would refuse what they show as reached.

-- Sparks bar holds 120 (was 100). Refill stays 1 every 10 minutes (sparks_refill_min).
alter table public.sparks_state alter column value set default 120;

create or replace function public.sparks_fill(v integer, a timestamp with time zone, t timestamp with time zone, mins integer, out value integer, out at_ timestamp with time zone)
 returns record language plpgsql immutable as $function$
declare n int;
begin
  if t <= a then value := v; at_ := a; return; end if;
  if v >= 120 then value := v; at_ := t; return; end if;
  n := floor(extract(epoch from (t - a)) / (mins * 60));
  value := least(120, v + n);
  at_ := case when value >= 120 then t else a + make_interval(secs => n * mins * 60) end;
end $function$;

create or replace function public.sparks_buy(n integer)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare uid uuid := auth.uid(); st public.sparks_state; bal int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if n is null or n not between 1 and 120 then return jsonb_build_object('ok', false, 'why', 'amount'); end if;
  perform pg_advisory_xact_lock(hashtext('sparks:' || uid::text));
  perform pg_advisory_xact_lock(hashtext('shop:' || uid::text));
  st := public.sparks_now(uid);
  if st.value + n > 120 then return public.sparks_view(uid) || jsonb_build_object('ok', false, 'why', 'full'); end if;
  bal := (public.wallet_balance(uid)->>'tokens')::int;
  if bal < n then return public.sparks_view(uid) || jsonb_build_object('ok', false, 'why', 'tokens', 'need', n - bal); end if;
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, at)
  values ('s' || replace(gen_random_uuid()::text, '-', ''), uid, 'spend', 0, -n, 'sparks', now());
  perform public.sparks_add(uid, n, 'buy');
  return public.sparks_view(uid) || jsonb_build_object('ok', true);
end $function$;

create or replace function public.sparks_sync(spends jsonb)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
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
    if c between -120 and -1 and coalesce(e->>'id', '') <> '' then
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
end $function$;

create or replace function public.push_reminders()
 returns integer language plpgsql security definer set search_path to '' as $function$
declare
  r record;
  n int := 0;
  friday boolean := extract(isodow from now()) = 5;
  wk_start timestamptz := timestamptz '2026-10-10 00:00:00+00' + floor(extract(epoch from now() - timestamptz '2026-10-10 00:00:00+00') / 604800) * interval '7 days';
begin
  for r in
    select distinct d.user_id from public.push_devices d
    join public.profiles p on p.id = d.user_id
    left join public.push_prefs pp on pp.user_id = d.user_id
    where coalesce(pp.reminders, true)
      and p.last_seen > now() - interval '30 days' and p.last_seen < now() - interval '4 hours'
      and not exists (select 1 from public.push_sent s where s.user_id = d.user_id and s.kind in ('sparks', 'daily', 'rounds') and s.at > now() - interval '20 hours')
  loop
    if friday and exists (select 1 from public.plays pl where pl.user_id = r.user_id and pl.ended_at >= wk_start) then
      perform public.push_send(array[r.user_id], 'rounds',
        'Grand Rounds closes tonight', 'This week''s Grand Rounds ends at midnight. A few more games could lift your rank.',
        'تحدّي الأسبوع بيقفل النهارده', 'تحدّي الأسبوع ده بيخلص الساعة 12 بالليل. كام لعبة كمان ممكن يطلّعوا ترتيبك.');
    elsif not exists (select 1 from public.wallet_ledger w where w.user_id = r.user_id and w.kind = 'daily' and w.at > now() - interval '20 hours') then
      perform public.push_send(array[r.user_id], 'daily',
        'Your daily reward is ready', 'Tap to collect today''s tokens and Sparks.',
        'مكافأتك اليومية جاهزة', 'دوس واستلم عملات وشرارات النهارده.');
    elsif not exists (select 1 from public.subscriptions su where su.user_id = r.user_id and su.expires_at > now())
      and (public.sparks_now(r.user_id)).value >= 120 then
      perform public.push_send(array[r.user_id], 'sparks',
        'Your Sparks bar is full', 'You have a full bar of Sparks. Time for a game?',
        'الشرارات اتملت', 'شراراتك مليانة على الآخر. نلعب لعبة؟');
    else
      continue;
    end if;
    n := n + 1;
  end loop;
  -- Keep the log small: 30 days is plenty.
  delete from public.push_sent where at < now() - interval '30 days';
  return n;
end $function$;

-- Full Rotation counts the newer games too (the app's ROTATION_GAMES).
create or replace function public.rotation_games()
 returns text[] language sql immutable set search_path to '' as $function$
  select array['case-files-unsolved','nova-crossword','the-diagnostic-pursuit','nova-medicordle',
    'the-riddler','the-silent-artist','the-streak-master','the-wheels-of-chaos','imposter',
    'tilt-and-tell','four-of-a-kind','spot-the-flaw','trace-the-treatment','who-am-i','put-in-order']
$function$;

-- Grand Rounds: Trace the Treatment, Who am I? and Put it in order get their own weeks (Yazan 2026-11-22), 15 weeks a
-- cycle; the cycle prize needs 15 stamps. Weeks 0-8 keep their slot, so the running cycle's stamps stay where they are.
create or replace function public.rounds_week(w integer)
 returns jsonb language sql immutable set search_path to '' as $function$
  select case when s < 12 then jsonb_build_object('kind', 'game', 'slot', s, 'game', (array['the-diagnostic-pursuit','nova-crossword',
      'the-riddler','nova-medicordle','the-streak-master','case-files-unsolved','the-wheels-of-chaos',
      'four-of-a-kind','spot-the-flaw','trace-the-treatment','who-am-i','put-in-order'])[s + 1])
    else jsonb_build_object('kind', 'mode', 'slot', s, 'mode', (array['online','solo','offline'])[s - 11]) end
  from (select ((w % 15) + 15) % 15 s) x
$function$;

create or replace function public.rounds_cycle_have(uid uuid)
 returns integer language sql stable security definer set search_path to '' as $function$
  select count(distinct ((substr(l.reason, 8)::int % 15) + 15) % 15)::int
  from public.wallet_ledger l
  where l.user_id = uid and l.kind = 'rounds' and l.reason ~ '^rounds:-?[0-9]+$'
    and l.at > coalesce((select max(c.at) from public.wallet_ledger c where c.user_id = uid and c.reason like 'rounds:cycle:%'), '-infinity'::timestamptz)
$function$;

create or replace function public.rounds_claim(tier integer)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
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
    if public.rounds_cycle_have(uid) >= 15 then
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
end $function$;

create or replace function public.rounds_status()
 returns jsonb language sql stable security definer set search_path to '' as $function$
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
    'cycle', jsonb_build_object('have', case when auth.uid() is null then 0 else public.rounds_cycle_have(auth.uid()) end, 'of', 15, 'prize', 3000),
    'run', case when run.n > 0 and run.n % 4 = 0 and stamped.yes then 4 else run.n % 4 end
  ) from w, used, stamped, run
$function$;
