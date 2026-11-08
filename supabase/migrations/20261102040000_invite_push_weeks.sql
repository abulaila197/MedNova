-- Group 7 (Yazan 2026-11-02).
-- 1) Invites by push: each player gets a private line 'user:<id>'. A new or changed challenge to you sends a tiny
--    'changed' signal on it; the phone then fetches its invites once. Only you can listen to your line. Phones keep a
--    slow 60 s backup check, so a missed signal only means a short wait.
-- 2) Online weeks follow the Supabase month (Yazan's pick): weeks start on the 6th, 13th, 20th and 27th; the last
--    stretch runs to the next 6th.

create or replace function public.push_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.push_ping('user:' || (case when tg_op = 'DELETE' then old.to_user else new.to_user end));
  return null;
end;
$$;
revoke all on function public.push_invite() from public, anon, authenticated;

drop trigger if exists push_invites on public.invites;
create trigger push_invites after insert or update of status or delete on public.invites
  for each row execute function public.push_invite();

drop policy if exists "mednova members hear their lines" on realtime.messages;
create policy "mednova members hear their lines" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (
      (realtime.topic() ~ '^match:[0-9a-f-]{36}$' and public.is_match_member(substr(realtime.topic(), 7)::uuid))
      or (realtime.topic() ~ '^room:[0-9a-f-]{36}$' and public.is_room_member(substr(realtime.topic(), 6)::uuid))
      or (realtime.topic() = 'user:' || auth.uid()::text)
    )
  );

CREATE OR REPLACE FUNCTION public.online_meter()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c public.online_meter_conf;
  lnow timestamp; cs timestamp; ce timestamp; ws timestamp; we timestamp;
  month_bytes numeric; allow numeric; used numeric; used_week numeric; week_share numeric;
begin
  select * into c from public.online_meter_conf where id = 1;
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
  return jsonb_build_object(
    'open', used < allow,
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
    'monthly_gb', c.monthly_gb
  );
end;
$function$;

select 'group 7 ready' as done;
