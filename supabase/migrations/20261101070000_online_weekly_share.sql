-- Busy line + weekly online data share (Yazan 2026-11-01).
--
-- BUSY LINE: when more than busy_players are playing online right now, a new match waits in line instead of starting.
-- The host's phone asks online_turn every 5 s; the room's players see "You're number N in line"; the match starts by
-- itself when its turn comes. Matches already running are never touched.
--
-- WEEKLY SHARE: the free plan's monthly data is split so online play can never use it all.
-- - online_share of the month goes to online play; the rest is kept for sign-in, shop, Learn, Community and the others,
--   which never stop.
-- - The online part is handed out week by week (weeks start on Saturday, Cairo time). Whatever a week doesn't use carries
--   over to the next. Everything restarts with the month (cycle_day = the day Supabase's usage month starts).
-- - The meter is an estimate: player-seconds in online matches x bytes_per_sec (set a little high on purpose).
-- - When the share is used up, new rooms, joins and match starts are refused with 'online_resting <until>'.
--   Matches already running are never stopped, and players already seated can come back to their room.

create table if not exists public.online_meter_conf (
  id int primary key default 1 check (id = 1),
  monthly_gb numeric not null default 5,
  online_share numeric not null default 0.75 check (online_share > 0 and online_share <= 1),
  bytes_per_sec int not null default 1200 check (bytes_per_sec > 0),
  cycle_day int not null default 1 check (cycle_day between 1 and 28),
  tz text not null default 'Africa/Cairo',
  week_starts int not null default 6 check (week_starts between 0 and 6), -- 6 = Saturday, 0 = Sunday
  busy_players int not null default 250 check (busy_players > 0),
  updated_at timestamptz not null default now()
);
alter table public.online_meter_conf enable row level security;
insert into public.online_meter_conf (id) values (1) on conflict (id) do nothing;

create index if not exists matches_created_at_idx on public.matches (created_at);

-- Player-seconds of online matches between `since` and now. A match that never got an end time counts until its
-- players stop checking in (or its last phase), and never more than 2 hours.
create or replace function public.online_player_seconds(since timestamptz)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(np * greatest(0, extract(epoch from (least(fin, now()) - greatest(m.created_at, since))))), 0)
  from (
    select mt.created_at,
           (select count(*) from public.match_players mp where mp.match_id = mt.id) as np,
           least(mt.created_at + interval '2 hours', coalesce(
             mt.ended_at,
             case when exists (select 1 from public.room_players rp
                                where rp.room_id = mt.room_id and rp.last_ping > now() - interval '30 seconds')
                  then now() end,
             greatest(mt.created_at, mt.phase_started_at, mt.phase_ends_at))) as fin
    from public.matches mt
    where mt.created_at > since - interval '2 hours'
  ) m;
$$;

create or replace function public.online_meter()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.online_meter_conf;
  lnow timestamp; cs timestamp; ce timestamp; ws timestamp; we timestamp;
  month_bytes numeric; allow numeric; used numeric; used_week numeric; week_share numeric;
begin
  select * into c from public.online_meter_conf where id = 1;
  lnow := now() at time zone c.tz;
  cs := date_trunc('month', lnow) + make_interval(days => c.cycle_day - 1);
  if cs > lnow then cs := date_trunc('month', lnow) - interval '1 month' + make_interval(days => c.cycle_day - 1); end if;
  ce := cs + interval '1 month';
  ws := date_trunc('day', lnow) - make_interval(days => (extract(dow from lnow)::int - c.week_starts + 7) % 7);
  we := ws + interval '7 days';
  if ws < cs then ws := cs; end if;
  if we > ce then we := ce; end if;
  month_bytes := c.monthly_gb * 1073741824 * c.online_share;
  -- Everything handed out from the start of the month to the end of this week (so unused weeks carry over).
  allow := month_bytes * extract(epoch from (we - cs)) / extract(epoch from (ce - cs));
  week_share := month_bytes * extract(epoch from (we - ws)) / extract(epoch from (ce - cs));
  used := public.online_player_seconds(cs at time zone c.tz) * c.bytes_per_sec;
  used_week := public.online_player_seconds(ws at time zone c.tz) * c.bytes_per_sec;
  return jsonb_build_object(
    'open', used < allow,
    'resumes_at', we at time zone c.tz,
    'resumes_day', trim(to_char(we, 'FMDay')) || ' ' || to_char(we, 'FMDD Mon'),
    'month_start', cs at time zone c.tz,
    'month_end', ce at time zone c.tz,
    'week_start', ws at time zone c.tz,
    'month_online_mb', round(month_bytes / 1048576),
    'week_share_mb', round(week_share / 1048576),
    'allowed_so_far_mb', round(allow / 1048576),
    'used_month_mb', round(used / 1048576),
    'used_week_mb', round(used_week / 1048576),
    'left_mb', round(greatest(0, allow - used) / 1048576),
    'left_hours', round(greatest(0, allow - used) / c.bytes_per_sec / 3600),
    'online_share', c.online_share,
    'monthly_gb', c.monthly_gb
  );
end;
$$;

-- For every phone: is online open, and if not, until when.
create or replace function public.online_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('open', (m ->> 'open')::boolean, 'until', m -> 'resumes_at', 'day', m -> 'resumes_day') from public.online_meter() m;
$$;

-- For the Admin page: the meter plus who is online right now.
create or replace function public.online_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare res jsonb;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  select public.online_meter() || jsonb_build_object(
    'playing', (select count(*) from public.room_players rp join public.rooms r on r.id = rp.room_id
                 where rp.state = 'in' and r.status = 'playing' and rp.last_ping > now() - interval '30 seconds'),
    'watching', (select count(*) from public.room_players rp join public.rooms r on r.id = rp.room_id
                  where rp.state = 'spectator' and r.status = 'playing' and rp.last_ping > now() - interval '30 seconds'),
    'in_lobby', (select count(*) from public.room_players rp join public.rooms r on r.id = rp.room_id
                  where rp.state = 'in' and r.status = 'lobby' and rp.last_ping > now() - interval '30 seconds'),
    'busy_limit', (select busy_players from public.online_meter_conf where id = 1),
    'in_line', (select count(*) from public.online_queue where last_seen > now() - interval '20 seconds'),
    'live_matches', (select count(distinct r.id) from public.rooms r join public.room_players rp on rp.room_id = r.id
                      where r.status = 'playing' and rp.last_ping > now() - interval '30 seconds'),
    'by_game', coalesce((select jsonb_object_agg(game, n) from (
                  select r.game, count(*) as n from public.room_players rp join public.rooms r on r.id = rp.room_id
                   where rp.state in ('in', 'spectator') and r.status in ('lobby', 'playing') and rp.last_ping > now() - interval '30 seconds'
                   group by r.game) g), '{}'::jsonb)
  ) into res;
  return res;
end;
$$;

-- The busy line.
create table if not exists public.online_queue (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  queued_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
alter table public.online_queue enable row level security;

-- Players in live online matches right now.
create or replace function public.online_live_players()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.room_players rp join public.rooms r on r.id = rp.room_id
   where rp.state in ('in', 'spectator') and r.status = 'playing' and rp.last_ping > now() - interval '30 seconds';
$$;

-- Can this room start now: room for its players, and no room waiting ahead of it.
create or replace function public.online_can_start(r uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.online_live_players()
         + (select count(*) from public.room_players p where p.room_id = r and p.state = 'in')
         <= (select busy_players from public.online_meter_conf where id = 1)
     and not exists (
       select 1 from public.online_queue q
        where q.room_id <> r and q.last_seen > now() - interval '20 seconds'
          and q.queued_at < coalesce((select queued_at from public.online_queue where room_id = r), 'infinity'));
$$;

-- Asked by the room's phones while everyone is ready. The host joins the line; everyone gets the place.
-- {go: true} = start now (host only); {place: N} = number N in line; {place: 0} = not waiting.
create or replace function public.online_turn(r uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := auth.uid(); rm public.rooms; n int;
begin
  if me is null or not public.is_room_member(r) then return jsonb_build_object('place', 0); end if;
  select * into rm from public.rooms where id = r;
  if rm.status <> 'lobby' then
    delete from public.online_queue where room_id = r;
    return jsonb_build_object('place', 0);
  end if;
  delete from public.online_queue where last_seen < now() - interval '20 seconds';
  if rm.host = me then
    if public.online_can_start(r) then
      delete from public.online_queue where room_id = r;
      return jsonb_build_object('go', true, 'place', 0);
    end if;
    insert into public.online_queue (room_id) values (r)
      on conflict (room_id) do update set last_seen = now();
  end if;
  if not exists (select 1 from public.online_queue where room_id = r) then return jsonb_build_object('place', 0); end if;
  select count(*) + 1 into n from public.online_queue q
   where q.queued_at < (select queued_at from public.online_queue where room_id = r);
  return jsonb_build_object('place', n, 'busy', true);
end;
$$;

-- The gate: new rooms, new seats and new matches wait while the share is used up.
create or replace function public.online_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare m jsonb;
begin
  if tg_op = 'UPDATE' then
    -- room_players: only a fresh (re)join sets joined_at; ready taps, pings and rematch seats pass.
    if new.joined_at is not distinct from old.joined_at then return new; end if;
  end if;
  if tg_table_name = 'matches' then
    if not public.online_can_start(new.room_id) then raise exception 'online_busy'; end if;
  end if;
  m := public.online_meter();
  if not (m ->> 'open')::boolean then
    raise exception 'online_resting %', m ->> 'resumes_day';
  end if;
  return new;
end;
$$;

drop trigger if exists online_gate_rooms on public.rooms;
create trigger online_gate_rooms before insert on public.rooms for each row execute function public.online_gate();
drop trigger if exists online_gate_matches on public.matches;
create trigger online_gate_matches before insert on public.matches for each row execute function public.online_gate();
drop trigger if exists online_gate_seats on public.room_players;
create trigger online_gate_seats before insert or update of joined_at on public.room_players for each row execute function public.online_gate();

revoke all on function public.online_player_seconds(timestamptz) from public, anon, authenticated;
revoke all on function public.online_meter() from public, anon, authenticated;
revoke all on function public.online_gate() from public, anon, authenticated;
revoke all on function public.online_live_players() from public, anon, authenticated;
revoke all on function public.online_can_start(uuid) from public, anon, authenticated;
revoke all on function public.online_turn(uuid) from public, anon;
grant execute on function public.online_turn(uuid) to authenticated;
revoke all on function public.online_status() from public, anon;
revoke all on function public.online_admin() from public, anon;
grant execute on function public.online_status() to authenticated;
grant execute on function public.online_admin() to authenticated;

select public.online_meter() as online_meter_ready;
