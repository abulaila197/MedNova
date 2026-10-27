-- Inbox (Yazan 2026-10-27): the admin sends a message to everyone or to one player, with optional gifts (tokens,
-- Sparks, a wooden / golden / diamond / epic chest). Nothing reaches the wallet until the player taps Collect. A message to
-- everyone reaches only players whose account existed when it was sent. Admin gifts go through here now; taking
-- tokens back (a minus amount) stays instant in admin_grant_tokens.

create table if not exists public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  target uuid references auth.users (id) on delete cascade, -- null = everyone
  title text not null check (length(title) between 1 and 80),
  body text not null default '' check (length(body) <= 1000),
  tokens int not null default 0 check (tokens between 0 and 5000),
  sparks int not null default 0 check (sparks between 0 and 1000),
  chest text check (chest in ('wooden', 'golden', 'diamond', 'epic')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists inbox_messages_target on public.inbox_messages (target, created_at desc);
alter table public.inbox_messages enable row level security;

create table if not exists public.inbox_claims (
  message_id uuid not null references public.inbox_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz,
  collected_at timestamptz,
  primary key (message_id, user_id)
);
alter table public.inbox_claims enable row level security;

-- The messages one player can see.
create or replace function public.inbox_for(uid uuid) returns setof public.inbox_messages
language sql stable security definer set search_path = '' as $$
  select m.* from public.inbox_messages m
   where m.target = uid
      or (m.target is null and m.created_at >= (select p.created_at from public.profiles p where p.id = uid))
$$;
revoke all on function public.inbox_for(uuid) from public, anon, authenticated;

-- The signed-in player's inbox, newest first, with read / collected marks.
create or replace function public.inbox_list() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'title', m.title, 'body', m.body, 'tokens', m.tokens, 'sparks', m.sparks, 'chest', m.chest,
      'at', m.created_at, 'read', c.read_at is not null, 'collected', c.collected_at is not null)
    order by m.created_at desc), '[]'::jsonb)
  from public.inbox_for(auth.uid()) m
  left join public.inbox_claims c on c.message_id = m.id and c.user_id = auth.uid()
$$;

-- How many messages still want the player: not opened yet, or a gift not collected. Drives the red dot.
create or replace function public.inbox_waiting() returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.inbox_for(auth.uid()) m
  left join public.inbox_claims c on c.message_id = m.id and c.user_id = auth.uid()
  where c.read_at is null
     or (c.collected_at is null and (m.tokens > 0 or m.sparks > 0 or m.chest is not null))
$$;

create or replace function public.inbox_read(msg uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.inbox_for(uid) where id = msg) then return; end if;
  insert into public.inbox_claims (message_id, user_id, read_at) values (msg, uid, now())
  on conflict (message_id, user_id) do update set read_at = coalesce(public.inbox_claims.read_at, now());
end $$;

-- Collect a message's gifts, once.
create or replace function public.inbox_collect(msg uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); m public.inbox_messages;
begin
  if uid is null then return jsonb_build_object('ok', false, 'why', 'guest'); end if;
  select * into m from public.inbox_for(uid) where id = msg;
  if m.id is null then return jsonb_build_object('ok', false, 'why', 'gone'); end if;
  perform pg_advisory_xact_lock(hashtext('inbox:' || uid::text));
  if exists (select 1 from public.inbox_claims where message_id = msg and user_id = uid and collected_at is not null) then
    return jsonb_build_object('ok', false, 'why', 'done');
  end if;
  if m.tokens > 0 then
    insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, note, at)
    values ('i' || md5(msg::text || uid::text), uid, 'grant', 0, m.tokens, 'inbox:' || msg::text, left(m.title, 200), now());
  end if;
  if m.sparks > 0 then perform public.sparks_add(uid, m.sparks, 'grant', 'inbox ' || left(m.title, 180)); end if;
  if m.chest is not null then
    insert into public.chest_earned (user_id, day, kind, src) values (uid, current_date, m.chest, 'inbox:' || msg::text);
  end if;
  insert into public.inbox_claims (message_id, user_id, read_at, collected_at) values (msg, uid, now(), now())
  on conflict (message_id, user_id) do update set read_at = coalesce(public.inbox_claims.read_at, now()), collected_at = now();
  return jsonb_build_object('ok', true, 'tokens', m.tokens, 'sparks', m.sparks, 'chest', m.chest);
end $$;

-- Admin: send to one player (target) or everyone (null). Everyone: up to 500 tokens and 500 Sparks.
create or replace function public.admin_inbox_send(target uuid, title text, body text, tokens int, sparks int, chest text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t text := trim(coalesce(title, '')); id uuid; n int;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if t = '' then raise exception 'title'; end if;
  if coalesce(tokens, 0) < 0 or coalesce(sparks, 0) < 0 then raise exception 'amount'; end if;
  if target is null and (coalesce(tokens, 0) > 500 or coalesce(sparks, 0) > 500) then raise exception 'amount'; end if;
  if target is not null and not exists (select 1 from public.profiles where profiles.id = target) then raise exception 'no player'; end if;
  insert into public.inbox_messages (target, title, body, tokens, sparks, chest, created_by)
  values (target, left(t, 80), left(trim(coalesce(body, '')), 1000), coalesce(tokens, 0), coalesce(sparks, 0), nullif(chest, ''), auth.uid())
  returning inbox_messages.id into id;
  select count(*) into n from public.profiles p where target is null or p.id = target;
  return jsonb_build_object('ok', true, 'id', id, 'players', n);
end $$;

-- Admin: what was sent, newest first, with how many players opened and collected each one.
create or replace function public.admin_inbox_sent() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when not public.is_admin() then '[]'::jsonb else coalesce((select jsonb_agg(x order by x->>'at' desc) from (
    select jsonb_build_object('id', m.id, 'title', m.title, 'tokens', m.tokens, 'sparks', m.sparks, 'chest', m.chest, 'at', m.created_at,
      'to', coalesce((select p.username::text from public.profiles p where p.id = m.target), case when m.target is null then null else '?' end),
      'read', (select count(*) from public.inbox_claims c where c.message_id = m.id and c.read_at is not null),
      'collected', (select count(*) from public.inbox_claims c where c.message_id = m.id and c.collected_at is not null)) x
    from public.inbox_messages m order by m.created_at desc limit 50) q), '[]'::jsonb) end
$$;

revoke all on function public.inbox_list(), public.inbox_waiting(), public.inbox_read(uuid), public.inbox_collect(uuid),
  public.admin_inbox_send(uuid, text, text, int, int, text), public.admin_inbox_sent() from public, anon;
grant execute on function public.inbox_list(), public.inbox_waiting(), public.inbox_read(uuid), public.inbox_collect(uuid),
  public.admin_inbox_send(uuid, text, text, int, int, text), public.admin_inbox_sent() to authenticated;
