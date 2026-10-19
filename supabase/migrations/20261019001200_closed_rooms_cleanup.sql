-- 30-day cleanup (Yazan 2026-10-19): every night, delete CLOSED rooms whose last change is older than 30 days,
-- with their matches and room talk. Player results kept elsewhere are untouched: plays, play_items, the wallet,
-- profiles (EXP) and progress have no foreign key to rooms or matches.
--
-- Deleting a room cascades to room_players, invites, room_messages (room talk) and matches; deleting a match
-- cascades to match_players, dp_case_results, sa_turns, wc_games, wc_swipes, cq_games, cq_views, tmn_games and
-- tmn_views. race_results and cw_claims had no ON DELETE action and would block the delete, so they cascade too.
alter table public.race_results drop constraint race_results_match_id_fkey;
alter table public.race_results add constraint race_results_match_id_fkey foreign key (match_id) references public.matches(id) on delete cascade;
alter table public.cw_claims drop constraint cw_claims_match_id_fkey;
alter table public.cw_claims add constraint cw_claims_match_id_fkey foreign key (match_id) references public.matches(id) on delete cascade;

create or replace function public.cleanup_closed_rooms()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare n integer;
begin
  delete from public.rooms
    where status = 'closed' and coalesce(updated_at, created_at) < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.cleanup_closed_rooms() from public, anon, authenticated;

-- pg_cron is available on this project but not yet installed (checked 2026-10-19).
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

-- 03:17 UTC every night; scheduling under the same name again replaces the job.
select cron.schedule('cleanup-closed-rooms', '17 3 * * *', $$select public.cleanup_closed_rooms()$$);
