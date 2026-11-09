-- MedNova: remove the server parts of The Conqueror, Nova Password, Code Clinic and Trust Me Not (2026-11-09).
-- Their games are already off the Games page in every app version, so nothing calls these.
-- Shared tables (matches, Quiz Parade pq_keys, Wheels wc_*) are NOT touched.
begin;

-- 1. A trigger on profiles cleans Conqueror views; remove it first so profile updates keep working.
drop trigger if exists profiles_cq_views_clean on public.profiles;

-- 2. The live-state lookup stops listing the removed games.
create or replace function public.poll_state(fn text, m uuid, seen text default null::text)
 returns jsonb
 language plpgsql
 set search_path to 'public'
as $function$
declare
  j jsonb;
  h text;
begin
  -- Only the match state functions can be asked for, by exact name (no free text reaches the query).
  if fn not in ('dp_state', 'race_state', 'wc_state', 'im_state') then
    raise exception 'unknown state %', fn;
  end if;
  execute format('select to_jsonb(public.%I($1))', fn) into j using m;
  if j is null or jsonb_typeof(j) <> 'object' then
    return j;
  end if;
  -- `now` is the server clock, new on every answer, so it is left out of the fingerprint.
  h := md5((j - 'now')::text);
  if seen is not null and seen = h then
    return jsonb_build_object('now', j -> 'now', 'same', true);
  end if;
  return j || jsonb_build_object('h', h);
end;
$function$;

-- 3. The games' own functions.
drop function if exists public.cq_views_clean();
drop function if exists public.cq_load(uuid, uuid);
drop function if exists public.cq_state(uuid);
drop function if exists public.cq_save(uuid, integer, jsonb, bigint, jsonb, integer[], integer[], uuid[], text);
drop function if exists public.tmn_load(uuid, uuid);
drop function if exists public.tmn_state(uuid);
drop function if exists public.tmn_save(uuid, integer, jsonb, bigint, jsonb, integer[], integer[], uuid[], text);
drop function if exists public.pw_load(uuid, uuid);
drop function if exists public.pw_state(uuid);
drop function if exists public.pw_save(uuid, integer, jsonb, jsonb, bigint, integer[], integer[], text);
drop function if exists public.cc_load(uuid, uuid);
drop function if exists public.cc_state(uuid);
drop function if exists public.cc_save(uuid, integer, jsonb, jsonb, bigint, integer[], integer[], text);

-- 4. The games' own tables (question banks, word lists, saved rooms).
drop table if exists public.cq_views, public.cq_games, public.cq_bank;
drop table if exists public.tmn_views, public.tmn_games, public.tmn_keys;
drop table if exists public.pw_games, public.pw_terms;
drop table if exists public.cc_games;

commit;

-- Check: should list nothing.
select relname from pg_class where relname in ('cq_bank','cq_games','cq_views','tmn_keys','tmn_games','tmn_views','pw_terms','pw_games','cc_games');
