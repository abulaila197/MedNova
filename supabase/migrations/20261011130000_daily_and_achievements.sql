-- Session 3 stage 2: daily login prizes (DL1-DL4) and achievements (AC1-AC5), paid as server-written wallet rows.
alter table public.wallet_ledger drop constraint if exists wallet_ledger_kind_check;
alter table public.wallet_ledger add constraint wallet_ledger_kind_check
  check (kind = any (array['exp','spend','refund','convert','grant','daily','achievement']));

create or replace function public.wallet_balance(uid uuid default auth.uid()) returns jsonb
language sql stable security definer set search_path = public as $$
  with s as (
    select coalesce(sum(exp) filter (where kind = 'exp'), 0) exp,
           coalesce(sum(tokens) filter (where kind in ('spend','refund','grant','daily','achievement')), 0) other
    from public.wallet_ledger where user_id = uid
  )
  select jsonb_build_object('exp', exp, 'level', public.wallet_level(exp), 'tokens', public.wallet_level_tokens(public.wallet_level(exp)) + other)
  from s where uid = auth.uid() or public.is_admin();
$$;

-- DL1: alternating 1 and 2, every 7th day 3, day 30 10.
create or replace function public.daily_prize(day int) returns int
language sql immutable as $$
  select case when day = 30 then 10 when day % 7 = 0 then 3 when day % 2 = 1 then 1 else 2 end
$$;

-- Where the player's calendar stands. `local_date` of the last claim tells the phone if today is done (DL3).
create or replace function public.daily_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'claimed', count(*),
    'next_day', (count(*) % 30) + 1,
    'last_date', (array_agg(substr(reason, 5) order by at desc))[1],
    'last_at', max(at))
  from public.wallet_ledger where user_id = auth.uid() and kind = 'daily';
$$;

-- Collects today's prize. Day = the player's own date (DL3), allowed only within 14 h of the server's UTC date,
-- once per date and never twice within 20 hours. Misses only pause the calendar (DL2).
create or replace function public.daily_claim(local_date date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  n int; last_at timestamptz; d int; tok int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('daily:' || uid::text));
  if local_date not between (now() at time zone 'utc' - interval '14 hours')::date and (now() at time zone 'utc' + interval '14 hours')::date then
    return jsonb_build_object('ok', false, 'why', 'date');
  end if;
  select count(*), max(at) into n, last_at from public.wallet_ledger where user_id = uid and kind = 'daily';
  if exists (select 1 from public.wallet_ledger where user_id = uid and kind = 'daily' and reason = 'day:' || local_date::text)
     or last_at > now() - interval '20 hours' then
    return jsonb_build_object('ok', false, 'why', 'done');
  end if;
  d := (n % 30) + 1;
  tok := public.daily_prize(d);
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, note, at)
  values ('d' || replace(gen_random_uuid()::text, '-', ''), uid, 'daily', 0, tok, 'day:' || local_date::text, 'calendar day ' || d, now());
  return jsonb_build_object('ok', true, 'day', d, 'tokens', tok);
end $$;

-- Achievements (AC1-AC5): each tier pays once (bronze 1, silver 3, gold 5). The server re-counts what it can
-- see (plays, prize days, level); the rest is counted on the phone and capped by the one-time tiers.
create or replace function public.achievement_goal(key text, tier int) returns int
language sql immutable as $$
  select (case key
    when 'first_rounds' then array[1,50,250]
    when 'full_rotation' then array[1,5,20]
    when 'night_shift' then array[1,10,50]
    when 'clean_diagnosis' then array[1,10,50]
    when 'hot_streak' then array[10,20,35]
    when 'two_guess' then array[1,5,20]
    when 'riddle_me_this' then array[25,150,500]
    when 'cold_case' then array[10,50,150]
    when 'full_marks' then array[10,20,31]
    when 'conqueror' then array[1,10,50]
    when 'most_trusted' then array[1,10,50]
    when 'team_player' then array[1,10,50]
    when 'house_call' then array[1,20,100]
    when 'pass_stethoscope' then array[10,50,200]
    when 'back_to_basics' then array[20,200,1000]
    when 'dossier_reader' then array[50,200,511]
    when 'week_on_call' then array[7,30,100]
    when 'residency' then array[180,365,730]
    when 'career' then array[10,25,50]
  end)[tier]
$$;

create or replace function public.achievement_claim(key text, tier int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  goal int := public.achievement_goal(key, tier);
  have bigint;
  tok int := (array[1,3,5])[tier];
begin
  if uid is null then raise exception 'not signed in'; end if;
  if goal is null then return jsonb_build_object('ok', false, 'why', 'unknown'); end if;
  perform pg_advisory_xact_lock(hashtext('ach:' || uid::text));
  if exists (select 1 from public.wallet_ledger where user_id = uid and kind = 'achievement' and reason = 'ach:' || key || ':' || tier) then
    return jsonb_build_object('ok', false, 'why', 'done');
  end if;
  if tier > 1 and not exists (select 1 from public.wallet_ledger where user_id = uid and kind = 'achievement' and reason = 'ach:' || key || ':' || (tier - 1)) then
    return jsonb_build_object('ok', false, 'why', 'order');
  end if;
  have := case key
    when 'first_rounds' then (select count(*) from public.plays where user_id = uid and status = 'finished')
    when 'pass_stethoscope' then (select count(*) from public.plays where user_id = uid and status = 'finished' and mode = 'offline')
    when 'full_rotation' then (select case when count(*) < 10 then 0 else min(c) end from
      (select count(*) c from public.plays where user_id = uid and status = 'finished' group by game) g)
    when 'week_on_call' then (select count(*) from public.wallet_ledger where user_id = uid and kind = 'daily')
    when 'residency' then (select count(*) from public.wallet_ledger where user_id = uid and kind = 'daily')
    when 'career' then (public.wallet_balance(uid)->>'level')::int
    else goal
  end;
  if have < goal then return jsonb_build_object('ok', false, 'why', 'not yet'); end if;
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, at)
  values ('a' || replace(gen_random_uuid()::text, '-', ''), uid, 'achievement', 0, tok, 'ach:' || key || ':' || tier, now());
  return jsonb_build_object('ok', true, 'tokens', tok);
end $$;

revoke all on function public.daily_status(), public.daily_claim(date), public.achievement_claim(text, int) from public, anon;
grant execute on function public.daily_status(), public.daily_claim(date), public.achievement_claim(text, int) to authenticated;
