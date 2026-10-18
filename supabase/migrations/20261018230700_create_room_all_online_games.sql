-- NEW (found while checking S6): create_room still had its first-day guard
--   if game <> 'the-diagnostic-pursuit' then raise exception 'game not online yet';
-- so creating a room (OnlineSetup, OwnRoom, Trust Me Not lobby, and challenge_friend, which calls
-- create_room) failed for the 9 other online games, although start_match and every referee support them.
-- Now any game start_match can run is allowed.
--
-- S6 (safe part): room codes were unique across ALL rooms ever made, and nothing deletes rooms, so the
-- 6-digit code space slowly fills up. join_room already ignores closed rooms, and a closed room is never
-- reopened (rematch_room only reopens 'finished'), so a code only needs to be unique among rooms that are
-- not closed. Closed rooms now give their code back.
create or replace function public.create_room(game text, settings jsonb, is_public boolean, wanted text default null)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare me uuid := auth.uid(); r uuid; c text; other uuid; tries int := 0;
begin
  if me is null then raise exception 'not signed in'; end if;
  if game not in ('the-diagnostic-pursuit', 'the-riddler', 'nova-medicordle', 'the-streak-master', 'nova-crossword',
                  'case-files-unsolved', 'the-silent-artist', 'the-wheels-of-chaos', 'the-conqueror', 'trust-me-not') then
    raise exception 'game not online yet';
  end if;
  for other in select room_id from public.room_players where user_id = me and state in ('in','spectator') loop
    perform public.leave_room(other);
  end loop;
  loop
    c := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.rooms where code = c and status <> 'closed');
    tries := tries + 1;
    if tries > 30 then raise exception 'no free room code'; end if;
  end loop;
  insert into public.rooms(code, game, host, is_public, settings) values (c, game, me, is_public, coalesce(settings, '{}')) returning id into r;
  insert into public.room_players(room_id, user_id, character, ready, state) values (r, me, coalesce(wanted, 'yara'), true, 'in');
  return r;
end $function$;

alter table public.rooms drop constraint if exists rooms_code_key;
drop index if exists public.rooms_code_key;
create unique index if not exists rooms_open_code_key on public.rooms (code) where status <> 'closed';
