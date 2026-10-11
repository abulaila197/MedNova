-- Leaderboard (RL3): players ranked by EXP earned in a period (week / month / all), everyone or friends, all games
-- or one game. Top 50; ties go to whoever reached that EXP first. The caller also gets their own place and the gap
-- to the player just above. Weeks start Monday 00:00 UTC, months on the 1st.
create or replace function public.leaderboard(period text default 'week', scope text default 'everyone', game text default null)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  with me as (select auth.uid() as uid),
  since as (
    select case period when 'week' then date_trunc('week', now()) when 'month' then date_trunc('month', now()) else '-infinity'::timestamptz end as t
  ),
  pool as (
    select p.id from public.profiles p, me
    where scope <> 'friends' or p.id = me.uid or exists (
      select 1 from public.friendships f
      where f.status = 'accepted' and ((f.user_a = me.uid and f.user_b = p.id) or (f.user_b = me.uid and f.user_a = p.id)))
  ),
  earned as (
    select w.user_id, sum(w.exp)::int as exp, max(w.at) as reached
    from public.wallet_ledger w
    join pool on pool.id = w.user_id
    left join public.plays pl on pl.id = w.play_id
    where w.kind = 'exp' and w.at >= (select t from since)
      and (game is null or pl.game = game)
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
$$;

grant execute on function public.leaderboard(text, text, text) to anon, authenticated;
