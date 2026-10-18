-- GA12: cw_revive never looked at the match phase. If the race timed out or the grid was completed while
-- the Revive tap was in flight, the revive still "succeeded", so the phone kept the token it had spent
-- for a heart that can never be used. Now the call advances the race first (as cw_submit does) and
-- refuses with 'over' once the crossword phase has ended; the app's Revive card refunds on any error.
-- (The token itself is still spent on the phone ledger; moving that spend to the server is a later step.)
create or replace function public.cw_revive(m uuid)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare me uuid := auth.uid(); x public.matches; p public.match_players;
begin
  select * into x from public.matches where id = m for update;
  if not found or x.game <> 'nova-crossword' then raise exception 'not a crossword match'; end if;
  perform public.race_advance(m);
  select * into x from public.matches where id = m;
  if x.phase <> 'case' then raise exception 'over'; end if;
  update public.match_players mp set hearts = 1, revived = true
   where mp.match_id = m and mp.user_id = me and mp.hearts <= 0 and not mp.revived and not mp.dropped returning * into p;
  if not found then raise exception 'cannot revive'; end if;
  return jsonb_build_object('hearts', p.hearts);
end $function$;
