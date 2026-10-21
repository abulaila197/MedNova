-- Yazan 2026-10-21: play-again ads 20 a day (Store token ads stay 5), Ambassador video pays 200,
-- Grand Rounds game weeks = 10 Online + 10 Solo or Pass the phone, and the daily reward opens as soon as the
-- phone's date turns (the old 20-hour gap blocked a claim just after midnight, so the pop-up kept coming back).

create or replace function public.ad_watched(source text)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare uid uuid := auth.uid(); per int := 1; cap int; today int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if source not in ('play', 'store') then raise exception 'source'; end if;
  cap := case when source = 'play' then 20 else 5 end;
  perform pg_advisory_xact_lock(hashtext('free:' || uid::text));
  select count(*) into today from public.ad_views a where a.user_id = uid and a.source = ad_watched.source and a.at >= date_trunc('day', now());
  if today >= cap then return jsonb_build_object('ok', false, 'why', 'cap'); end if;
  insert into public.ad_views (user_id, source) values (uid, ad_watched.source);
  if source = 'store' then
    perform public.pay_free(uid, 'free', per, 'free:ad:' || to_char(now(), 'YYYY-MM-DD') || ':' || (today + 1), 'Watched an ad');
    return jsonb_build_object('ok', true, 'tokens', per, 'left', cap - today - 1);
  end if;
  return jsonb_build_object('ok', true);
end $function$;

create or replace function public.admin_decide(what text, item uuid, ok boolean)
 returns void language plpgsql security definer set search_path to 'public' as $function$
declare v public.ambassador_videos;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if what = 'contact' then update public.contact_messages set status = case when ok then 'done' else 'new' end where id = item;
  elsif what = 'feedback' then update public.feedback set status = case when ok then 'done' else 'new' end where id = item;
  elsif what = 'stories' then update public.stories set status = case when ok then 'done' else 'new' end where id = item;
  elsif what = 'cases' then update public.custom_cases set status = case when ok then 'approved' else 'declined' end, decided_at = now() where id = item;
  elsif what = 'ambassador' then
    update public.ambassador_videos set status = case when ok then 'approved' else 'rejected' end, decided_at = now() where id = item returning * into v;
    if ok and v.user_id is not null and not exists (select 1 from public.wallet_ledger where user_id = v.user_id and reason = 'free:ambassador') then
      perform public.pay_free(v.user_id, 'free', 200, 'free:ambassador', 'Ambassador video approved');
    end if;
  else raise exception 'what';
  end if;
end $function$;

create or replace function public.rounds_parts(wk jsonb)
 returns jsonb language sql immutable set search_path to '' as $function$
  select case when wk->>'kind' = 'mode' then jsonb_build_array(jsonb_build_object('k', wk->>'mode', 'of', 60))
    when wk->>'game' in ('the-conqueror', 'trust-me-not') then jsonb_build_array(jsonb_build_object('k', 'online', 'of', 45))
    else jsonb_build_array(jsonb_build_object('k', 'online', 'of', 10), jsonb_build_object('k', 'local', 'of', 10)) end
$function$;

create or replace function public.rounds_progress(uid uuid, w integer)
 returns jsonb language sql stable security definer set search_path to '' as $function$
  with wk as (select public.rounds_week(w) j),
  fin as (
    select p.game, p.mode, p.score, p.standings from public.plays p
    where p.user_id = uid and p.status = 'finished' and not coalesce(p.settings ? 'custom', false)
      and p.ended_at >= timestamptz '2026-10-10 00:00:00+00' + w * interval '7 days'
      and p.ended_at < timestamptz '2026-10-10 00:00:00+00' + (w + 1) * interval '7 days'
  ),
  parts as (select e from wk, jsonb_array_elements(public.rounds_parts(wk.j)) e)
  select coalesce(jsonb_agg(jsonb_build_object('k', e->>'k', 'of', (e->>'of')::int, 'n', least((e->>'of')::int, (
    select count(*) from fin, wk where (fin.mode = e->>'k' or (e->>'k' = 'local' and fin.mode in ('solo', 'offline')))
      and case when wk.j->>'kind' = 'game' then fin.game = wk.j->>'game'
      else case when fin.mode = 'solo' then coalesce(fin.score, 0) > 0
        else jsonb_array_length(fin.standings) > 1 and fin.standings @> '[{"seat":0,"rank":1}]'::jsonb end end)::int))), '[]'::jsonb)
  from parts
$function$;

create or replace function public.daily_claim(local_date date)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  uid uuid := auth.uid();
  n int; d int; tok int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('daily:' || uid::text));
  -- The phone's date must be a real date somewhere on Earth right now, so a changed clock gains at most one day.
  if local_date not between (now() at time zone 'utc' - interval '14 hours')::date and (now() at time zone 'utc' + interval '14 hours')::date then
    return jsonb_build_object('ok', false, 'why', 'date');
  end if;
  select count(*) into n from public.wallet_ledger where user_id = uid and kind = 'daily';
  if exists (select 1 from public.wallet_ledger where user_id = uid and kind = 'daily' and reason >= 'day:' || local_date::text) then
    return jsonb_build_object('ok', false, 'why', 'done');
  end if;
  d := (n % 30) + 1;
  tok := public.daily_prize(d);
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, note, at)
  values ('d' || replace(gen_random_uuid()::text, '-', ''), uid, 'daily', 0, tok, 'day:' || local_date::text, 'calendar day ' || d, now());
  return jsonb_build_object('ok', true, 'day', d, 'tokens', tok);
end $function$;
