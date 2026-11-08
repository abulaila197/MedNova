-- #33: the leaderboard showed the same board for every game filter. In a SQL function an unqualified name that is
-- also a column means the column, so `pl.game = game` compared the column with itself. Parameters are now qualified.
-- #7 / #90: hunt missions for the current 13 games (Trust Me Not removed; The Quiz Parade, The Imposter, Code Clinic
-- and Nova Password added). Iris = play all 13 games, any sub mode; Layla = win every multiplayer mode and finish
-- every Solo mode of them.

CREATE OR REPLACE FUNCTION public.leaderboard(period text DEFAULT 'week'::text, scope text DEFAULT 'everyone'::text, game text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with me as (select auth.uid() as uid),
  since as (
    select case leaderboard.period when 'week' then date_trunc('week', now() + interval '2 days') - interval '2 days' when 'month' then date_trunc('month', now()) else '-infinity'::timestamptz end as t
  ),
  pool as (
    select p.id from public.profiles p, me
    where leaderboard.scope <> 'friends' or p.id = me.uid or exists (
      select 1 from public.friendships f
      where f.status = 'accepted' and ((f.user_a = me.uid and f.user_b = p.id) or (f.user_b = me.uid and f.user_a = p.id)))
  ),
  earned as (
    select w.user_id, sum(w.exp)::int as exp, max(w.at) as reached
    from public.wallet_ledger w
    join pool on pool.id = w.user_id
    left join public.plays pl on pl.id = w.play_id
    where w.kind = 'exp' and w.at >= (select t from since)
      and (leaderboard.game is null or pl.game = leaderboard.game)
    group by w.user_id
    having sum(w.exp) > 0
  ),
  ranked as (
    select e.user_id, e.exp, row_number() over (order by e.exp desc, e.reached asc) as rank
    from earned e
  ),
  rows as (
    select r.rank, r.user_id, r.exp, coalesce(nullif(pr.display_name, ''), pr.username::text, 'Player') as name,
           public.wallet_level(coalesce((select sum(w.exp) from public.wallet_ledger w where w.user_id = r.user_id and w.kind = 'exp'), 0)) as level
    from ranked r join public.profiles pr on pr.id = r.user_id
  ),
  mine as (select * from rows, me where rows.user_id = me.uid)
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object('rank', rank, 'id', user_id, 'name', name, 'level', level, 'exp', exp) order by rank) from rows where rank <= 50), '[]'::jsonb),
    'me', (select jsonb_build_object('rank', m.rank, 'exp', m.exp,
             'above', (select jsonb_build_object('name', a.name, 'gap', a.exp - m.exp + 1) from rows a where a.rank = m.rank - 1))
           from mine m)
  );
$function$;

CREATE OR REPLACE FUNCTION public.hunt_progress(uid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with fin as (select game, mode, standings from public.plays where user_id = uid and status = 'finished' and not coalesce(settings ? 'custom', false)),
  days as (select (substr(reason, 5))::date d from public.wallet_ledger where user_id = uid and kind = 'daily' and reason like 'day:%'),
  runs as (select count(*) n from (select d, d - (row_number() over (order by d))::int g from (select distinct d from days) x) y group by g),
  solo as (select g from (values ('case-files-unsolved'),('nova-crossword'),('the-diagnostic-pursuit'),('nova-medicordle'),('the-riddler'),
      ('the-silent-artist'),('the-streak-master'),('the-wheels-of-chaos'),('the-quiz-parade')) a(g)),
  multi as (select g, m from (select g from solo union all values ('imposter'),('code-clinic'),('nova-password')) a(g)
      cross join (values ('offline'),('online')) b(m)
    union all values ('the-conqueror','online')),
  games as (select g from solo union all values ('imposter'),('code-clinic'),('nova-password'),('the-conqueror'))
  select jsonb_build_object(
    'bolt', jsonb_build_array(1, 1),
    'iris', jsonb_build_array((select count(*) from games where exists (select 1 from fin where fin.game = games.g)), 13),
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
     + (select count(*) from solo where exists (select 1 from fin where fin.game = solo.g and fin.mode = 'solo')), 34),
    'omar', jsonb_build_array((select count(*) from fin), 300)
  );
$function$;
