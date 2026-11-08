-- 99% usage guard (Yazan 2026-11-02): always keep 1% of the free plan unused.
--
-- Every hour the server reads three real numbers: database size, stored files and this month's signed-in players.
-- If any of them reaches 99% of its free limit, online play (new rooms, joins, match starts, all of which ask
-- online_meter) rests until the 6th, when Supabase's usage month restarts. Solo games keep working.
-- The lock lifts by itself when a later check is back under 99%, or when the new month starts (the next hourly
-- check decides again). Data transfer is not readable by the server, so it keeps the online_share estimate.

create table if not exists public.usage_guard (
  id int primary key default 1 check (id = 1),
  db_limit_mb numeric not null default 500,
  files_limit_mb numeric not null default 1024,
  signins_limit int not null default 50000,
  stop_at numeric not null default 0.99 check (stop_at > 0 and stop_at <= 1),
  db_mb numeric not null default 0,
  files_mb numeric not null default 0,
  signins int not null default 0,
  locked boolean not null default false,
  checked_at timestamptz
);
alter table public.usage_guard enable row level security;
insert into public.usage_guard (id) values (1) on conflict (id) do nothing;

-- Start of the current Supabase usage month (the 6th, Cairo time), as a timestamptz.
create or replace function public.usage_month_start()
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare c public.online_meter_conf; lnow timestamp; cs timestamp;
begin
  select * into c from public.online_meter_conf where id = 1;
  lnow := now() at time zone c.tz;
  cs := date_trunc('month', lnow) + make_interval(days => c.cycle_day - 1);
  if cs > lnow then cs := date_trunc('month', lnow) - interval '1 month' + make_interval(days => c.cycle_day - 1); end if;
  return cs at time zone c.tz;
end;
$$;

create or replace function public.check_usage_guard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare g public.usage_guard; cs timestamptz; d numeric; f numeric; s int;
begin
  select * into g from public.usage_guard where id = 1;
  cs := public.usage_month_start();
  d := pg_database_size(current_database()) / 1048576.0;
  f := coalesce((select sum((o.metadata ->> 'size')::bigint) from storage.objects o), 0) / 1048576.0;
  -- Players who signed in or kept their session alive this usage month.
  s := (select count(*) from (
          select u.id from auth.users u where u.last_sign_in_at >= cs
          union
          select se.user_id from auth.sessions se where coalesce(se.refreshed_at, se.updated_at, se.created_at) >= cs
        ) x);
  update public.usage_guard set
    db_mb = round(d, 1), files_mb = round(f, 1), signins = s,
    locked = d >= g.db_limit_mb * g.stop_at or f >= g.files_limit_mb * g.stop_at or s >= g.signins_limit * g.stop_at,
    checked_at = now()
  where id = 1
  returning * into g;
  return to_jsonb(g);
end;
$$;
revoke all on function public.check_usage_guard() from public, anon, authenticated;
revoke all on function public.usage_month_start() from public, anon, authenticated;

-- The online meter, now also closed while the guard is locked (a lock from an earlier month doesn't count).
CREATE OR REPLACE FUNCTION public.online_meter()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c public.online_meter_conf;
  g public.usage_guard;
  lnow timestamp; cs timestamp; ce timestamp; ws timestamp; we timestamp;
  month_bytes numeric; allow numeric; used numeric; used_week numeric; week_share numeric;
  hit boolean;
begin
  select * into c from public.online_meter_conf where id = 1;
  select * into g from public.usage_guard where id = 1;
  lnow := now() at time zone c.tz;
  cs := date_trunc('month', lnow) + make_interval(days => c.cycle_day - 1);
  if cs > lnow then cs := date_trunc('month', lnow) - interval '1 month' + make_interval(days => c.cycle_day - 1); end if;
  ce := cs + interval '1 month';
  -- Weeks count from the month's start day (the 6th): 6th, 13th, 20th, 27th; the 4th runs to the next 6th.
  ws := cs + make_interval(days => 7 * least(3, floor(extract(epoch from (lnow - cs)) / 604800)::int));
  we := case when ws >= cs + interval '21 days' then ce else ws + interval '7 days' end;
  if ws < cs then ws := cs; end if;
  if we > ce then we := ce; end if;
  month_bytes := c.monthly_gb * 1073741824 * c.online_share;
  -- Everything handed out from the start of the month to the end of this week (so unused weeks carry over).
  allow := month_bytes * extract(epoch from (we - cs)) / extract(epoch from (ce - cs));
  week_share := month_bytes * extract(epoch from (we - ws)) / extract(epoch from (ce - cs));
  used := public.online_player_seconds(cs at time zone c.tz) * c.bytes_per_sec;
  used_week := public.online_player_seconds(ws at time zone c.tz) * c.bytes_per_sec;
  -- 99% guard: a lock from this usage month closes online until the month restarts.
  hit := coalesce(g.locked and g.checked_at >= (cs at time zone c.tz), false);
  if hit then we := ce; end if;
  return jsonb_build_object(
    'open', used < allow and not hit,
    'resumes_at', we at time zone c.tz,
    'resumes_day', trim(to_char(we, 'FMDay')) || ' ' || to_char(we, 'FMDD Mon'),
    'month_start', cs at time zone c.tz,
    'month_end', ce at time zone c.tz,
    'week_start', ws at time zone c.tz,
    'month_online_mb', round(month_bytes / 1048576),
    'week_share_mb', round(week_share / 1048576),
    'allowed_so_far_mb', round(allow / 1048576),
    'used_month_mb', round(used / 1048576),
    'used_week_mb', round(used_week / 1048576),
    'left_mb', round(greatest(0, allow - used) / 1048576),
    'left_hours', round(greatest(0, allow - used) / c.bytes_per_sec / 3600),
    'online_share', c.online_share,
    'monthly_gb', c.monthly_gb,
    'guard', jsonb_build_object(
      'hit', hit, 'checked_at', g.checked_at, 'stop_at', g.stop_at,
      'db_mb', g.db_mb, 'db_limit_mb', g.db_limit_mb,
      'files_mb', g.files_mb, 'files_limit_mb', g.files_limit_mb,
      'signins', g.signins, 'signins_limit', g.signins_limit)
  );
end;
$function$;

-- Every hour, at minute 5.
select cron.unschedule('usage-guard') where exists (select 1 from cron.job where jobname = 'usage-guard');
select cron.schedule('usage-guard', '5 * * * *', 'select public.check_usage_guard()');

select public.check_usage_guard() as usage_guard_ready;
