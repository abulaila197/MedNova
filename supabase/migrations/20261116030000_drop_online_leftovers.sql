-- MedNova (2026-11-16): remove the last pieces of the old online play (Yazan's OK). Checked first: no app build since
-- Nov 8 (Android 4-8, iPhone 5-9), no edge function and no other server function uses any of them, except the
-- billing-month date the usage guard read from online_meter_conf: it now lives in usage_month_start itself.
-- Safe to paste twice.

-- 1. Usage guard keeps its month: Supabase's cycle starts on the 6th, Cairo time (same values as online_meter_conf).
create or replace function public.usage_month_start() returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare lnow timestamp; cs timestamp;
begin
  lnow := now() at time zone 'Africa/Cairo';
  cs := date_trunc('month', lnow) + interval '5 days';
  if cs > lnow then cs := date_trunc('month', lnow) - interval '1 month' + interval '5 days'; end if;
  return cs at time zone 'Africa/Cairo';
end $$;

-- 2. Online helper functions (every version of each name).
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'online_status', 'online_meter', 'online_locked', 'admin_online_lock',
      'race_conf', 'race_count', 'race_state_greens', 'nm_marks', 'room_cap', 'room_player_character',
      'dp_points', 'cw_cells', 'cf_dd_score', 'cf_dd_score2', 'wc_mask', 'wc_mask_hands')
  loop
    execute format('drop function if exists %s', f.sig);
  end loop;
end $$;

-- 3. Old room invites (with their 2 push alarms) and the online switch / meter tables.
drop trigger if exists push_invites on public.invites;
drop trigger if exists push_on_invite on public.invites;
drop function if exists public.push_invite();
drop function if exists public.push_on_invite();
drop table if exists public.invites;
drop table if exists public.online_locks;
drop table if exists public.online_meter_conf;

-- 4. Admin "online now" count matches the app's new 5-minute presence ping (was 2 minutes).
do $$
declare d text := pg_get_functiondef('public.admin_players_summary'::regproc);
begin
  if d like '%interval ''2 minutes''%' then execute replace(d, 'interval ''2 minutes''', 'interval ''6 minutes'''); end if;
end $$;

-- Check: the usage guard still has its month (should be the 6th) and nothing old is left (0).
select public.usage_month_start() as month_start,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
     and p.proname in ('online_status','online_meter','race_conf','room_cap','push_invite','wc_mask')) as old_functions_left,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'
     and c.relname in ('invites','online_locks','online_meter_conf')) as old_tables_left;
