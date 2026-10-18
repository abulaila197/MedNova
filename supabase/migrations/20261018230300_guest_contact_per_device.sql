-- S5 / DEF-061 (Yazan 2026-10-18: guest cap = per device, 3 per day).
-- Guests (signed out) used to share ONE 50/day bucket for Contact and for Report, so one script could
-- lock every guest out. Now each guest device has its own 3/day bucket per form. The app sends a random
-- install id as `device`; a guest call without a usable id lands in one shared '-' bucket (3/day), so old
-- builds keep working but cannot flood. Rows of deleted accounts (user_id set null later) have no
-- guest_device and no longer count against guests. Signed-in caps are unchanged (20 contact, 30 report).
-- Also: a report's context is capped at 8 KB (bigger contexts are replaced by a short stub).
-- Note: the id is chosen by the phone, so a script can rotate ids; this stops accidental floods and
-- casual abuse, not a determined attacker.
alter table public.contact_messages add column if not exists guest_device text;
alter table public.reports add column if not exists guest_device text;
create index if not exists contact_messages_guest_device_idx on public.contact_messages (guest_device, created_at) where guest_device is not null;
create index if not exists reports_guest_device_idx on public.reports (guest_device, created_at) where guest_device is not null;

drop function if exists public.submit_contact(text, text);
create function public.submit_contact(kind text, body text, device text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare rid uuid; dev text;
begin
  if length(trim(coalesce(body, ''))) < 2 then raise exception 'empty'; end if;
  if auth.uid() is not null then
    if (select count(*) from public.contact_messages c where c.user_id = auth.uid() and c.created_at > now() - interval '1 day') >= 20 then
      raise exception 'too many';
    end if;
  else
    dev := case when device ~ '^[A-Za-z0-9_-]{8,64}$' then device else '-' end;
    perform pg_advisory_xact_lock(hashtext('guest-contact:' || dev));
    if (select count(*) from public.contact_messages c where c.guest_device = dev and c.created_at > now() - interval '1 day') >= 3 then
      raise exception 'too many';
    end if;
  end if;
  insert into public.contact_messages (user_id, kind, body, guest_device)
  values (auth.uid(), left(coalesce(kind, 'General'), 40), left(trim(body), 3000), dev) returning id into rid;
  return rid;
end $function$;

drop function if exists public.submit_report(text, text, jsonb);
create function public.submit_report(kind text, body text, context jsonb, device text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare rid uuid; dev text; ctx jsonb := coalesce(context, '{}'::jsonb);
begin
  if kind not in ('Medical content', 'Game', 'Technical', 'Other') then raise exception 'kind'; end if;
  if auth.uid() is not null then
    if (select count(*) from public.reports r where r.user_id = auth.uid() and r.created_at > now() - interval '1 day') >= 30 then
      raise exception 'too many';
    end if;
  else
    dev := case when device ~ '^[A-Za-z0-9_-]{8,64}$' then device else '-' end;
    perform pg_advisory_xact_lock(hashtext('guest-report:' || dev));
    if (select count(*) from public.reports r where r.guest_device = dev and r.created_at > now() - interval '1 day') >= 3 then
      raise exception 'too many';
    end if;
  end if;
  if jsonb_typeof(ctx) <> 'object' or octet_length(ctx::text) > 8192 then
    ctx := jsonb_build_object('truncated', true, 'path', left(ctx->>'path', 200), 'game', left(ctx->>'game', 60));
  end if;
  insert into public.reports (user_id, kind, body, context, guest_device)
  values (auth.uid(), kind, left(coalesce(body, ''), 1000), ctx, dev)
  returning id into rid;
  return rid;
end $function$;

revoke all on function public.submit_contact(text, text, text) from public;
revoke all on function public.submit_report(text, text, jsonb, text) from public;
grant execute on function public.submit_contact(text, text, text) to anon, authenticated;
grant execute on function public.submit_report(text, text, jsonb, text) to anon, authenticated;
