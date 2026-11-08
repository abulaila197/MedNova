-- Nova Password Online: Yazan's rules referee on the server (the 'nova-password' edge function). The whole match lives
-- in pw_games.state; views holds what each player may see (a secret term only for its clue giver), worked out by the
-- referee, so no guesser's phone ever receives the term.

create table if not exists public.pw_games (
  match_id uuid primary key references public.matches(id) on delete cascade,
  seats uuid[] not null,
  version int not null default 0,
  state jsonb,
  views jsonb not null default '{}',
  due bigint,
  updated_at timestamptz not null default now()
);
alter table public.pw_games enable row level security;
-- No policies: only the referee (service role) and the functions below read it.

create or replace function public.pw_load(m uuid, u uuid)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare x public.matches; w public.pw_games; v_host uuid;
begin
  select * into x from public.matches where id = m;
  if not found or x.game <> 'nova-password' then return jsonb_build_object('member', false); end if;
  if not exists (select 1 from public.match_players mp where mp.match_id = m and mp.user_id = u) then
    return jsonb_build_object('member', false);
  end if;
  insert into public.pw_games(match_id, seats)
    select m, array_agg(mp.user_id order by mp.user_id) from public.match_players mp where mp.match_id = m
  on conflict (match_id) do nothing;
  -- A seat is held 60 s (ON11, as in the other games); after that the player is out.
  if x.phase = 'case' then
    update public.match_players mp set dropped = true
      from public.room_players rp
     where mp.match_id = m and rp.room_id = x.room_id and rp.user_id = mp.user_id and not mp.dropped
       and (rp.state <> 'in' or rp.last_ping < now() - interval '60 seconds');
  end if;
  select * into w from public.pw_games where match_id = m;
  select host into v_host from public.rooms where id = x.room_id;
  return jsonb_build_object(
    'member', true, 'seats', to_jsonb(w.seats), 'version', w.version, 'state', w.state, 'host', v_host, 'room_id', x.room_id,
    'match', jsonb_build_object('phase', x.phase, 'ends_ms', (extract(epoch from x.phase_ends_at) * 1000)::bigint, 'settings', x.settings),
    'names', (select jsonb_object_agg(mp.user_id::text, mp.display_name) from public.match_players mp where mp.match_id = m),
    'dropped', coalesce((select jsonb_agg(mp.user_id) from public.match_players mp where mp.match_id = m and mp.dropped), '[]'::jsonb));
end $function$;

create or replace function public.pw_save(m uuid, ver integer, st jsonb, vw jsonb, due bigint, scores integer[], ranks integer[], ph text)
 returns boolean language plpgsql security definer set search_path to '' as $function$
declare w public.pw_games; x public.matches;
begin
  select * into w from public.pw_games where match_id = m for update;
  if not found or w.version <> ver then return false; end if;
  update public.pw_games set state = st, views = vw, version = ver + 1, due = pw_save.due, updated_at = now() where match_id = m;
  update public.match_players mp set score = coalesce(scores[array_position(w.seats, mp.user_id)], mp.score),
         rank = case when ranks is null then mp.rank else ranks[array_position(w.seats, mp.user_id)] end
   where mp.match_id = m;
  select * into x from public.matches where id = m for update;
  if x.phase <> ph then
    update public.matches set phase = ph, phase_started_at = now(),
           ended_at = case when ph = 'done' then now() else ended_at end where id = m;
    if ph = 'done' then
      update public.rooms set status = 'finished', updated_at = now() where id = x.room_id and match_id = m;
    end if;
  end if;
  return true;
end $function$;

-- What a phone reads every second: the match, the players, and only the caller's own view of the game.
create or replace function public.pw_state(m uuid)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare me uuid := auth.uid(); x public.matches; w public.pw_games;
begin
  if not public.is_match_member(m) then raise exception 'not in this match'; end if;
  select * into x from public.matches where id = m;
  select * into w from public.pw_games where match_id = m;
  return jsonb_build_object(
    'now', (extract(epoch from now()) * 1000)::bigint, 'room_id', x.room_id, 'game', x.game, 'phase', x.phase,
    'phase_ends_at', (extract(epoch from x.phase_ends_at) * 1000)::bigint, 'settings', x.settings,
    'players', (select jsonb_agg(jsonb_build_object('user_id', mp.user_id, 'name', mp.display_name, 'character', mp.character,
        'score', mp.score, 'dropped', mp.dropped, 'rank', mp.rank) order by mp.user_id)
      from public.match_players mp where mp.match_id = m),
    'seats', to_jsonb(w.seats), 'me', me, 'version', coalesce(w.version, 0), 'due', w.due,
    'view', case when w.views ? me::text then w.views->me::text else w.views->'watch' end);
end $function$;

revoke execute on function public.pw_load(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.pw_save(uuid, integer, jsonb, jsonb, bigint, integer[], integer[], text) from public, anon, authenticated;
grant execute on function public.pw_load(uuid, uuid) to service_role;
grant execute on function public.pw_save(uuid, integer, jsonb, jsonb, bigint, integer[], integer[], text) to service_role;
revoke execute on function public.pw_state(uuid) from public, anon;
grant execute on function public.pw_state(uuid) to authenticated, service_role;
