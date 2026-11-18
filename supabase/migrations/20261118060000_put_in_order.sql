-- Put it in order (Yazan 2026-11-18, Group 7). Paste in the Supabase SQL Editor any time; safe to run more than once.
-- 1) Its name in challenge, inbox and Grand Rounds texts (English "Put it in order", Arabic "رتّبها صح"). Six Word Tries
--    keeps its old name here: the Word Lab rename has its own file for the production release (word-lab-name.sql, also updated).
-- 2) Treasure hunt: Iris's "play every game outside Party time" now counts Put it in order too (12 games, was 11).
create or replace function public.challenge_game_name(slug text) returns text language sql immutable set search_path to '' as $$
  select case slug
    when 'the-diagnostic-pursuit' then 'Race to Diagnosis'
    when 'the-silent-artist' then 'Sketch It'
    when 'nova-crossword' then 'Nova Crossword'
    when 'the-quiz-parade' then 'Quick Fire Quiz'
    when 'the-riddler' then 'Medical Riddles'
    when 'nova-medicordle' then 'Six Word Tries'
    when 'the-streak-master' then 'The Streak Master'
    when 'case-files-unsolved' then 'Case Files'
    when 'the-wheels-of-chaos' then 'The Wheels of Chaos'
    when 'imposter' then 'The Imposter'
    when 'tilt-and-tell' then 'Tilt & Tell'
    when 'who-am-i' then 'Who am I?'
    when 'put-in-order' then 'Put it in order'
    else initcap(replace(coalesce(slug, 'a game'), '-', ' ')) end;
$$;
create or replace function public.challenge_game_name_ar(slug text) returns text language sql immutable set search_path to '' as $$
  select case slug
    when 'the-diagnostic-pursuit' then 'سباق التشخيص'
    when 'the-silent-artist' then 'ارسم وخمّن'
    when 'nova-crossword' then 'كلمات متقاطعة'
    when 'the-quiz-parade' then 'أسئلة سريعة'
    when 'the-riddler' then 'فوازير طبية'
    when 'nova-medicordle' then 'خمّن الكلمة'
    when 'the-streak-master' then 'سلسلة الإجابات'
    when 'case-files-unsolved' then 'ملفات غامضة'
    when 'the-wheels-of-chaos' then 'عجلة الفوضى'
    when 'imposter' then 'الدخيل'
    when 'tilt-and-tell' then 'على راسك'
    when 'four-of-a-kind' then 'رباعيات'
    when 'spot-the-flaw' then 'اكتشف الغلطة'
    when 'trace-the-treatment' then 'تتبّع العلاج'
    when 'who-am-i' then 'مين أنا؟'
    when 'put-in-order' then 'رتّبها صح'
    else public.challenge_game_name(slug) end;
$$;
create or replace function public.game_en_to_ar(en text) returns text language sql immutable set search_path to '' as $$
  select coalesce((select public.challenge_game_name_ar(s) from unnest(array['the-diagnostic-pursuit', 'the-silent-artist',
    'nova-crossword', 'the-quiz-parade', 'the-riddler', 'nova-medicordle', 'the-streak-master', 'case-files-unsolved',
    'the-wheels-of-chaos', 'imposter', 'tilt-and-tell', 'four-of-a-kind', 'spot-the-flaw', 'trace-the-treatment', 'who-am-i', 'put-in-order']) s
    where public.challenge_game_name(s) = en limit 1), en);
$$;
CREATE OR REPLACE FUNCTION public.hunt_progress(uid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with fin as (select game, mode, standings from public.plays where user_id = uid and status = 'finished' and not coalesce(settings ? 'custom', false)),
  days as (select (substr(reason, 5))::date d from public.wallet_ledger where user_id = uid and kind = 'daily' and reason like 'day:%'),
  runs as (select count(*) n from (select d, d - (row_number() over (order by d))::int g from (select distinct d from days) x) y group by g),
  games as (select g from (values ('the-diagnostic-pursuit'),('nova-crossword'),('the-riddler'),('nova-medicordle'),('the-streak-master'),
      ('case-files-unsolved'),('the-wheels-of-chaos'),('four-of-a-kind'),('spot-the-flaw'),('trace-the-treatment'),('who-am-i'),('put-in-order')) a(g))
  select jsonb_build_object(
    'bolt', jsonb_build_array(1, 1),
    'iris', jsonb_build_array((select count(*) from games where exists (select 1 from fin where fin.game = games.g)), 12),
    'atlas', jsonb_build_array(coalesce((select max(n) from runs), 0), 7),
    'nova', jsonb_build_array(least(6, (select count(distinct reason) from public.wallet_ledger where user_id = uid and reason in
       ('free:tiktok','free:instagram','free:facebook','free:youtube','free:community','free:listing','free:feedback',
        'free:story:0','free:story:1','free:story:2','free:story:3','free:story:4'))
     + (select count(*) from (select 1 from public.ad_views where user_id = uid and source = 'store' limit 1) a)), 6),
    'pip', jsonb_build_array((select count(*) from fin where mode in ('online', 'bots')), 50),
    'yara', jsonb_build_array(coalesce((select count(*) from public.player_progress pp, jsonb_object_keys(coalesce(pp.value->'done', '{}'::jsonb))
       where pp.user_id = uid and pp.key = 'learn:review'), 0), 100),
    'yazan', jsonb_build_array((select count(*) from public.friendships where status = 'accepted' and uid in (user_a, user_b)), 10),
    'layla', jsonb_build_array(
       (select count(*) from games where exists (select 1 from fin where fin.game = games.g and fin.mode = 'solo'))
     + (select count(*) from games where exists (select 1 from fin where fin.game = games.g and fin.mode = 'bots'
          and jsonb_array_length(fin.standings) > 1 and fin.standings @> '[{"seat":0,"rank":1}]'::jsonb)), 20),
    'omar', jsonb_build_array((select count(*) from fin), 300)
  );
$function$;
