-- Ads (AD-1..): every watched ad is one row (play-again ads on the out-of-free-plays sheet, and Store token ads).
-- Store ads pay 1 token each, up to 5 a day; play-again ads give a play, never tokens, also 5 a day across all games. Achievement "Ad Watcher" counts both kinds: 20/50/100, paying 5/10/20.
-- Nova's card mission now needs one Store ad too (14 solo free ways). The app only calls ad_watched once ads are live.
create table if not exists public.ad_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('play', 'store')),
  at timestamptz not null default now()
);
create index if not exists ad_views_user on public.ad_views (user_id, source, at);
alter table public.ad_views enable row level security;

create or replace function public.ad_watched(source text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); per int := 1; cap int := 5; today int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if source not in ('play', 'store') then raise exception 'source'; end if;
  perform pg_advisory_xact_lock(hashtext('free:' || uid::text));
  -- Each kind has its own 5 a day: play-again ads (all games together) and Store token ads.
  select count(*) into today from public.ad_views a where a.user_id = uid and a.source = ad_watched.source and a.at >= date_trunc('day', now());
  if today >= cap then return jsonb_build_object('ok', false, 'why', 'cap'); end if;
  insert into public.ad_views (user_id, source) values (uid, ad_watched.source);
  if source = 'store' then
    perform public.pay_free(uid, 'free', per, 'free:ad:' || to_char(now(), 'YYYY-MM-DD') || ':' || (today + 1), 'Watched an ad');
    return jsonb_build_object('ok', true, 'tokens', per, 'left', cap - today - 1);
  end if;
  return jsonb_build_object('ok', true);
end $$;

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
    when 'recruiter' then array[3,10,30]
    when 'case_writer' then array[5,10,20]
    when 'challenger' then array[10,20,30]
    when 'ad_watcher' then array[20,50,100]
  end)[tier]
$$;

create or replace function public.achievement_claim(key text, tier int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  goal int := public.achievement_goal(key, tier);
  have bigint;
  tok int := case key when 'case_writer' then (array[3,4,5])[tier] when 'ad_watcher' then (array[5,10,20])[tier] else (array[1,3,5])[tier] end;
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
    when 'first_rounds' then (select count(*) from public.plays where user_id = uid and status = 'finished' and not coalesce(settings ? 'custom', false))
    when 'pass_stethoscope' then (select count(*) from public.plays where user_id = uid and status = 'finished' and mode = 'offline' and not coalesce(settings ? 'custom', false))
    when 'full_rotation' then (select case when count(*) < 10 then 0 else min(c) end from
      (select count(*) c from public.plays where user_id = uid and status = 'finished' and not coalesce(settings ? 'custom', false) group by game) g)
    when 'week_on_call' then (select count(*) from public.wallet_ledger where user_id = uid and kind = 'daily')
    when 'residency' then (select count(*) from public.wallet_ledger where user_id = uid and kind = 'daily')
    when 'career' then (public.wallet_balance(uid)->>'level')::int
    when 'recruiter' then (select count(*) from public.referrals where inviter = uid)
    when 'case_writer' then (select count(*) from public.custom_cases where user_id = uid)
    when 'challenger' then (select count(*) from public.invites where from_user = uid)
    when 'ad_watcher' then (select count(*) from public.ad_views where user_id = uid)
    else goal
  end;
  if have < goal then return jsonb_build_object('ok', false, 'why', 'not yet'); end if;
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, at)
  values ('a' || replace(gen_random_uuid()::text, '-', ''), uid, 'achievement', 0, tok, 'ach:' || key || ':' || tier, now());
  return jsonb_build_object('ok', true, 'tokens', tok);
end $$;


create or replace function public.social_counts() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'recruiter', (select count(*) from public.referrals where inviter = auth.uid()),
    'case_writer', (select count(*) from public.custom_cases where user_id = auth.uid()),
    'challenger', (select count(*) from public.invites where from_user = auth.uid()),
    'ad_watcher', (select count(*) from public.ad_views where user_id = auth.uid())
  ) where auth.uid() is not null;
$$;

create or replace function public.free_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'done', coalesce((select jsonb_agg(distinct reason) from public.wallet_ledger where user_id = auth.uid() and kind = 'free'), '[]'::jsonb),
    'ambassador', (select status from public.ambassador_videos where user_id = auth.uid() order by created_at desc limit 1),
    'invites', (select count(*) from public.referrals where inviter = auth.uid()),
    'invite_tokens', coalesce((select sum(tokens) from public.wallet_ledger where user_id = auth.uid() and reason like 'ref:in:%'), 0),
    'redeemed', exists (select 1 from public.referrals where new_user = auth.uid()),
    'downloads', (select value from public.app_stats where key = 'downloads'),
    'goal', 100000,
    'ads_today', (select count(*) from public.ad_views where user_id = auth.uid() and source = 'store' and at >= date_trunc('day', now()))
  );
$$;

create or replace function public.hunt_progress(uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with fin as (select game, mode, standings from public.plays where user_id = uid and status = 'finished' and not coalesce(settings ? 'custom', false)),
  days as (select (substr(reason, 5))::date d from public.wallet_ledger where user_id = uid and kind = 'daily' and reason like 'day:%'),
  runs as (select count(*) n from (select d, d - (row_number() over (order by d))::int g from (select distinct d from days) x) y group by g),
  multi as (select g, m from (values
      ('case-files-unsolved'),('nova-crossword'),('the-diagnostic-pursuit'),('nova-medicordle'),('the-riddler'),('the-silent-artist'),('the-streak-master'),('the-wheels-of-chaos')) a(g)
      cross join (values ('offline'),('online')) b(m)
    union all values ('the-conqueror','online'), ('trust-me-not','online')),
  solo as (select g from (values ('case-files-unsolved'),('nova-crossword'),('the-diagnostic-pursuit'),('nova-medicordle'),('the-riddler'),('the-silent-artist'),('the-streak-master'),('the-wheels-of-chaos')) a(g))
  select jsonb_build_object(
    'bolt', jsonb_build_array(1, 1),
    'iris', jsonb_build_array((select count(distinct game) from fin), 10),
    'atlas', jsonb_build_array(coalesce((select max(n) from runs), 0), 7),
    'nova', jsonb_build_array((select count(distinct reason) from public.wallet_ledger where user_id = uid and reason in
       ('free:tiktok','free:instagram','free:facebook','free:youtube','free:channel','free:community','free:listing','free:feedback',
        'free:story:0','free:story:1','free:story:2','free:story:3','free:story:4'))
     + (select count(*) from (select 1 from public.ad_views where user_id = uid and source = 'store' limit 1) a), 14),
    'pip', jsonb_build_array((select count(*) from fin where mode = 'online'), 50),
    'yara', jsonb_build_array(coalesce((select count(*) from public.player_progress pp, jsonb_object_keys(coalesce(pp.value->'done', '{}'::jsonb))
       where pp.user_id = uid and pp.key = 'learn:review'), 0), 100),
    'yazan', jsonb_build_array((select count(*) from public.friendships where status = 'accepted' and uid in (user_a, user_b)), 10),
    'layla', jsonb_build_array(
       (select count(*) from multi where exists (select 1 from fin where fin.game = multi.g and fin.mode = multi.m
          and jsonb_array_length(fin.standings) > 1 and fin.standings @> '[{"seat":0,"rank":1}]'::jsonb))
     + (select count(*) from solo where exists (select 1 from fin where fin.game = solo.g and fin.mode = 'solo')), 26),
    'omar', jsonb_build_array((select count(*) from fin), 300)
  );
$$;

revoke all on function public.hunt_progress(uuid) from public, anon, authenticated;
revoke all on function public.ad_watched(text) from public, anon;
grant execute on function public.ad_watched(text) to authenticated;
