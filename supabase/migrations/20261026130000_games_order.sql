-- New Games page order (Yazan 2026-10-26). Grand Rounds' 13 game weeks follow the Games page order, so the week
-- rotation follows too. Same body as 20261025130000_grand_rounds_missions.sql, only the game list changes.
create or replace function public.rounds_week(w integer)
 returns jsonb
 language sql
 immutable
 set search_path to ''
as $function$
  select case when s < 13 then jsonb_build_object('kind', 'game', 'slot', s, 'game', (array['the-diagnostic-pursuit','the-silent-artist','nova-crossword',
      'the-quiz-parade','the-riddler','the-conqueror','nova-password','nova-medicordle','the-streak-master','code-clinic',
      'case-files-unsolved','the-wheels-of-chaos','imposter'])[s + 1])
    else jsonb_build_object('kind', 'mode', 'slot', s, 'mode', (array['online','solo','offline'])[s - 12]) end
  from (select ((w % 16) + 16) % 16 s) x
$function$;
