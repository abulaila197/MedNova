-- S5 / DEF-061 (Yazan 2026-10-18/19): guest Contact and Report = 3 a day per device, and at most 100 a day from
-- all guests together. The app sends a random install id as `device`; a guest call without a usable id lands in
-- one shared '-' bucket. Signed-in caps are unchanged (20 contact, 30 report). A report's context is capped at
-- 8 KB. The id is chosen by the phone, so this stops floods and casual abuse, not a determined attacker.
-- (Merged with the 100/day ceiling; written without DROP FUNCTION, which the MCP apply can't run: the new
-- 3/4-argument functions are separate overloads with no defaults, and the old signatures now forward to them.)
alter table public.contact_messages add column if not exists guest_device text;
alter table public.reports add column if not exists guest_device text;
create index if not exists contact_messages_guest_device_idx on public.contact_messages (guest_device, created_at) where guest_device is not null;
create index if not exists reports_guest_device_idx on public.reports (guest_device, created_at) where guest_device is not null;

create or replace function public.submit_contact(kind text, body text, device text)
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
    -- Ceiling across all guests together, so new device ids can't flood the inbox.
    perform pg_advisory_xact_lock(hashtext('guest-contact:all'));
    if (select count(*) from public.contact_messages c where c.user_id is null and c.created_at > now() - interval '1 day') >= 100 then
      raise exception 'too many';
    end if;
  end if;
  insert into public.contact_messages (user_id, kind, body, guest_device)
  values (auth.uid(), left(coalesce(kind, 'General'), 40), left(trim(body), 3000), dev) returning id into rid;
  return rid;
end $function$;

create or replace function public.submit_report(kind text, body text, context jsonb, device text)
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
    perform pg_advisory_xact_lock(hashtext('guest-report:all'));
    if (select count(*) from public.reports r where r.user_id is null and r.created_at > now() - interval '1 day') >= 100 then
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

-- Old builds (no device argument) share the '-' guest bucket.
create or replace function public.submit_contact(kind text, body text)
returns uuid language sql security definer set search_path to 'public' as $function$
  select public.submit_contact(kind, body, null::text);
$function$;

create or replace function public.submit_report(kind text, body text, context jsonb)
returns uuid language sql security definer set search_path to 'public' as $function$
  select public.submit_report(kind, body, context, null::text);
$function$;
