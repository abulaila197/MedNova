-- Admin "Players" part (Yazan 2026-11-09): live counts, the player list, one player's details, rename and ban.
-- Every function checks is_admin() on the server. Bans live in their own table (players can update their own
-- profile row, so a flag there could be cleared by the player).

create table if not exists public.bans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text not null default '',
  at timestamptz not null default now()
);
alter table public.bans enable row level security;
revoke all on public.bans from anon, authenticated;

create or replace function public.is_banned(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bans b where b.user_id = uid);
$$;
revoke execute on function public.is_banned(uuid) from public, anon;
grant execute on function public.is_banned(uuid) to authenticated;

-- The top line: accounts, online now (the app pings every minute while open), active in 24 h, new in 24 h, banned.
create or replace function public.admin_players_summary() returns jsonb
language plpgsql stable security definer set search_path = 'public' as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.profiles),
    'online', (select count(*) from public.profiles where last_seen > now() - interval '2 minutes'),
    'today', (select count(*) from public.profiles where last_seen > now() - interval '24 hours'),
    'new', (select count(*) from public.profiles where created_at > now() - interval '24 hours'),
    'banned', (select count(*) from public.bans));
end $$;

-- The list: 50 at a time, searched by username or name, sorted by newest, last active or level.
create or replace function public.admin_players(q text default '', sort text default 'active', lim int default 50, off int default 0)
returns table (id uuid, username text, display_name text, avatar text, level int, exp int, created_at timestamptz,
               last_seen timestamptz, providers text[], unlimited boolean, banned boolean)
language plpgsql stable security definer set search_path = 'public', 'auth' as $$
declare pat text := replace(replace(replace(coalesce(trim(q), ''), '\', ''), '%', ''), '_', '\_');
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query
    with ex as (select w.user_id, sum(w.exp)::int as exp from public.wallet_ledger w where w.kind = 'exp' group by w.user_id),
    base as (
      select pr.id, pr.username::text as username, pr.display_name, pr.avatar, coalesce(ex.exp, 0) as exp,
             pr.created_at, pr.last_seen
      from public.profiles pr left join ex on ex.user_id = pr.id
      where pat = '' or pr.username::text ilike '%' || pat || '%' or pr.display_name ilike '%' || pat || '%'
    )
    select b.id, b.username, b.display_name, b.avatar, public.wallet_level(b.exp)::int, b.exp, b.created_at, b.last_seen,
           coalesce((select array_agg(distinct i.provider order by i.provider) from auth.identities i where i.user_id = b.id), '{}'),
           exists (select 1 from public.subscriptions s where s.user_id = b.id and s.expires_at > now()),
           exists (select 1 from public.bans x where x.user_id = b.id)
    from base b
    order by
      case when sort = 'newest' then b.created_at end desc nulls last,
      case when sort = 'level' then b.exp end desc nulls last,
      b.last_seen desc nulls last, b.username
    limit greatest(1, least(coalesce(lim, 50), 100)) offset greatest(0, coalesce(off, 0));
end $$;

-- One player's details for the action sheet.
create or replace function public.admin_player(target uuid) returns jsonb
language plpgsql stable security definer set search_path = 'public', 'auth' as $$
declare e int; pr record;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select * into pr from public.profiles where id = target;
  if not found then raise exception 'no player'; end if;
  select coalesce(sum(w.exp), 0)::int into e from public.wallet_ledger w where w.user_id = target and w.kind = 'exp';
  return jsonb_build_object(
    'exp', e,
    'level', public.wallet_level(e),
    'tokens', (public.wallet_balance(target)->>'tokens')::int,
    'sparks', (select s.value from public.sparks_state s where s.user_id = target),
    'plays', (select count(*) from public.plays p where p.user_id = target),
    'online', (select count(*) from public.match_players m where m.user_id = target),
    'top_games', coalesce((select jsonb_agg(jsonb_build_object('game', g.game, 'n', g.n) order by g.n desc)
                           from (select p.game, count(*) as n from public.plays p where p.user_id = target group by p.game order by n desc limit 3) g), '[]'),
    'friends', (select count(*) from public.friendships f where f.status = 'accepted' and (f.user_a = target or f.user_b = target)),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('at', r.created_at, 'chips', r.context->'chips', 'body', r.body) order by r.created_at desc)
                         from (select * from public.reports r where r.context->>'player_id' = target::text order by r.created_at desc limit 5) r), '[]'),
    'reports_total', (select count(*) from public.reports r where r.context->>'player_id' = target::text),
    'ban', (select jsonb_build_object('reason', b.reason, 'at', b.at) from public.bans b where b.user_id = target));
end $$;

-- Reset a rude name: back to the default name, so the app asks them to pick a new one (PickNameHost) next time.
create or replace function public.admin_reset_name(target uuid) returns text
language plpgsql security definer set search_path = 'public' as $$
declare fresh text := 'doc_' || substr(replace(target::text, '-', ''), 1, 10);
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  update public.profiles set username = fresh, display_name = 'Doctor', updated_at = now() where id = target;
  if not found then raise exception 'no player'; end if;
  return fresh;
end $$;

-- Ban or unban. A ban blocks online games (create, join, watch), room chat and the leaderboard; solo play still works.
create or replace function public.admin_ban(target uuid, banned boolean, reason text default '') returns boolean
language plpgsql security definer set search_path = 'public' as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if target = auth.uid() then raise exception 'self'; end if;
  if banned then
    insert into public.bans (user_id, reason) values (target, left(coalesce(reason, ''), 200))
    on conflict (user_id) do update set reason = excluded.reason, at = now();
    -- Out of any room they are sitting in now.
    update public.room_players set state = 'left', left_at = now() where user_id = target and state in ('in', 'spectator');
  else
    delete from public.bans where user_id = target;
  end if;
  return banned;
end $$;

do $$
declare f text; d text;
begin
  -- The ban check goes right after the sign-in check of each online entry point.
  foreach f in array array['create_room', 'join_room_id', 'send_talk'] loop
    select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = f;
    if d is null or position('account_banned' in d) > 0 then continue; end if;
    if position('if me is null then raise exception ''not signed in''; end if;' in d) = 0 then raise exception 'no sign-in check in %', f; end if;
    d := regexp_replace(d, 'if me is null then raise exception ''not signed in''; end if;',
      'if me is null then raise exception ''not signed in''; end if;' || chr(10) ||
      '  if public.is_banned(me) then raise exception ''account_banned''; end if;');
    execute d;
  end loop;
  -- Banned players leave the leaderboard.
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'leaderboard';
  if position('public.bans' in d) = 0 then
    if position('join pool on pool.id = w.user_id' in d) = 0 then raise exception 'leaderboard shape changed'; end if;
    d := replace(d, 'join pool on pool.id = w.user_id',
      'join pool on pool.id = w.user_id and not exists (select 1 from public.bans bn where bn.user_id = w.user_id)');
    execute d;
  end if;
end $$;

revoke execute on function public.admin_players_summary() from public, anon;
revoke execute on function public.admin_players(text, text, int, int) from public, anon;
revoke execute on function public.admin_player(uuid) from public, anon;
revoke execute on function public.admin_reset_name(uuid) from public, anon;
revoke execute on function public.admin_ban(uuid, boolean, text) from public, anon;
grant execute on function public.admin_players_summary() to authenticated;
grant execute on function public.admin_players(text, text, int, int) to authenticated;
grant execute on function public.admin_player(uuid) to authenticated;
grant execute on function public.admin_reset_name(uuid) to authenticated;
grant execute on function public.admin_ban(uuid, boolean, text) to authenticated;
