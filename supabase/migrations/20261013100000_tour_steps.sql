-- "Get to Know MedNova": the claim must name every page outside the games (same list as TOUR_STEPS in the app).
create or replace function public.tour_steps() returns text[]
language sql immutable set search_path = '' as $$
  select array['learn','shelf','newcase','community','wallpapers','profile','friends','leaderboard','achievements',
    'rounds','cards','store','style','faq','about','contact','privacy','licences']
$$;

create or replace function public.achievement_collect(key text, tier int, steps text[] default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  goal int := public.achievement_goal(key, tier);
  have bigint;
  tok int := public.achievement_tokens(key, tier);
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
    when 'grand_rounds' then (select count(*) from public.wallet_ledger where user_id = uid and kind = 'rounds')
    when 'frame_collector' then (select count(*) from public.style_owned where user_id = uid and item like 'frame:%')
    when 'title_collector' then (select count(*) from public.style_owned where user_id = uid and item like 'title:%')
    when 'app_tour' then case when steps @> public.tour_steps() then 1 else 0 end
    else goal
  end;
  if have < goal then return jsonb_build_object('ok', false, 'why', 'not yet'); end if;
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, at)
  values ('a' || replace(gen_random_uuid()::text, '-', ''), uid, 'achievement', 0, tok, 'ach:' || key || ':' || tier, now());
  return jsonb_build_object('ok', true, 'tokens', tok);
end $$;
