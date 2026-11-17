-- Treasure hunt: the Nova card now needs any 6 free token ways (was all 13; iPhone shows only 8). Yazan 2026-11-18.
-- Progress is capped at 6 so it never reads above the target.
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
      ('case-files-unsolved'),('the-wheels-of-chaos'),('four-of-a-kind'),('spot-the-flaw'),('trace-the-treatment')) a(g))
  select jsonb_build_object(
    'bolt', jsonb_build_array(1, 1),
    'iris', jsonb_build_array((select count(*) from games where exists (select 1 from fin where fin.game = games.g)), 10),
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
