-- Publish list group 1 (Friends, rooms and chat), Yazan 2026-10-26.
-- #3 find a friend by code, #85 friend profile, #80 watch a friend (private rooms: anyone with the code;
-- public rooms: friends only while the match runs), #25 one shared like count for posts and wallpapers.

-- #3: the Find box also matches an exact friend code (6 letters/digits), shown first.
create or replace function public.find_players(q text)
returns table (id uuid, username text, display_name text, avatar text, level int, kind text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, p.display_name, p.avatar,
         public.level_for_exp(coalesce((select sum(w.exp) from public.wallet_ledger w where w.user_id = p.id and w.kind = 'exp'), 0)::int),
         coalesce((select case when f.status = 'accepted' then 'friend' when f.requester = auth.uid() then 'outgoing' else 'incoming' end
                   from public.friendships f where f.user_a = least(auth.uid(), p.id) and f.user_b = greatest(auth.uid(), p.id) and f.status <> 'none'), 'none')
  from public.profiles p
  where auth.uid() is not null and length(trim(q)) >= 2 and p.id <> auth.uid()
    and (p.username::text ilike trim(both '@' from trim(q)) || '%' or p.display_name ilike '%' || trim(q) || '%'
         or upper(p.friend_code::text) = upper(trim(q)))
    and not exists (select 1 from public.blocks b where b.active and ((b.blocker = auth.uid() and b.blocked = p.id) or (b.blocker = p.id and b.blocked = auth.uid())))
  order by (upper(p.friend_code::text) = upper(trim(q))) desc, (p.username::text ilike trim(both '@' from trim(q)) || '%') desc, p.last_seen desc nulls last
  limit 20;
$$;

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships f where f.user_a = least(a, b) and f.user_b = greatest(a, b) and f.status = 'accepted')
     and not exists (select 1 from public.blocks k where k.active and ((k.blocker = a and k.blocked = b) or (k.blocker = b and k.blocked = a)));
$$;
revoke all on function public.are_friends(uuid, uuid) from public, anon, authenticated;

-- #85: what a friend's profile sheet shows. Friends only.
create or replace function public.friend_profile(other uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with s as (
    select coalesce(sum(exp) filter (where kind = 'exp'), 0) exp,
           coalesce(sum(tokens) filter (where kind not in ('exp','convert')), 0) rest
    from public.wallet_ledger where user_id = friend_profile.other
  )
  select jsonb_build_object(
    'id', p.id, 'username', p.username::text, 'display_name', p.display_name, 'avatar', p.avatar, 'last_seen', p.last_seen,
    'level', public.wallet_level(s.exp),
    'tokens', public.wallet_level_tokens(public.wallet_level(s.exp)) + s.rest,
    'since', (select coalesce(f.accepted_at, f.created_at) from public.friendships f where f.user_a = least(auth.uid(), friend_profile.other) and f.user_b = greatest(auth.uid(), friend_profile.other)),
    'characters', to_jsonb(array(select c from unnest(array['yazan','yara','omar','layla','atlas','nova','bolt','iris','pip',
        'sprocket','kit','vex','bulwark','echo','aurora','cortex','titan','bloop','pixel','nimbus','ember','zenith','linky','sovereign','admin']) with ordinality u(c, i)
      where public.avatar_open(friend_profile.other, c) order by i)))
  from public.profiles p, s
  where p.id = friend_profile.other and auth.uid() is not null and public.are_friends(auth.uid(), friend_profile.other);
$$;

-- #80: friends who are playing a match right now, with the room to watch.
create or replace function public.friends_playing()
returns table (friend uuid, room_id uuid, game text)
language sql stable security definer set search_path = '' as $$
  select distinct on (rp.user_id) rp.user_id, rm.id, rm.game
  from public.room_players rp join public.rooms rm on rm.id = rp.room_id
  where auth.uid() is not null and rp.state = 'in' and rm.status = 'playing' and rp.user_id <> auth.uid()
    and public.are_friends(auth.uid(), rp.user_id)
  order by rp.user_id, rp.joined_at desc;
$$;

-- #80: Watch from the Friends list: join your friend's running match as a watcher.
create or replace function public.watch_friend(friend uuid, wanted text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not public.are_friends(auth.uid(), friend) then return jsonb_build_object('result', 'not_found'); end if;
  select rm.id into r from public.room_players rp join public.rooms rm on rm.id = rp.room_id
   where rp.user_id = friend and rp.state = 'in' and rm.status = 'playing' order by rp.joined_at desc limit 1;
  if r is null then return jsonb_build_object('result', 'not_playing'); end if;
  return public.join_room_id(r, wanted);
end $$;

-- #80 (Yazan: "not public rooms, private only"): joining a running PUBLIC match to watch needs a friend in it.
-- Private rooms keep ON19 (anyone with the code watches now, seat at the rematch). Otherwise unchanged.
create or replace function public.join_room_id(r uuid, wanted text default null)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare me uuid := auth.uid(); rm public.rooms; seat public.room_players; n int; st text; ch text; other uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into rm from public.rooms where id = r for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  if rm.status = 'lobby' and rm.lobby_since < now() - interval '15 minutes' and rm.match_id is null then
    update public.rooms set status = 'closed', updated_at = now() where id = r;
    return jsonb_build_object('result', 'closed');
  end if;
  if rm.status = 'closed' then return jsonb_build_object('result', 'closed'); end if;
  if exists (select 1 from public.blocks where active and ((blocker = rm.host and blocked = me) or (blocker = me and blocked = rm.host))) then
    return jsonb_build_object('result', 'not_found');
  end if;
  if exists (select 1 from public.room_players where room_id = r and user_id = me and state = 'removed') then
    return jsonb_build_object('result', 'removed');
  end if;
  select * into seat from public.room_players where room_id = r and user_id = me;
  if found and seat.state in ('in','spectator') then
    return jsonb_build_object('result', case when seat.state = 'in' then 'joined' else 'spectating' end, 'room_id', r);
  end if;
  if rm.status = 'playing' and rm.is_public and not exists (
      select 1 from public.room_players p where p.room_id = r and p.state = 'in' and public.are_friends(me, p.user_id)) then
    return jsonb_build_object('result', 'in_progress');
  end if;
  -- one room at a time
  for other in select room_id from public.room_players where user_id = me and state in ('in','spectator') and room_id <> r loop
    perform public.leave_room(other);
  end loop;
  select count(*) into n from public.room_players where room_id = r and state = 'in';
  if rm.status = 'lobby' then
    if n >= public.room_cap(rm.game) then return jsonb_build_object('result', 'full'); end if;
    st := 'in';
  else
    st := 'spectator'; -- ON19: watch now, seat at the rematch
  end if;
  ch := public.free_character(r, coalesce(wanted, 'yara'), me);
  insert into public.room_players(room_id, user_id, character, ready, state, joined_at, last_ping)
    values (r, me, ch, false, st, now(), now())
    on conflict (room_id, user_id) do update set character = ch, ready = false, state = st, joined_at = now(), last_ping = now(), team = null;
  update public.rooms set updated_at = now() where id = r;
  return jsonb_build_object('result', case when st = 'in' then 'joined' else 'spectating' end, 'room_id', r);
end $function$;

-- #25: one like per player per post or wallpaper; everyone sees the same count.
create table if not exists public.likes (
  item text not null check (item ~ '^(post|wall):[a-z0-9-]{1,40}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item, user_id)
);
alter table public.likes enable row level security;

create or replace function public.like_counts(items text[])
returns table (item text, n int, mine boolean)
language sql stable security definer set search_path = '' as $$
  select i, (select count(*)::int from public.likes l where l.item = i),
         exists (select 1 from public.likes l where l.item = i and l.user_id = auth.uid())
  from unnest(items[1:100]) i;
$$;

create or replace function public.like_set(item text, on_ boolean) returns int
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if on_ then
    insert into public.likes(item, user_id) values (like_set.item, auth.uid()) on conflict do nothing;
  else
    delete from public.likes l where l.item = like_set.item and l.user_id = auth.uid();
  end if;
  return (select count(*)::int from public.likes l where l.item = like_set.item);
end $$;

revoke all on function public.friend_profile(uuid), public.friends_playing(), public.watch_friend(uuid, text),
  public.like_counts(text[]), public.like_set(text, boolean) from public, anon;
grant execute on function public.friend_profile(uuid), public.friends_playing(), public.watch_friend(uuid, text),
  public.like_set(text, boolean) to authenticated;
-- Guests see the counts too.
grant execute on function public.like_counts(text[]) to anon, authenticated;
