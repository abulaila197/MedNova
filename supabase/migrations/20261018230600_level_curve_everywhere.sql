-- S4 (Yazan 2026-10-18: the new curve everywhere). level_for_exp still used the old curve
-- (60 + 20/level, capped at 300), so Friends, find players, lobby seats (room_state), the public room
-- list and invites/challenges showed a different level from Profile, the header and the Leaderboard
-- (wallet_level, same as src/games/engine/levels.ts) above about 5,000 EXP. All six callers pass the
-- same kind='exp' sum, so making level_for_exp use wallet_level fixes them all at once.
create or replace function public.level_for_exp(total integer)
returns integer language sql immutable set search_path to '' as $function$
  select public.wallet_level(greatest(0, coalesce(total, 0))::bigint);
$function$;

-- my_level (old curve, token formula ignoring level prizes and other token kinds) is not called by the app.
drop function if exists public.my_level();
