-- Offline collecting (Yazan 2026-11-16): a daily reward collected offline reaches the server later, so a claim may now
-- be for a day up to 3 days back. A day is still paid once, never before a day already paid, never in the future,
-- and at most 2 days' rewards are paid in any 24 hours, so changing the phone's date can't farm rewards.
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
  if local_date not between (now() at time zone 'utc' - interval '14 hours' - interval '3 days')::date and (now() at time zone 'utc' + interval '14 hours')::date then
    return jsonb_build_object('ok', false, 'why', 'date');
  end if;
  if exists (select 1 from public.wallet_ledger where user_id = uid and kind = 'daily' and reason >= 'day:' || local_date::text) then
    return jsonb_build_object('ok', false, 'why', 'done');
  end if;
  if (select count(*) from public.wallet_ledger where user_id = uid and kind = 'daily' and at > now() - interval '24 hours') >= 2 then
    return jsonb_build_object('ok', false, 'why', 'date');
  end if;
  select count(*) into n from public.wallet_ledger where user_id = uid and kind = 'daily';
  d := (n % 30) + 1;
  tok := public.daily_prize(d);
  sp := public.daily_sparks(d, local_date);
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, note, at)
  values ('d' || replace(gen_random_uuid()::text, '-', ''), uid, 'daily', 0, tok, 'day:' || local_date::text, 'calendar day ' || d, now());
  if sp > 0 then perform public.sparks_add(uid, sp, 'daily', 'day:' || local_date::text); end if;
  return jsonb_build_object('ok', true, 'day', d, 'tokens', tok, 'sparks', sp);
end $function$;
