-- Smaller answer history (Yazan 2026-11-12, database saver 3): right answers older than 60 days are folded into a
-- short summary on their play, then deleted. Misses stay as they are (they feed Today's review on a new phone and
-- the Six Word Tries daily guard). The summary keeps what the profile stats and achievements count, so nothing
-- earned is lost when a player opens the account on a new phone. Runs every night at 03:50 (Egypt is UTC+2/+3).
-- Needs the app from the same build (it reads plays.folded); ship together.

alter table public.plays add column if not exists folded jsonb;

create or replace function public.fold_old_items(days int default 60) returns int
language plpgsql security definer set search_path = 'public' as $$
declare n int := 0; pl record; s jsonb;
begin
  for pl in
    select p.id, p.game, p.mode from public.plays p
    where p.ended_at < now() - make_interval(days => days)
      and exists (select 1 from public.play_items i where i.play_id = p.id and i.outcome = 'right')
    limit 2000
  loop
    -- r: right answers by the phone owner (seat 0); the rest only for the achievements that count them.
    select jsonb_strip_nulls(jsonb_build_object(
        'r', count(*) filter (where i.seat = 0),
        'clean', nullif(count(*) filter (where i.seat = 0 and pl.game = 'the-diagnostic-pursuit' and (i.game_data->>'cluesShown') = '1'), 0),
        'two', nullif(count(*) filter (where i.seat = 0 and pl.game = 'nova-medicordle' and (
               case when pl.mode = 'offline'
                    then (select count(*) from jsonb_array_elements(coalesce(i.game_data->'turns', '[]')) t where t->>'word' is not null)
                    else coalesce((i.game_data->>'guesses')::int, 0) end) between 1 and 2), 0),
        'riddle', nullif(count(*) filter (where i.seat = 0 and pl.game = 'the-riddler'), 0),
        'cold', nullif(count(*) filter (where i.seat = 0 and pl.game = 'case-files-unsolved'), 0),
        'streak', nullif(max(case when i.seat = 0 and pl.game = 'the-streak-master' then (i.game_data->>'streak')::int end), 0),
        'stars3', (select jsonb_agg(distinct (x.game_data->>'level')::int) from public.play_items x
                   where x.play_id = pl.id and x.seat = 0 and x.outcome = 'right' and pl.game = 'nova-crossword'
                     and pl.mode = 'solo' and (x.game_data->>'stars') = '3')))
      into s
    from public.play_items i where i.play_id = pl.id and i.outcome = 'right';
    -- An earlier fold of the same play adds up.
    update public.plays p set folded = case when p.folded is null then s else jsonb_strip_nulls(jsonb_build_object(
        'r', coalesce((p.folded->>'r')::int, 0) + coalesce((s->>'r')::int, 0),
        'clean', nullif(coalesce((p.folded->>'clean')::int, 0) + coalesce((s->>'clean')::int, 0), 0),
        'two', nullif(coalesce((p.folded->>'two')::int, 0) + coalesce((s->>'two')::int, 0), 0),
        'riddle', nullif(coalesce((p.folded->>'riddle')::int, 0) + coalesce((s->>'riddle')::int, 0), 0),
        'cold', nullif(coalesce((p.folded->>'cold')::int, 0) + coalesce((s->>'cold')::int, 0), 0),
        'streak', nullif(greatest(coalesce((p.folded->>'streak')::int, 0), coalesce((s->>'streak')::int, 0)), 0),
        'stars3', coalesce(s->'stars3', p.folded->'stars3'))) end,
      updated_at = now()
    where p.id = pl.id;
    delete from public.play_items i where i.play_id = pl.id and i.outcome = 'right';
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.fold_old_items(int) from public, anon, authenticated;

select cron.unschedule('fold-old-items') where exists (select 1 from cron.job where jobname = 'fold-old-items');
select cron.schedule('fold-old-items', '50 1 * * *', $$select public.fold_old_items(60)$$);
