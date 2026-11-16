-- MedNova 2026-11-16: send every notification at HIGH priority so Android delivers it at once, even when the phone
-- is idle (normal priority waits for Android's battery batches, which made Inbox notifications arrive late).
-- Changes only the two senders: each message gets 'priority','high'. Paste in Supabase > SQL Editor > Run.

CREATE OR REPLACE FUNCTION public.push_send(uids uuid[], kind text, title text, body text, title_ar text, body_ar text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  is_social boolean := kind in ('friend', 'invite', 'inbox', 'challenge');
  msgs jsonb;
  sent int := 0;
  part jsonb;
  i int := 0;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'to', d.token,
      'title', left(case when d.lang = 'ar' and nullif(title_ar, '') is not null then title_ar else title end, 60),
      'body', left(case when d.lang = 'ar' and nullif(body_ar, '') is not null then body_ar else body end, 160),
      'sound', 'default', 'channelId', 'default', 'priority', 'high', 'data', jsonb_build_object('kind', kind))), '[]'::jsonb)
    into msgs
  from public.push_devices d
  left join public.push_prefs p on p.user_id = d.user_id
  where d.user_id = any (uids)
    and case when is_social then coalesce(p.social, true) else coalesce(p.reminders, true) end;
  if jsonb_array_length(msgs) = 0 then return 0; end if;
  while i < jsonb_array_length(msgs) loop
    select jsonb_agg(m) into part from (select m from jsonb_array_elements(msgs) with ordinality as x(m, o) where o > i and o <= i + 100) q;
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := part,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'));
    i := i + 100;
  end loop;
  insert into public.push_sent (user_id, kind)
  select distinct d.user_id, kind from public.push_devices d where d.user_id = any (uids);
  get diagnostics sent = row_count;
  return sent;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_push_all(kind text, title text, body text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  msgs jsonb;
  part jsonb;
  i int := 0;
  n int;
  t text := left(trim(coalesce(admin_push_all.title, '')), 60);
  b text := left(trim(coalesce(admin_push_all.body, '')), 160);
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if admin_push_all.kind not in ('update', 'news') then raise exception 'kind'; end if;
  if t = '' or b = '' then raise exception 'empty'; end if;
  -- A double tap must not send twice: one send per minute.
  if exists (select 1 from public.admin_push_log l where l.at > now() - interval '1 minute') then raise exception 'too_soon'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'to', d.token, 'title', t, 'body', b, 'sound', 'default', 'channelId', 'default', 'priority', 'high',
      'data', jsonb_build_object('kind', admin_push_all.kind, 'url',
        case when admin_push_all.kind <> 'update' then null
             when d.platform = 'ios' then 'https://apps.apple.com/app/id6831704683'
             else 'https://play.google.com/store/apps/details?id=com.novagames.mednova' end))), '[]'::jsonb)
    into msgs
  from public.push_devices d
  left join public.push_prefs p on p.user_id = d.user_id
  where admin_push_all.kind = 'update' or coalesce(p.reminders, true);
  n := jsonb_array_length(msgs);
  while i < n loop
    select jsonb_agg(m) into part from (select m from jsonb_array_elements(msgs) with ordinality as x(m, o) where o > i and o <= i + 100) q;
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := part,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'));
    i := i + 100;
  end loop;
  insert into public.admin_push_log (kind, title, body, phones) values (admin_push_all.kind, t, b, n);
  return jsonb_build_object('phones', n);
end $function$;
