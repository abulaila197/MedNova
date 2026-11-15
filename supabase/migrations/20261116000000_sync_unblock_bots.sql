-- MedNova fix A1 (2026-11-16): phones that played a Vs rivals match could not save anything any more.
-- Cause: the plays table only accepted the modes solo / offline / online. Vs rivals games are saved as 'bots',
-- so the server refused them, and that one refusal stopped the whole sync on the phone: no games, no tokens,
-- no rewards went up or came down from then on (e.g. the "استلم" button that stayed).
-- Safe to paste any time, safe to paste twice.

-- 1. Accept Vs rivals games.
alter table public.plays drop constraint if exists plays_mode_check;
alter table public.plays add constraint plays_mode_check check (mode in ('solo', 'offline', 'online', 'bots'));

-- 2. "Online" dot: touch_seen still called the old rooms clean-up that was removed with online play, so it failed
--    every time and nobody was ever marked online.
create or replace function public.touch_seen()
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set last_seen = now() where id = (select auth.uid());
end $$;
revoke all on function public.touch_seen() from public, anon;
grant execute on function public.touch_seen() to authenticated;

-- 3. Fewer server runs (plan item 13): friend challenges settle hourly instead of every 15 minutes,
--    and the timer log keeps 1 day instead of 2.
select cron.alter_job((select jobid from cron.job where jobname = 'challenge-tick'), schedule := '7 * * * *');
select cron.alter_job((select jobid from cron.job where jobname = 'trim-job-logs'),
  command := $c$delete from cron.job_run_details where end_time < now() - interval '1 day'$c$);

-- Check: should show 'bots' in the list and the two new schedules.
select pg_get_constraintdef(oid) from pg_constraint where conname = 'plays_mode_check';
select jobname, schedule, command from cron.job where jobname in ('challenge-tick', 'trim-job-logs');
