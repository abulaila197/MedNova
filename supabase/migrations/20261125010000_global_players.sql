-- Global mission (Yazan 2026-11-25): the 100k bar counts real signed-up players, worked out by the server on the 1st of
-- every month (Cairo time) for everyone. Nobody types the number any more: the admin box and admin_set_downloads go.
-- The row keeps its old key 'downloads' so phones on older builds still read it.

drop function if exists public.admin_set_downloads(bigint);

-- Real players: confirmed accounts that are not guests, not deleted.
create or replace function public.global_players_refresh() returns bigint
language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  select count(*) into n from auth.users u
   where u.confirmed_at is not null and not coalesce(u.is_anonymous, false) and u.deleted_at is null;
  update public.app_stats set value = n, updated_at = now(),
    reached_at = coalesce(reached_at, case when n >= 100000 then now() end) where key = 'downloads';
  return n;
end $$;
revoke all on function public.global_players_refresh() from public, anon, authenticated;

-- The job runs every night at 22:05 UTC (00:05 Cairo) and only counts when it is the 1st in Cairo.
create or replace function public.global_players_monthly() returns void
language plpgsql security definer set search_path = public as $$
begin
  if extract(day from (now() at time zone 'Africa/Cairo')) = 1 then perform public.global_players_refresh(); end if;
end $$;
revoke all on function public.global_players_monthly() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'global-players';
select cron.schedule('global-players', '5 22 * * *', 'select public.global_players_monthly()');

-- First count now, so the bar is right from today.
select public.global_players_refresh() as players_now;
