-- App fixes group 1 (Yazan, 2026-10-31): online games and watching.

-- #13: Conqueror saves a watchers' copy of the match under the all-zero id. The account-deletion rule of
-- 2026-10-13 (cq_views_user_fk) refused that row, so the referee failed on the first deal and the match froze
-- on "1". The rule goes; deleting an account still clears that player's Conqueror copies through a trigger.
alter table public.cq_views drop constraint if exists cq_views_user_fk;
create or replace function public.cq_views_clean() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.cq_views where user_id = old.id;
  return old;
end $$;
drop trigger if exists profiles_cq_views_clean on public.profiles;
create trigger profiles_cq_views_clean after delete on public.profiles for each row execute function public.cq_views_clean();
revoke all on function public.cq_views_clean() from public, anon, authenticated;

-- #24 (Yazan's pick: wait 30 s, then win): in a running 2-player match, Leave (or a phone gone quiet) starts a
-- 30 s wait. The seat stays until then; coming back in time clears it. left_at marks a Leave.
alter table public.room_players add column if not exists left_at timestamptz;

-- The old leave_room body, for any player. Only the server calls it.
create or replace function public.drop_player(r uuid, who uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare rm public.rooms; nxt uuid;
begin
  select * into rm from public.rooms where id = r for update;
  if not found then return; end if;
  update public.room_players set state = 'left', ready = false, left_at = null where room_id = r and user_id = who and state in ('in','spectator');
  if rm.match_id is not null then
    update public.match_players set dropped = true where match_id = rm.match_id and user_id = who;
  end if;
  select user_id into nxt from public.room_players where room_id = r and state = 'in' order by joined_at limit 1;
  if nxt is null then
    select user_id into nxt from public.room_players where room_id = r and state = 'spectator' order by joined_at limit 1;
  end if;
  if nxt is null then
    update public.rooms set status = 'closed', updated_at = now() where id = r;
  elsif rm.host = who then
    update public.rooms set host = nxt, updated_at = now() where id = r;
    update public.room_players set ready = true where room_id = r and user_id = nxt;
  end if;
end $$;
revoke all on function public.drop_player(uuid, uuid) from public, anon, authenticated;

create or replace function public.leave_room(r uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); rm public.rooms;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into rm from public.rooms where id = r for update;
  if not found then return; end if;
  if rm.status = 'playing' and rm.match_id is not null
     and exists (select 1 from public.room_players where room_id = r and user_id = me and state = 'in')
     and (select count(*) from public.room_players where room_id = r and state = 'in') = 2 then
    update public.room_players set left_at = coalesce(left_at, now()) where room_id = r and user_id = me;
    return;
  end if;
  perform public.drop_player(r, me);
end $$;

-- A player counts as gone from a running 2-player match from their Leave, or from their last check-in once the
-- phone has been quiet for 16 s (live phones check in every 5 s). After 30 s gone, the seat is dropped.
create or replace function public.settle_room(r uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare p record;
begin
  if not exists (select 1 from public.rooms where id = r and status = 'playing') then return; end if;
  if (select count(*) from public.room_players where room_id = r and state = 'in') <> 2 then return; end if;
  for p in select user_id from public.room_players
            where room_id = r and state = 'in'
              and coalesce(left_at, case when last_ping < now() - interval '16 seconds' then last_ping end) < now() - interval '30 seconds' loop
    perform public.drop_player(r, p.user_id);
  end loop;
end $$;
revoke all on function public.settle_room(uuid) from public, anon, authenticated;

-- #23: a room whose players have all gone quiet for 2 minutes closes by itself. Runs with each touch_seen.
create index if not exists rooms_playing_idx on public.rooms (id) where status = 'playing';
create or replace function public.sweep_rooms()
returns void language sql security definer set search_path = '' as $$
  update public.rooms rm set status = 'closed', updated_at = now()
   where rm.status = 'playing'
     and not exists (select 1 from public.room_players rp where rp.room_id = rm.id and rp.state in ('in','spectator')
                       and rp.last_ping > now() - interval '2 minutes');
$$;
revoke all on function public.sweep_rooms() from public, anon, authenticated;

create or replace function public.touch_seen()
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set last_seen = now() where id = (select auth.uid());
  perform public.sweep_rooms();
end $$;

-- #18 and #23: only a player whose phone checked in during the last 60 s is "in a match".
create or replace function public.friends_playing()
returns table (friend uuid, room_id uuid, game text)
language sql stable security definer set search_path = '' as $$
  select distinct on (rp.user_id) rp.user_id, rm.id, rm.game
  from public.room_players rp join public.rooms rm on rm.id = rp.room_id
  where auth.uid() is not null and rp.state = 'in' and rp.left_at is null and rm.status = 'playing' and rp.user_id <> auth.uid()
    and rp.last_ping > now() - interval '60 seconds'
    and public.are_friends(auth.uid(), rp.user_id)
  order by rp.user_id, rp.joined_at desc;
$$;

-- #16 (Yazan's pick: ask, with Always allow): watching a friend asks them first.
create table if not exists public.watch_asks (
  id uuid primary key default gen_random_uuid(),
  watcher uuid not null references public.profiles(id) on delete cascade,
  player uuid not null references public.profiles(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  status text not null default 'open' check (status in ('open','allowed','declined','cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '20 seconds',
  answered_at timestamptz
);
create index if not exists watch_asks_player_idx on public.watch_asks (player, status);
alter table public.watch_asks enable row level security;

create table if not exists public.watch_always (
  player uuid not null references public.profiles(id) on delete cascade,
  watcher uuid not null references public.profiles(id) on delete cascade,
  primary key (player, watcher)
);
alter table public.watch_always enable row level security;

create or replace function public.watch_friend(friend uuid, wanted text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r uuid; a uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not public.are_friends(me, friend) then return jsonb_build_object('result', 'not_found'); end if;
  select rm.id into r from public.room_players rp join public.rooms rm on rm.id = rp.room_id
   where rp.user_id = friend and rp.state = 'in' and rp.left_at is null and rm.status = 'playing'
     and rp.last_ping > now() - interval '60 seconds'
   order by rp.joined_at desc limit 1;
  if r is null then return jsonb_build_object('result', 'not_playing'); end if;
  if exists (select 1 from public.room_players where room_id = r and user_id = me and state in ('in','spectator'))
     or exists (select 1 from public.watch_always w where w.player = friend and w.watcher = me)
     or exists (select 1 from public.watch_asks w where w.watcher = me and w.player = friend and w.room_id = r
                  and w.status = 'allowed' and w.answered_at > now() - interval '2 minutes') then
    return public.join_room_id(r, wanted);
  end if;
  update public.watch_asks set status = 'cancelled' where watcher = me and player = friend and status = 'open';
  insert into public.watch_asks(watcher, player, room_id) values (me, friend, r) returning id into a;
  return jsonb_build_object('result', 'asked', 'ask', a);
end $$;

create or replace function public.watch_ask_state(ask uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('status', case when w.status = 'open' and w.expires_at < now() then 'expired' else w.status end)
                     from public.watch_asks w where w.id = ask and w.watcher = auth.uid()),
                  jsonb_build_object('status', 'expired'));
$$;

create or replace function public.answer_watch(ask uuid, answer text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); w public.watch_asks;
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into w from public.watch_asks where id = ask and player = me for update;
  if not found or w.status <> 'open' or w.expires_at < now() then return jsonb_build_object('result', 'expired'); end if;
  update public.watch_asks set status = case when answer in ('allow','always') then 'allowed' else 'declined' end, answered_at = now() where id = ask;
  if answer = 'always' then
    insert into public.watch_always(player, watcher) values (me, w.watcher) on conflict do nothing;
  end if;
  return jsonb_build_object('result', 'ok');
end $$;

create or replace function public.cancel_watch(ask uuid) returns void
language sql security definer set search_path = '' as $$
  update public.watch_asks set status = 'cancelled' where id = ask and watcher = auth.uid() and status = 'open';
$$;

-- On a friend's profile: does this friend watch me without asking, and turn it off (or on).
create or replace function public.watch_always_get(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.watch_always where player = auth.uid() and watcher = other);
$$;
create or replace function public.watch_always_set(other uuid, allow boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if allow then
    insert into public.watch_always(player, watcher) values (auth.uid(), other) on conflict do nothing;
  else
    delete from public.watch_always where player = auth.uid() and watcher = other;
  end if;
end $$;

-- The live page's check-in every 5 s: keeps my seat, clears my Leave if I came back, settles the 30 s wait,
-- and tells the phone who it is waiting for, whether I'm only watching, and who asks to watch me.
create or replace function public.room_live(r uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); st text;
begin
  if me is null or not public.is_room_member(r) then return jsonb_build_object('result', 'not_member'); end if;
  update public.room_players set last_ping = now(), left_at = null where room_id = r and user_id = me and state in ('in','spectator');
  perform public.settle_room(r);
  select state into st from public.room_players where room_id = r and user_id = me;
  return jsonb_build_object(
    'result', 'ok',
    'status', (select status from public.rooms where id = r),
    'me', st,
    'waiting', coalesce((select jsonb_agg(jsonb_build_object('user_id', rp.user_id, 'name', pr.display_name,
        'gone_ms', (extract(epoch from now() - coalesce(rp.left_at, rp.last_ping)) * 1000)::bigint))
      from public.room_players rp join public.profiles pr on pr.id = rp.user_id
      where rp.room_id = r and rp.state = 'in' and rp.user_id <> me
        and (select count(*) from public.room_players x where x.room_id = r and x.state = 'in') = 2
        and (select status from public.rooms where id = r) = 'playing'
        and (rp.left_at is not null or rp.last_ping < now() - interval '16 seconds')), '[]'::jsonb),
    'asks', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'name', pr.display_name, 'avatar', pr.avatar,
        'left_ms', (extract(epoch from w.expires_at - now()) * 1000)::bigint) order by w.created_at)
      from public.watch_asks w join public.profiles pr on pr.id = w.watcher
      where w.player = me and w.status = 'open' and w.expires_at > now()), '[]'::jsonb));
end $$;

revoke all on function public.watch_friend(uuid, text), public.watch_ask_state(uuid), public.answer_watch(uuid, text),
  public.cancel_watch(uuid), public.watch_always_get(uuid), public.watch_always_set(uuid, boolean), public.room_live(uuid),
  public.leave_room(uuid), public.touch_seen(), public.friends_playing() from public, anon;
grant execute on function public.watch_friend(uuid, text), public.watch_ask_state(uuid), public.answer_watch(uuid, text),
  public.cancel_watch(uuid), public.watch_always_get(uuid), public.watch_always_set(uuid, boolean), public.room_live(uuid),
  public.leave_room(uuid), public.touch_seen(), public.friends_playing() to authenticated;
