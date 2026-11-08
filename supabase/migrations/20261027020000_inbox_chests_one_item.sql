-- Phone test fixes (Yazan 2026-10-27):
-- * Inbox: the title and message are optional (a message can be just a gift), but something must be sent.
-- * Inbox: the admin can send several chests of one kind in one message (1 to 20).
-- * Inbox: "Clear messages" hides read messages whose gifts are collected (or that had none).
-- * Chests: every chest gives one item.

alter table public.inbox_messages drop constraint if exists inbox_messages_title_check;
alter table public.inbox_messages add constraint inbox_messages_title_check check (length(title) <= 80);
alter table public.inbox_messages alter column title set default '';
alter table public.inbox_messages add column if not exists chests int not null default 1 check (chests between 1 and 20);
alter table public.inbox_claims add column if not exists cleared_at timestamptz;

create or replace function public.inbox_list() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'title', m.title, 'body', m.body, 'tokens', m.tokens, 'sparks', m.sparks, 'chest', m.chest, 'chests', m.chests,
      'at', m.created_at, 'read', c.read_at is not null, 'collected', c.collected_at is not null)
    order by m.created_at desc), '[]'::jsonb)
  from public.inbox_for(auth.uid()) m
  left join public.inbox_claims c on c.message_id = m.id and c.user_id = auth.uid()
  where c.cleared_at is null
$$;

create or replace function public.inbox_waiting() returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.inbox_for(auth.uid()) m
  left join public.inbox_claims c on c.message_id = m.id and c.user_id = auth.uid()
  where c.cleared_at is null
    and (c.read_at is null
     or (c.collected_at is null and (m.tokens > 0 or m.sparks > 0 or m.chest is not null)))
$$;

-- Collect a message's gifts, once. Several chests land as one row each.
create or replace function public.inbox_collect(msg uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); m public.inbox_messages; i int; note text;
begin
  if uid is null then return jsonb_build_object('ok', false, 'why', 'guest'); end if;
  select * into m from public.inbox_for(uid) where id = msg;
  if m.id is null then return jsonb_build_object('ok', false, 'why', 'gone'); end if;
  perform pg_advisory_xact_lock(hashtext('inbox:' || uid::text));
  if exists (select 1 from public.inbox_claims where message_id = msg and user_id = uid and collected_at is not null) then
    return jsonb_build_object('ok', false, 'why', 'done');
  end if;
  note := coalesce(nullif(m.title, ''), 'Inbox gift');
  if m.tokens > 0 then
    insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, note, at)
    values ('i' || md5(msg::text || uid::text), uid, 'grant', 0, m.tokens, 'inbox:' || msg::text, left(note, 200), now());
  end if;
  if m.sparks > 0 then perform public.sparks_add(uid, m.sparks, 'grant', 'inbox ' || left(note, 180)); end if;
  if m.chest is not null then
    for i in 1..greatest(1, m.chests) loop
      insert into public.chest_earned (user_id, day, kind, src)
      values (uid, current_date, m.chest, 'inbox:' || msg::text || case when i > 1 then ':' || i else '' end);
    end loop;
  end if;
  insert into public.inbox_claims (message_id, user_id, read_at, collected_at) values (msg, uid, now(), now())
  on conflict (message_id, user_id) do update set read_at = coalesce(public.inbox_claims.read_at, now()), collected_at = now();
  return jsonb_build_object('ok', true, 'tokens', m.tokens, 'sparks', m.sparks, 'chest', m.chest, 'chests', m.chests);
end $$;

-- Clear messages: hides every read message with nothing left to collect.
create or replace function public.inbox_clear() returns int
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null then return 0; end if;
  update public.inbox_claims c set cleared_at = now()
    from public.inbox_for(uid) m
   where c.message_id = m.id and c.user_id = uid and c.cleared_at is null and c.read_at is not null
     and (c.collected_at is not null or not (m.tokens > 0 or m.sparks > 0 or m.chest is not null));
  get diagnostics n = row_count;
  return n;
end $$;

-- Admin send, now with a chest count; the title and message are optional, but something must be sent.
drop function if exists public.admin_inbox_send(uuid, text, text, int, int, text);
create or replace function public.admin_inbox_send(target uuid, title text, body text, tokens int, sparks int, chest text, chests int default 1) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t text := trim(coalesce(title, '')); b text := trim(coalesce(body, '')); k text := nullif(chest, ''); id uuid; n int;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if coalesce(tokens, 0) < 0 or coalesce(sparks, 0) < 0 then raise exception 'amount'; end if;
  if t = '' and b = '' and coalesce(tokens, 0) = 0 and coalesce(sparks, 0) = 0 and k is null then raise exception 'empty'; end if;
  if coalesce(chests, 1) not between 1 and 20 then raise exception 'chests'; end if;
  if target is null and (coalesce(tokens, 0) > 500 or coalesce(sparks, 0) > 500) then raise exception 'amount'; end if;
  if target is not null and not exists (select 1 from public.profiles where profiles.id = target) then raise exception 'no player'; end if;
  insert into public.inbox_messages (target, title, body, tokens, sparks, chest, chests, created_by)
  values (target, left(t, 80), left(b, 1000), coalesce(tokens, 0), coalesce(sparks, 0), k, coalesce(chests, 1), auth.uid())
  returning inbox_messages.id into id;
  select count(*) into n from public.profiles p where target is null or p.id = target;
  return jsonb_build_object('ok', true, 'id', id, 'players', n);
end $$;

create or replace function public.admin_inbox_sent() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when not public.is_admin() then '[]'::jsonb else coalesce((select jsonb_agg(x order by x->>'at' desc) from (
    select jsonb_build_object('id', m.id, 'title', m.title, 'tokens', m.tokens, 'sparks', m.sparks, 'chest', m.chest, 'chests', m.chests, 'at', m.created_at,
      'to', coalesce((select p.username::text from public.profiles p where p.id = m.target), case when m.target is null then null else '?' end),
      'read', (select count(*) from public.inbox_claims c where c.message_id = m.id and c.read_at is not null),
      'collected', (select count(*) from public.inbox_claims c where c.message_id = m.id and c.collected_at is not null)) x
    from public.inbox_messages m order by m.created_at desc limit 50) q), '[]'::jsonb) end
$$;

revoke all on function public.inbox_clear(), public.admin_inbox_send(uuid, text, text, int, int, text, int) from public, anon;
grant execute on function public.inbox_clear(), public.admin_inbox_send(uuid, text, text, int, int, text, int) to authenticated;

-- Every chest gives one item (was 1 / 2 / 3 / 3).
create or replace function public.chest_open(kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); n int; i int; roll numeric; acc numeric; rar text; odds jsonb := public.chest_odds(kind);
  o record; it record; own text[]; got jsonb := '[]'::jsonb; dupe boolean; pay int; open_id uuid := gen_random_uuid(); prize int := 0;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if odds is null then raise exception 'kind'; end if;
  perform pg_advisory_xact_lock(hashtext('chest:' || uid::text));
  if (public.chests_owned(uid)->>kind)::int < 1 then return jsonb_build_object('ok', false, 'why', 'none'); end if;
  n := 1;
  for i in 1..n loop
    roll := random() * 100; acc := 0; rar := null;
    for o in select k, (odds->>k)::numeric v from unnest(array['common','uncommon','rare','epic','legendary']) k where odds ? k loop
      acc := acc + o.v;
      if rar is null and roll < acc then rar := o.k; end if;
    end loop;
    rar := coalesce(rar, 'rare');
    select * into it from public.chest_items() c
      where c.rarity = rar and not (kind in ('wooden', 'golden') and c.stars = 5) order by random() limit 1;
    own := public.style_owned_all(uid);
    if it.key like 'tokens:%' then
      pay := split_part(it.key, ':', 2)::int; dupe := false;
    else
      dupe := it.key = any (own);
      pay := case when dupe then it.dupe else 0 end;
      if not dupe then insert into public.style_owned (user_id, item, seen) values (uid, it.key, true) on conflict do nothing; end if;
    end if;
    if pay > 0 then
      perform public.pay_free(uid, 'chest', pay, 'chest:' || open_id || ':' || i, case when dupe then 'Duplicate ' || it.key else 'Chest tokens' end);
    end if;
    got := got || jsonb_build_object('key', it.key, 'rarity', rar, 'dupe', dupe, 'tokens', pay);
  end loop;
  insert into public.chest_opened (id, user_id, kind, items) values (open_id, uid, kind, got);
  if (select count(*) from public.style_owned where user_id = uid and item like 'mech:%') >= 8
     and not exists (select 1 from public.wallet_ledger where user_id = uid and reason = 'mechs:prize') then
    perform public.pay_free(uid, 'chest', 400, 'mechs:prize', 'Nova Mechs complete');
    prize := 400;
  end if;
  return jsonb_build_object('ok', true, 'items', got, 'prize', prize, 'chests', public.chests_owned(uid));
end $$;
