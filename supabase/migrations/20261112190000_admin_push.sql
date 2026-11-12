-- Admin push to every phone (Yazan 2026-11-12):
--   'update': "Announce update", a tap opens the store page for that phone (Google Play or the App Store). Sent to
--             every phone, because an update matters even to players who turned reminders off.
--   'news':   "Send notification", Yazan types the title and text. Honours the Reminders switch in Settings.
-- Every send is logged in admin_push_log so the Admin page can show the last ones.

create table if not exists public.admin_push_log (
  id bigserial primary key,
  kind text not null,
  title text not null,
  body text not null,
  phones int not null default 0,
  at timestamptz not null default now()
);
alter table public.admin_push_log enable row level security;
revoke all on public.admin_push_log from anon, authenticated;

create or replace function public.admin_push_all(kind text, title text, body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
      'to', d.token, 'title', t, 'body', b, 'sound', 'default', 'channelId', 'default',
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
end $$;
revoke execute on function public.admin_push_all(text, text, text) from public, anon;
grant execute on function public.admin_push_all(text, text, text) to authenticated;

create or replace function public.admin_push_sent() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('kind', l.kind, 'title', l.title, 'body', l.body, 'phones', l.phones, 'at', l.at) order by l.at desc)
                   from (select * from public.admin_push_log order by at desc limit 10) l), '[]');
end $$;
revoke execute on function public.admin_push_sent() from public, anon;
grant execute on function public.admin_push_sent() to authenticated;
