-- App fixes 2026-11-04, group 2 (point 6): The Conqueror, Nova Password and Code Clinic are taken off (parked, like
-- Trust Me Not). Their tables, banks and referees stay; no new room can open or start for them, matches already
-- running finish. Full Rotation, the character hunt and Grand Rounds count the 10 games left.

create or replace function public.rotation_games()
 returns text[]
 language sql
 immutable
 set search_path to ''
as $function$
  select array['case-files-unsolved','nova-crossword','the-diagnostic-pursuit','nova-medicordle',
    'the-riddler','the-silent-artist','the-streak-master','the-wheels-of-chaos',
    'the-quiz-parade','imposter']
$function$;

-- Grand Rounds: 10 game weeks then the 3 mode weeks, a 13-week cycle (was 16).
create or replace function public.rounds_week(w integer)
 returns jsonb
 language sql
 immutable
 set search_path to ''
as $function$
  select case when s < 10 then jsonb_build_object('kind', 'game', 'slot', s, 'game', (array['the-diagnostic-pursuit','the-silent-artist','nova-crossword',
      'the-quiz-parade','the-riddler','nova-medicordle','the-streak-master',
      'case-files-unsolved','the-wheels-of-chaos','imposter'])[s + 1])
    else jsonb_build_object('kind', 'mode', 'slot', s, 'mode', (array['online','solo','offline'])[s - 9]) end
  from (select ((w % 13) + 13) % 13 s) x
$function$;

-- The rest are edits in place of the live functions; each one must find its text or the whole file stops.
do $do$
declare f text; g text;
begin
  -- New rooms and starts refuse the parked games.
  f := pg_get_functiondef('public.create_room(text, jsonb, boolean, text)'::regprocedure);
  g := replace(f, $s$'the-wheels-of-chaos', 'the-conqueror', 'trust-me-not', 'the-quiz-parade', 'imposter', 'code-clinic', 'nova-password')$s$,
                  $s$'the-wheels-of-chaos', 'the-quiz-parade', 'imposter')$s$);
  if g = f then raise exception 'create_room: game list not found'; end if;
  execute g;

  f := pg_get_functiondef('public.start_match(uuid)'::regprocedure);
  g := replace(f, $s$raise exception 'cannot start'; end if;$s$,
                  $s$raise exception 'cannot start'; end if;
  if rm.game in ('the-conqueror', 'code-clinic', 'nova-password', 'trust-me-not') then raise exception 'game not online yet'; end if;$s$);
  if g = f then raise exception 'start_match: start check not found'; end if;
  execute g;

  -- Grand Rounds cycle prize: 13 different weeks.
  f := pg_get_functiondef('public.rounds_cycle_have(uuid)'::regprocedure);
  g := replace(f, '% 16) + 16) % 16', '% 13) + 13) % 13');
  if g = f then raise exception 'rounds_cycle_have: 16 not found'; end if;
  execute g;

  f := pg_get_functiondef('public.rounds_claim(integer)'::regprocedure);
  g := replace(f, 'rounds_cycle_have(uid) >= 16', 'rounds_cycle_have(uid) >= 13');
  if g = f then raise exception 'rounds_claim: 16 not found'; end if;
  execute g;

  f := pg_get_functiondef('public.rounds_status()'::regprocedure);
  g := replace(f, $s$'of', 16,$s$, $s$'of', 13,$s$);
  if g = f then raise exception 'rounds_status: 16 not found'; end if;
  execute g;

  -- Character hunt: Iris = all 10 games; Layla = 29 wins (10 multiplayer games x Pass the phone + Online, 9 Solo).
  f := pg_get_functiondef('public.hunt_progress(uuid)'::regprocedure);
  g := replace(f, $s$union all values ('imposter'),('code-clinic'),('nova-password')) a(g)$s$, $s$union all values ('imposter')) a(g)$s$);
  g := replace(g, $s$
    union all values ('the-conqueror','online')),$s$, $s$),$s$);
  g := replace(g, $s$union all values ('imposter'),('code-clinic'),('nova-password'),('the-conqueror'))$s$, $s$union all values ('imposter'))$s$);
  g := replace(g, 'games.g)), 13)', 'games.g)), 10)');
  g := replace(g, $s$fin.mode = 'solo')), 34)$s$, $s$fin.mode = 'solo')), 29)$s$);
  if g = f or position('code-clinic' in g) > 0 or position('the-conqueror' in g) > 0 or position(', 34)' in g) > 0 or position('games.g)), 10)' in g) = 0 then
    raise exception 'hunt_progress: edits not all found';
  end if;
  execute g;
end $do$;
