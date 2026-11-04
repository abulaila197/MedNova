-- App fixes 2026-11-04, group 1 (points 5 and 18): a room whose phone closed doesn't stay open or listed.
-- 1. The public list shows a lobby only while its host's phone checked in within the last 30 s (the lobby asks the
--    server every 2 s, or every 10 s as a backup with push on).
-- 2. A lobby seat quiet for 60 s is dropped through drop_player, which passes the host on or closes an empty room.
--    A lobby gets 2 minutes after it opens (or after "Back to lobby") before anyone is dropped, so players still on
--    the results page can come back. Runs on every room_state call for that room and once a minute for all rooms.

create or replace function public.sweep_lobbies(only_room uuid default null)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare p record; n integer := 0;
begin
  for p in
    select rp.room_id, rp.user_id
    from public.room_players rp
    join public.rooms rm on rm.id = rp.room_id
    where rm.status = 'lobby'
      and rp.state in ('in', 'spectator')
      and rp.last_ping < now() - interval '60 seconds'
      and rm.lobby_since < now() - interval '2 minutes'
      and (only_room is null or rp.room_id = only_room)
  loop
    perform public.drop_player(p.room_id, p.user_id);
    n := n + 1;
  end loop;
  return n;
end $function$;

revoke all on function public.sweep_lobbies(uuid) from public, anon, authenticated;

create or replace function public.room_state(r uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare me uuid := auth.uid(); rm public.rooms;
begin
  if me is null or not public.is_room_member(r) then return jsonb_build_object('result', 'not_member'); end if;
  update public.room_players set last_ping = now() where room_id = r and user_id = me and state in ('in','spectator');
  perform public.sweep_lobbies(r);
  if not public.is_room_member(r) then return jsonb_build_object('result', 'not_member'); end if;
  select * into rm from public.rooms where id = r;
  if rm.status = 'lobby' and rm.lobby_since < now() - interval '15 minutes' then
    update public.rooms set status = 'closed', updated_at = now() where id = r;
    rm.status := 'closed';
  end if;
  return jsonb_build_object(
    'result', 'ok',
    'now', (extract(epoch from now()) * 1000)::bigint,
    'room', jsonb_build_object('id', rm.id, 'code', rm.code, 'game', rm.game, 'host', rm.host, 'is_public', rm.is_public,
      'settings', rm.settings, 'status', rm.status, 'match_id', rm.match_id,
      'closes_at', (extract(epoch from rm.lobby_since + interval '15 minutes') * 1000)::bigint),
    'me', me,
    'players', coalesce((select jsonb_agg(jsonb_build_object(
        'user_id', p.user_id, 'name', pr.display_name, 'username', pr.username::text, 'character', p.character,
        'ready', p.ready, 'team', p.team, 'state', p.state,
        'level', public.level_for_exp(coalesce((select sum(w.exp) from public.wallet_ledger w where w.user_id = p.user_id and w.kind = 'exp'), 0)::int))
        order by p.joined_at)
      from public.room_players p join public.profiles pr on pr.id = p.user_id
      where p.room_id = r and p.state in ('in','spectator')), '[]'::jsonb));
end $function$;

create or replace function public.list_public_rooms(game text)
 returns table(id uuid, code text, host_name text, host_avatar text, host_level integer, players integer, settings jsonb)
 language sql
 stable security definer
 set search_path to ''
as $function$
  select r.id, r.code, p.display_name, hp.character,
         public.level_for_exp(coalesce((select sum(w.exp) from public.wallet_ledger w where w.user_id = r.host and w.kind = 'exp'), 0)::int),
         (select count(*)::int from public.room_players x where x.room_id = r.id and x.state = 'in'),
         r.settings
  from public.rooms r
  join public.profiles p on p.id = r.host
  join public.room_players hp on hp.room_id = r.id and hp.user_id = r.host
  where r.game = list_public_rooms.game and r.is_public and r.status = 'lobby' and r.lobby_since > now() - interval '15 minutes'
    and hp.state = 'in' and hp.last_ping > now() - interval '30 seconds'
    and (select count(*) from public.room_players x where x.room_id = r.id and x.state = 'in') between 1 and 5
    and not exists (select 1 from public.blocks b where b.active and ((b.blocker = r.host and b.blocked = (select auth.uid())) or (b.blocker = (select auth.uid()) and b.blocked = r.host)))
  order by r.created_at desc
  limit 30;
$function$;

select cron.unschedule('sweep-lobbies') where exists (select 1 from cron.job where jobname = 'sweep-lobbies');
select cron.schedule('sweep-lobbies', '* * * * *', 'select public.sweep_lobbies()');
