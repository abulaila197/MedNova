-- Guest Contact and Report: on top of 3 a day per device, at most 100 a day from all guests together (each
-- function its own ceiling). Same functions as 20261018230300 with the extra check; signed-in limits unchanged.
create or replace function public.submit_contact(kind text, body text, device text default null)
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

create or replace function public.submit_report(kind text, body text, context jsonb, device text default null)
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
