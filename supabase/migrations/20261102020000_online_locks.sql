-- Online locks (Yazan 2026-11-02): the Admin page can lock online play for one game or for all games, e.g. while a
-- game has a bug. A locked game shows a lock on its Online card and can't be picked; the server refuses its new rooms,
-- new seats and new matches with 'online_locked'. Matches already running are never stopped.
-- When the week's online data share is used up, every Online card shows the lock by itself (online_status.open = false).

create table if not exists public.online_locks (
  game text primary key check (game = '*' or game ~ '^[a-z0-9-]{2,60}$'), -- '*' = every game
  locked_at timestamptz not null default now(),
  locked_by uuid
);
alter table public.online_locks enable row level security;
-- No policies: phones read the locks through online_status(), the Admin page changes them through admin_online_lock().

-- Is online play for this game locked (by the game or by "all")?
create or replace function public.online_locked(g text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.online_locks l where l.game = '*' or l.game = g);
$$;

-- For every phone: is online open, until when, and which games are locked ('*' = all).
create or replace function public.online_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('open', (m ->> 'open')::boolean, 'until', m -> 'resumes_at', 'day', m -> 'resumes_day',
    'locked', coalesce((select jsonb_agg(l.game order by l.game) from public.online_locks l), '[]'::jsonb))
  from public.online_meter() m;
$$;

-- Admin: lock or unlock one game ('*' = all games).
create or replace function public.admin_online_lock(g text, lock boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if lock then
    insert into public.online_locks (game, locked_by) values (g, auth.uid()) on conflict (game) do nothing;
  else
    delete from public.online_locks where game = g;
  end if;
  return coalesce((select jsonb_agg(l.game order by l.game) from public.online_locks l), '[]'::jsonb);
end;
$$;

-- The gate (same as 2026-11-01, plus the lock check): new rooms, new seats and new matches of a locked game stop.
create or replace function public.online_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare m jsonb; g text;
begin
  if tg_op = 'UPDATE' then
    -- room_players: only a fresh (re)join sets joined_at; ready taps, pings and rematch seats pass.
    if new.joined_at is not distinct from old.joined_at then return new; end if;
  end if;
  -- Watching (Yazan 2026-11-01): at most 3 watchers per match.
  if tg_table_name = 'room_players' then
    if new.state = 'spectator' and (select count(*) from public.room_players w
        where w.room_id = new.room_id and w.state = 'spectator' and w.user_id <> new.user_id) >= 3 then
      raise exception 'watchers_full';
    end if;
  end if;
  -- Locks (Yazan 2026-11-02).
  -- (separate branches: a room_players row has no game field)
  if tg_table_name = 'rooms' then
    g := new.game;
  else
    select r.game into g from public.rooms r where r.id = new.room_id;
  end if;
  if public.online_locked(g) then raise exception 'online_locked'; end if;
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

revoke all on function public.online_locked(text) from public, anon, authenticated;
revoke all on function public.online_gate() from public, anon, authenticated;
revoke all on function public.online_status() from public, anon;
grant execute on function public.online_status() to authenticated;
revoke all on function public.admin_online_lock(text, boolean) from public, anon;
grant execute on function public.admin_online_lock(text, boolean) to authenticated;

select public.online_status() as online_locks_ready;
