-- Level tokens (Yazan 2026-10-26): 5 tokens a level up and 20 in all on every 5th level (was 1 and 4).
-- Mirrors TOKENS_PER_LEVEL and FIFTH_LEVEL_PRIZE in src/games/engine/levels.ts. The balance counts level tokens from
-- the level itself, so levels already reached pay the new amounts too.
create or replace function public.wallet_level_tokens(lvl integer)
 returns integer
 language sql
 immutable
 set search_path to ''
as $function$ select 5 * (lvl - 1) + 15 * (lvl / 5) $function$;
