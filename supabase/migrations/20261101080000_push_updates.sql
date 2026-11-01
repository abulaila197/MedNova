-- Push updates (Yazan 2026-11-01, all online games + lobbies).
-- Each match and each room gets a private push line: 'match:<id>' and 'room:<id>'. Only its members (players and
-- watchers) can listen, and no phone can send on it. When something changes, the server sends a tiny 'changed'
-- signal (no game data); each phone then fetches its own view with poll_state / room_state as before.
-- A signal is sent at most once per topic per database transaction, and a failed signal never breaks a move.

create or replace function public.push_ping(topic text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare k text := 'mn.p' || md5(topic);
begin
  if current_setting(k, true) = '1' then return; end if;
  perform set_config(k, '1', true);
  perform realtime.send('{}'::jsonb, 'changed', topic, true);
exception when others then
  null; -- push is a speed-up only; phones still check on their own
end;
$$;
revoke all on function public.push_ping(text) from public, anon, authenticated;

-- Row trigger: tg_argv[0] = topic kind ('match' or 'room'), tg_argv[1] = the column holding its id.
create or replace function public.push_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v text;
begin
  v := (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> tg_argv[1];
  if v is not null then perform public.push_ping(tg_argv[0] || ':' || v); end if;
  return null;
end;
$$;
revoke all on function public.push_row() from public, anon, authenticated;

-- Match changes. Column lists leave out what changes without the players needing to see it at once
-- (Silent Artist strokes travel on their own live line; seat check-ins are not changes).
drop trigger if exists push_matches on public.matches;
create trigger push_matches after insert or update of phase, phase_started_at, phase_ends_at, case_index, ended_at, settings
  on public.matches for each row execute function public.push_row('match', 'id');
drop trigger if exists push_match_players on public.match_players;
create trigger push_match_players after insert or update or delete on public.match_players for each row execute function public.push_row('match', 'match_id');
drop trigger if exists push_race_results on public.race_results;
create trigger push_race_results after insert or update or delete on public.race_results for each row execute function public.push_row('match', 'match_id');
drop trigger if exists push_dp_case_results on public.dp_case_results;
create trigger push_dp_case_results after insert or update or delete on public.dp_case_results for each row execute function public.push_row('match', 'match_id');
drop trigger if exists push_cw_claims on public.cw_claims;
create trigger push_cw_claims after insert or update or delete on public.cw_claims for each row execute function public.push_row('match', 'match_id');
drop trigger if exists push_sa_turns on public.sa_turns;
create trigger push_sa_turns after insert or update of turn, drawer, options, word, plan, reports, guesses or delete
  on public.sa_turns for each row execute function public.push_row('match', 'match_id');
drop trigger if exists push_wc_games on public.wc_games;
create trigger push_wc_games after insert or update of state, version or delete on public.wc_games for each row execute function public.push_row('match', 'match_id');
drop trigger if exists push_wc_swipes on public.wc_swipes;
create trigger push_wc_swipes after insert or update or delete on public.wc_swipes for each row execute function public.push_row('match', 'match_id');
drop trigger if exists push_cq_games on public.cq_games;
create trigger push_cq_games after insert or update of state, version or delete on public.cq_games for each row execute function public.push_row('match', 'match_id');
drop trigger if exists push_cq_views on public.cq_views;
create trigger push_cq_views after insert or update or delete on public.cq_views for each row execute function public.push_row('match', 'match_id');
drop trigger if exists push_cc_games on public.cc_games;
create trigger push_cc_games after insert or update of state, version, views or delete on public.cc_games for each row execute function public.push_row('match', 'match_id');
drop trigger if exists push_im_games on public.im_games;
create trigger push_im_games after insert or update of state, version, views or delete on public.im_games for each row execute function public.push_row('match', 'match_id');
drop trigger if exists push_pw_games on public.pw_games;
create trigger push_pw_games after insert or update of state, version, views or delete on public.pw_games for each row execute function public.push_row('match', 'match_id');

-- Lobby changes: who is in, ready taps, characters, teams, settings, start / finish.
drop trigger if exists push_rooms on public.rooms;
create trigger push_rooms after update of status, settings, is_public, host, match_id on public.rooms for each row execute function public.push_row('room', 'id');
drop trigger if exists push_room_players on public.room_players;
create trigger push_room_players after insert or update of state, ready, team, character or delete
  on public.room_players for each row execute function public.push_row('room', 'room_id');

-- Who may listen: members of that match or room only. There is no rule for sending, so phones can't send.
drop policy if exists "mednova members hear their lines" on realtime.messages;
create policy "mednova members hear their lines" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (
      (realtime.topic() ~ '^match:[0-9a-f-]{36}$' and public.is_match_member(substr(realtime.topic(), 7)::uuid))
      or (realtime.topic() ~ '^room:[0-9a-f-]{36}$' and public.is_room_member(substr(realtime.topic(), 6)::uuid))
    )
  );

-- Weekly share meter: with push, a player uses far less (signals + one fetch per change + backup checks).
-- Kept a little high on purpose until the real numbers from Supabase's Usage page are in.
update public.online_meter_conf set bytes_per_sec = 900, updated_at = now() where id = 1 and bytes_per_sec = 2000;

select 'push ready' as done;
