-- App fixes group 2 (Yazan, 2026-10-31): Inbox, gifts and the admin page.
-- #20/#30: a Style shop gift from a friend also lands in the friend's Inbox, showing who sent it (nothing to collect:
--          the item is already theirs). Admin messages show "From the MedNova team" in the app.
-- #2:  Clear on a sent message hides it from the admin list only (Yazan's pick); players keep it.
-- #51: the admin list returns each message's text and recipient, so Reuse can fill the Send form.

alter table public.inbox_messages add column if not exists from_user uuid references public.profiles (id) on delete set null;
alter table public.inbox_messages add column if not exists item text;
alter table public.inbox_messages add column if not exists admin_hidden boolean not null default false;

create or replace function public.inbox_list() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'title', m.title, 'body', m.body, 'tokens', m.tokens, 'sparks', m.sparks, 'chest', m.chest, 'chests', m.chests,
      'at', m.created_at, 'read', c.read_at is not null, 'collected', c.collected_at is not null,
      'item', m.item,
      'from', case when m.from_user is null then null else jsonb_build_object(
        'id', m.from_user,
        'name', coalesce((select coalesce(nullif(p.display_name, ''), p.username::text) from public.profiles p where p.id = m.from_user), 'A friend'),
        'avatar', (select p.avatar from public.profiles p where p.id = m.from_user)) end)
    order by m.created_at desc), '[]'::jsonb)
  from public.inbox_for(auth.uid()) m
  left join public.inbox_claims c on c.message_id = m.id and c.user_id = auth.uid()
  where c.cleared_at is null
$$;

create or replace function public.admin_inbox_sent() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when not public.is_admin() then '[]'::jsonb else coalesce((select jsonb_agg(x order by x->>'at' desc) from (
    select jsonb_build_object('id', m.id, 'title', m.title, 'body', m.body, 'tokens', m.tokens, 'sparks', m.sparks, 'chest', m.chest, 'chests', m.chests, 'at', m.created_at,
      'target', m.target,
      'to', coalesce((select p.username::text from public.profiles p where p.id = m.target), case when m.target is null then null else '?' end),
      'to_name', (select p.display_name from public.profiles p where p.id = m.target),
      'to_avatar', (select p.avatar from public.profiles p where p.id = m.target),
      'read', (select count(*) from public.inbox_claims c where c.message_id = m.id and c.read_at is not null),
      'collected', (select count(*) from public.inbox_claims c where c.message_id = m.id and c.collected_at is not null)) x
    from public.inbox_messages m
    where not m.admin_hidden and m.from_user is null
    order by m.created_at desc limit 50) q), '[]'::jsonb) end
$$;

create or replace function public.admin_inbox_hide(msg uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  update public.inbox_messages set admin_hidden = true where id = msg and from_user is null;
end $$;

-- style_buy as live (prizes_500), plus the Inbox message for a gift.
create or replace function public.style_buy(item text, gift_to uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare uid uuid := auth.uid(); target uuid := coalesce(gift_to, auth.uid()); cost int := public.style_cost(item); bal int; prize int := 0;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if cost is null or cost = 0 then return jsonb_build_object('ok', false, 'why', 'not sold'); end if;
  if gift_to is not null and (gift_to = uid or not exists (select 1 from public.friendships f
      where f.status = 'accepted' and f.user_a = least(uid, gift_to) and f.user_b = greatest(uid, gift_to))) then
    return jsonb_build_object('ok', false, 'why', 'not friends');
  end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || uid::text));
  if item = any (public.style_owned_all(target)) then return jsonb_build_object('ok', false, 'why', 'owned'); end if;
  bal := (public.wallet_balance(uid)->>'tokens')::int;
  if bal < cost then return jsonb_build_object('ok', false, 'why', 'tokens', 'need', cost - bal); end if;
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, note, at)
  values ('s' || replace(gen_random_uuid()::text, '-', ''), uid, 'spend', 0, -cost,
          case when gift_to is null then 'style:' || item else 'gift:' || item || ':' || gift_to end, null, now());
  insert into public.style_owned (user_id, item, from_user, seen) values (target, item, case when gift_to is null then null else uid end, gift_to is null);
  if gift_to is not null then
    insert into public.inbox_messages (target, title, body, from_user, item, created_by)
    values (gift_to, 'A gift for you', '', uid, item, uid);
  end if;
  if item like 'robot:%'
     and (select count(distinct o.item) from public.style_owned o where o.user_id = target
          and o.item in ('robot:bloop', 'robot:pixel', 'robot:nimbus', 'robot:ember', 'robot:zenith')) = 5
     and not exists (select 1 from public.wallet_ledger where user_id = target and reason = 'robots:prize') then
    perform pg_advisory_xact_lock(hashtext('robots:' || target::text));
    if not exists (select 1 from public.wallet_ledger where user_id = target and reason = 'robots:prize') then
      perform public.pay_free(target, 'chest', 500, 'robots:prize', 'Style robots complete');
      prize := case when gift_to is null then 500 else 0 end;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'cost', cost, 'prize', prize);
end $function$;

revoke all on function public.admin_inbox_hide(uuid) from public, anon;
grant execute on function public.admin_inbox_hide(uuid) to authenticated;
