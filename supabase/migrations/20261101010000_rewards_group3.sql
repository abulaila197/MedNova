-- App fixes group 3 (Yazan, 2026-11-01): rewards and achievements.

-- #3: Grand Rounds missions ask for fewer Sparks (was 200 / 400 / 1000).
create or replace function public.rounds_missions() returns jsonb
language sql immutable set search_path = '' as $$
  select '[{"of":160,"chest":"wooden"},{"of":320,"chest":"golden"},{"of":800,"chest":"diamond"}]'::jsonb
$$;

-- #4: an item you already have pays 5x the old tokens (sticker packs 75, 3-star robots 125, 4-star 250,
-- Too Easy and Mic Drop 350, 5-star robots 400).
create or replace function public.chest_items()
returns table (key text, rarity text, dupe integer, stars integer)
language sql immutable set search_path = '' as $$
  values ('tokens:10', 'common', 0, 0), ('tokens:20', 'common', 0, 0), ('tokens:30', 'uncommon', 0, 0),
    ('pack:arcade', 'uncommon', 75, 0), ('pack:comic', 'uncommon', 75, 0), ('pack:chrome', 'uncommon', 75, 0),
    ('tokens:50', 'rare', 0, 0), ('mech:sprocket', 'rare', 125, 3), ('mech:kit', 'rare', 125, 3),
    ('tokens:100', 'epic', 0, 0), ('mech:vex', 'epic', 250, 4), ('mech:bulwark', 'epic', 250, 4), ('mech:echo', 'epic', 250, 4),
    ('mech:aurora', 'legendary', 400, 5), ('mech:cortex', 'legendary', 400, 5), ('mech:titan', 'legendary', 400, 5),
    ('effect:too_easy', 'legendary', 350, 0), ('effect:mic_drop', 'legendary', 350, 0)
$$;

-- #8: one achievement for each of the 4 new games (Quiz Parade, Password, Code Clinic, Imposter) replaces
-- Most Trusted (Trust Me Not was cancelled). Most Trusted stays here so old phones still work.
create or replace function public.achievement_goal(key text, tier int) returns int
language sql immutable set search_path = '' as $$
  select (case key
    when 'first_rounds' then array[1,50,250,600]
    when 'full_rotation' then array[1,5,20,50]
    when 'night_shift' then array[1,10,50,125]
    when 'clean_diagnosis' then array[1,10,50,125]
    when 'hot_streak' then array[10,20,35,60]
    when 'two_guess' then array[1,5,20,50]
    when 'riddle_me_this' then array[25,150,500,1200]
    when 'cold_case' then array[10,50,150,375]
    when 'full_marks' then array[10,20,31]
    when 'conqueror' then array[1,10,50,125]
    when 'most_trusted' then array[1,10,50,125]
    when 'parade_leader' then array[1,10,50,125]
    when 'one_word' then array[1,10,50,125]
    when 'code_breaker' then array[1,10,50,125]
    when 'sharp_eye' then array[1,10,50,125]
    when 'team_player' then array[1,10,50,125]
    when 'house_call' then array[1,20,100,250]
    when 'pass_stethoscope' then array[10,50,200,500]
    when 'back_to_basics' then array[20,200,1000,2500]
    when 'dossier_reader' then array[50,200,511]
    when 'week_on_call' then array[7,30,100,250]
    when 'residency' then array[180,365,730,1095]
    when 'career' then array[10,25,50,100]
    when 'recruiter' then array[3,10,30,75]
    when 'case_writer' then array[5,10,20,50]
    when 'challenger' then array[10,20,30,75]
    when 'ad_watcher' then array[20,50,100,250]
    when 'grand_rounds' then array[1,5,13,26]
    when 'frame_collector' then array[1,4,8,11]
    when 'title_collector' then array[1,5,10,14]
    when 'app_tour' then array[1]
  end)[tier]
$$;

-- #10: achievement rewards doubled. Bronze/Silver/Gold pay 2/6/10 (Case Writer 6/8/10, Commercial Break 10/20/40);
-- Platinum pays the three added up; "Get to know the app" pays 10. Tiers already collected keep what they paid.
create or replace function public.achievement_tokens(key text, tier int) returns int
language sql immutable set search_path = '' as $$
  select case when key = 'app_tour' then 10 else
    (case key when 'case_writer' then array[6,8,10,24] when 'ad_watcher' then array[10,20,40,70] else array[2,6,10,18] end)[tier] end
$$;

-- The 13 games on the Games page (Trust Me Not was cancelled).
create or replace function public.rotation_games() returns text[]
language sql immutable set search_path = '' as $$
  select array['case-files-unsolved','the-conqueror','nova-crossword','the-diagnostic-pursuit','nova-medicordle',
    'the-riddler','the-silent-artist','the-streak-master','the-wheels-of-chaos',
    'the-quiz-parade','nova-password','code-clinic','imposter']
$$;

-- Same as before, except Full Rotation: every one of the 13 games must be played, and its count is the least-played one.
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
    when 'full_rotation' then (select min(coalesce(c, 0)) from unnest(public.rotation_games()) g(game)
      left join (select p.game, count(*) c from public.plays p where p.user_id = uid and p.status = 'finished'
                   and not coalesce(p.settings ? 'custom', false) group by p.game) x on x.game = g.game)
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
