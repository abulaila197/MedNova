-- Daily reward x2 and Sparks (Yazan, 2026-10-25): tokens 2 and 4 alternating, every 7th calendar day 6, day 30 20.
-- Every 7th calendar day also gives 20 Sparks and day 30 50 Sparks; a claim on a real weekend day (Friday or
-- Saturday, by the phone's date) adds 10 Sparks. Mirrors src/features/daily/prizes.ts.

create or replace function public.daily_prize(day integer)
 returns integer
 language sql
 immutable
 set search_path to ''
as $function$
  select case when day = 30 then 20 when day % 7 = 0 then 6 when day % 2 = 1 then 2 else 4 end
$function$;

create or replace function public.daily_sparks(day integer, local_date date)
 returns integer
 language sql
 immutable
 set search_path to ''
as $function$
  select case when day = 30 then 50 when day % 7 = 0 then 20 else 0 end
    + case when extract(isodow from local_date) in (5, 6) then 10 else 0 end
$function$;

alter table public.sparks_log drop constraint if exists sparks_log_kind_check;
alter table public.sparks_log add constraint sparks_log_kind_check check (kind in ('spend', 'ad', 'buy', 'grant', 'daily'));

create or replace function public.daily_claim(local_date date)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  n int; d int; tok int; sp int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('daily:' || uid::text));
  if local_date not between (now() at time zone 'utc' - interval '14 hours')::date and (now() at time zone 'utc' + interval '14 hours')::date then
    return jsonb_build_object('ok', false, 'why', 'date');
  end if;
  select count(*) into n from public.wallet_ledger where user_id = uid and kind = 'daily';
  if exists (select 1 from public.wallet_ledger where user_id = uid and kind = 'daily' and reason >= 'day:' || local_date::text) then
    return jsonb_build_object('ok', false, 'why', 'done');
  end if;
  d := (n % 30) + 1;
  tok := public.daily_prize(d);
  sp := public.daily_sparks(d, local_date);
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, note, at)
  values ('d' || replace(gen_random_uuid()::text, '-', ''), uid, 'daily', 0, tok, 'day:' || local_date::text, 'calendar day ' || d, now());
  if sp > 0 then perform public.sparks_add(uid, sp, 'daily', 'day:' || local_date::text); end if;
  return jsonb_build_object('ok', true, 'day', d, 'tokens', tok, 'sparks', sp);
end $function$;

revoke all on function public.daily_sparks(integer, date) from public, anon, authenticated;
