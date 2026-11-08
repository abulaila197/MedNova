-- Grand Rounds missions (#27, #86; Yazan 2026-10-25). A 16-week cycle: the 13 games (Trust Me Not removed; The Quiz
-- Parade, The Imposter, Code Clinic and Nova Password added), then an Online, a Solo and a Pass the phone week.
-- Each week has 3 missions counted in Sparks used that week on the week's game (any sub mode) or, in a mode week, on
-- any game in that mode: 200 Sparks = wooden chest, 400 = golden chest, 1000 = diamond chest and the week's stamp
-- (running totals). A stamp from every one of the 16 weeks pays 3000 tokens once, then the count starts again.
-- The booster is removed. Subscribers' plays are logged at their price too (their bar is not touched), so they count.

-- Grand Rounds chests sit beside the daily ones (one of each kind a day per source).
alter table public.chest_earned add column if not exists src text not null default 'daily';
alter table public.chest_earned drop constraint if exists chest_earned_pkey;
alter table public.chest_earned add primary key (user_id, day, kind, src);

create or replace function public.rounds_week(w integer)
 returns jsonb
 language sql
 immutable
 set search_path to ''
as $function$
  select case when s < 13 then jsonb_build_object('kind', 'game', 'slot', s, 'game', (array['the-diagnostic-pursuit','the-silent-artist','the-quiz-parade',
      'the-wheels-of-chaos','the-riddler','the-conqueror','case-files-unsolved','nova-medicordle','the-streak-master','nova-crossword',
      'imposter','code-clinic','nova-password'])[s + 1])
    else jsonb_build_object('kind', 'mode', 'slot', s, 'mode', (array['online','solo','offline'])[s - 12]) end
  from (select ((w % 16) + 16) % 16 s) x
$function$;

-- Mission targets (running totals of Sparks used) and their chests.
create or replace function public.rounds_missions()
 returns jsonb
 language sql
 immutable
 set search_path to ''
as $function$
  select '[{"of":200,"chest":"wooden"},{"of":400,"chest":"golden"},{"of":1000,"chest":"diamond"}]'::jsonb
$function$;

-- Sparks used in week w on that week's game (or mode).
create or replace function public.rounds_used(uid uuid, w integer)
 returns integer
 language sql
 stable security definer
 set search_path to ''
as $function$
  with wk as (select public.rounds_week(w) j)
  select coalesce(sum(-l.amount), 0)::int
  from public.sparks_log l, wk
  where l.user_id = uid and l.kind = 'spend'
    and l.at >= timestamptz '2026-10-10 00:00:00+00' + w * interval '7 days'
    and l.at < timestamptz '2026-10-10 00:00:00+00' + (w + 1) * interval '7 days'
    and case when wk.j->>'kind' = 'game' then l.game = wk.j->>'game'
      else exists (select 1 from public.plays p where p.user_id = uid and p.id::text = split_part(l.unit, ':', 1) and p.mode = wk.j->>'mode') end
$function$;

-- Stamps since the last cycle prize, as distinct week slots (0-15).
create or replace function public.rounds_cycle_have(uid uuid)
 returns integer
 language sql
 stable security definer
 set search_path to ''
as $function$
  select count(distinct ((substr(l.reason, 8)::int % 16) + 16) % 16)::int
  from public.wallet_ledger l
  where l.user_id = uid and l.kind = 'rounds' and l.reason ~ '^rounds:-?[0-9]+$'
    and l.at > coalesce((select max(c.at) from public.wallet_ledger c where c.user_id = uid and c.reason like 'rounds:cycle:%'), '-infinity'::timestamptz)
$function$;

create or replace function public.rounds_status()
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  with w as (select public.week_index() i),
  used as (select case when auth.uid() is null then 0 else public.rounds_used(auth.uid(), w.i) end n from w)
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
    'claimed', exists (select 1 from public.wallet_ledger l where l.user_id = auth.uid() and l.kind = 'rounds' and l.reason = 'rounds:' || w.i),
    'stamps', coalesce((select jsonb_agg((substr(l.reason, 8))::int order by l.at) from public.wallet_ledger l
      where l.user_id = auth.uid() and l.kind = 'rounds' and l.reason ~ '^rounds:-?[0-9]+$'), '[]'::jsonb),
    'cycle', jsonb_build_object('have', case when auth.uid() is null then 0 else public.rounds_cycle_have(auth.uid()) end, 'of', 16, 'prize', 3000)
  ) from w, used
$function$;

drop function if exists public.rounds_claim();
drop function if exists public.rounds_progress(uuid, integer);
drop function if exists public.rounds_parts(jsonb);

-- Collects mission `tier` (1-3) of this week: its chest; mission 3 also stamps the week, and the 16th different
-- stamp pays the cycle prize.
create or replace function public.rounds_claim(tier integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare uid uuid := auth.uid(); w int := public.week_index(); m jsonb := public.rounds_missions()->(tier - 1); d date; prize int := 0; n int;
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
  end if;
  return jsonb_build_object('ok', true, 'chest', m->>'chest', 'stamp', tier = 3, 'prize', prize);
end $function$;

-- The booster is gone: token_spend keeps the name glow and the second chance.
create or replace function public.token_spend(what text, ref text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare uid uuid := auth.uid(); cost int; bal int; n int; wk int := public.week_index(); sid text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || uid::text));
  if what = 'glow' then cost := 50;
  elsif what = 'second' then
    if coalesce(ref, '') = '' then return jsonb_build_object('ok', false, 'why', 'ref'); end if;
    select count(*) into n from public.wallet_ledger where user_id = uid and kind = 'spend' and reason = 'second:' || ref;
    if n >= 3 then return jsonb_build_object('ok', false, 'why', 'max'); end if;
    -- A refunded second chance means that run or level is over: no more for this ref.
    if exists (select 1 from public.wallet_ledger s join public.wallet_ledger f
                 on f.user_id = uid and f.kind = 'refund' and f.reason = s.id
               where s.user_id = uid and s.kind = 'spend' and s.reason = 'second:' || ref) then
      return jsonb_build_object('ok', false, 'why', 'max');
    end if;
    cost := (array[5, 10, 20])[n + 1];
  else return jsonb_build_object('ok', false, 'why', 'unknown');
  end if;
  bal := (public.wallet_balance(uid)->>'tokens')::int;
  if bal < cost then return jsonb_build_object('ok', false, 'why', 'tokens', 'need', cost - bal); end if;
  sid := 's' || replace(gen_random_uuid()::text, '-', '');
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, at)
  values (sid, uid, 'spend', 0, -cost, case what when 'glow' then 'glow:' || wk else 'second:' || ref end, now());
  if what = 'glow' then
    insert into public.style_worn (user_id) values (uid) on conflict (user_id) do nothing;
    update public.style_worn set glow_until = greatest(coalesce(glow_until, now()), now()) + interval '7 days' where user_id = uid;
  end if;
  return jsonb_build_object('ok', true, 'cost', cost, 'week', wk, 'id', sid);
end $function$;

-- Subscribers: spends are logged at their price (Grand Rounds counts them) but the bar stays as it is.
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
    if c is null or c not between 1 and 60 or coalesce(e->>'id', '') = '' then
      refused := refused || coalesce(e->>'id', '');
      continue;
    end if;
    t := least(now(), greatest(st.at, now() - interval '7 days', coalesce((e->>'at')::timestamptz, now())));
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

revoke all on function public.rounds_used(uuid, integer), public.rounds_cycle_have(uuid), public.rounds_claim(integer) from public, anon, authenticated;
grant execute on function public.rounds_claim(integer) to authenticated;
grant execute on function public.rounds_status() to anon, authenticated;

-- The 5-days-in-a-row epic chest counts daily diamond chests only, never a Grand Rounds one.
CREATE OR REPLACE FUNCTION public.challenges_status(tz_min integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  off interval; dday date; start timestamptz; far timestamptz := timestamptz '1970-01-01';
  g timestamptz[]; a timestamptz[]; sh timestamptz[]; rv timestamptz[];
  t1 timestamptz; t2 timestamptz; t3 timestamptz; step int; streak int := 0; d date;
begin
  if tz_min is null or tz_min not between -840 and 840 then raise exception 'tz'; end if;
  off := make_interval(mins => tz_min);
  dday := (now() + off)::date;
  start := (dday::timestamp - off) at time zone 'UTC';
  if uid is null then
    return jsonb_build_object('signed_in', false, 'day', dday, 'step', 1, 'streak', 0,
      'resets', (extract(epoch from start + interval '1 day') * 1000)::bigint,
      'chests', jsonb_build_object('wooden', 0, 'golden', 0, 'diamond', 0, 'epic', 0),
      'tasks', jsonb_build_array(
        jsonb_build_array(jsonb_build_object('k', 'games', 'n', 0, 'of', 5)),
        jsonb_build_array(jsonb_build_object('k', 'games', 'n', 0, 'of', 8), jsonb_build_object('k', 'ads', 'n', 0, 'of', 5), jsonb_build_object('k', 'shares', 'n', 0, 'of', 5)),
        jsonb_build_array(jsonb_build_object('k', 'games', 'n', 0, 'of', 12), jsonb_build_object('k', 'shares', 'n', 0, 'of', 5), jsonb_build_object('k', 'review', 'n', 0, 'of', 1))));
  end if;
  perform pg_advisory_xact_lock(hashtext('chest:' || uid::text));

  select coalesce(array_agg(p.ended_at), '{}') into g from public.plays p
    where p.user_id = uid and p.status = 'finished' and p.ended_at >= start and not coalesce(p.settings ? 'custom', false);
  select coalesce(array_agg(v.at), '{}') into a from public.ad_views v where v.user_id = uid and v.at >= start;
  select coalesce(array_agg(e.at), '{}') into sh from public.challenge_events e where e.user_id = uid and e.kind = 'share' and e.at >= start;
  select coalesce(array_agg(e.at), '{}') into rv from public.challenge_events e where e.user_id = uid and e.kind = 'review' and e.at >= start;

  t1 := public.challenge_nth(g, far, 5);
  if t1 is not null then
    t2 := greatest(public.challenge_nth(g, t1, 8), public.challenge_nth(a, t1, 5), public.challenge_nth(sh, t1, 5));
    if public.challenge_nth(g, t1, 8) is null or public.challenge_nth(a, t1, 5) is null or public.challenge_nth(sh, t1, 5) is null then t2 := null; end if;
  end if;
  if t2 is not null then
    t3 := greatest(public.challenge_nth(g, t2, 12), public.challenge_nth(sh, t2, 5), public.challenge_nth(rv, t2, 1));
    if public.challenge_nth(g, t2, 12) is null or public.challenge_nth(sh, t2, 5) is null or public.challenge_nth(rv, t2, 1) is null then t3 := null; end if;
  end if;
  step := case when t3 is not null then 4 when t2 is not null then 3 when t1 is not null then 2 else 1 end;

  if t1 is not null then insert into public.chest_earned (user_id, day, kind) values (uid, dday, 'wooden') on conflict do nothing; end if;
  if t2 is not null then insert into public.chest_earned (user_id, day, kind) values (uid, dday, 'golden') on conflict do nothing; end if;
  if t3 is not null then insert into public.chest_earned (user_id, day, kind) values (uid, dday, 'diamond') on conflict do nothing; end if;

  d := case when t3 is not null then dday else dday - 1 end;
  while exists (select 1 from public.chest_earned c where c.user_id = uid and c.day = d and c.kind = 'diamond' and c.src = 'daily') loop
    streak := streak + 1; d := d - 1;
    exit when streak >= 400;
  end loop;
  if t3 is not null and streak > 0 and streak % 5 = 0 then
    insert into public.chest_earned (user_id, day, kind) values (uid, dday, 'epic') on conflict do nothing;
  end if;

  return jsonb_build_object('signed_in', true, 'day', dday, 'step', step,
    'streak', case when streak = 0 then 0 when streak % 5 = 0 and t3 is not null then 5 else streak % 5 end,
    'resets', (extract(epoch from start + interval '1 day') * 1000)::bigint,
    'chests', public.chests_owned(uid),
    'tasks', jsonb_build_array(
      jsonb_build_array(jsonb_build_object('k', 'games', 'n', public.challenge_count(g, far, 5), 'of', 5)),
      jsonb_build_array(
        jsonb_build_object('k', 'games', 'n', case when t1 is null then 0 else public.challenge_count(g, t1, 8) end, 'of', 8),
        jsonb_build_object('k', 'ads', 'n', case when t1 is null then 0 else public.challenge_count(a, t1, 5) end, 'of', 5),
        jsonb_build_object('k', 'shares', 'n', case when t1 is null then 0 else public.challenge_count(sh, t1, 5) end, 'of', 5)),
      jsonb_build_array(
        jsonb_build_object('k', 'games', 'n', case when t2 is null then 0 else public.challenge_count(g, t2, 12) end, 'of', 12),
        jsonb_build_object('k', 'shares', 'n', case when t2 is null then 0 else public.challenge_count(sh, t2, 5) end, 'of', 5),
        jsonb_build_object('k', 'review', 'n', case when t2 is null then 0 else public.challenge_count(rv, t2, 1) end, 'of', 1))));
end $function$;
