-- 2026-11-22 (Yazan): the Sparks bar holds 120 (was 100). Run at the release that ships SPARKS_MAX = 120.

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
