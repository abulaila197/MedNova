-- Silent Artist hints (#16, Yazan 2026-10-26): the field and the blanks (letter count) show from the start (were 30%
-- and 40%); some letters, never all, still come one by one from 40% to 90%. The +25 early bonus is now for a guess
-- before letters start (40% of the turn), since the field no longer waits.
create or replace function public.sa_plan(w integer, turn_ms integer)
 returns jsonb
 language plpgsql
 set search_path to ''
as $function$
declare nm text; pos int[]; np int; nl int; slots int[]; st int; en int; gap numeric;
begin
  select name into nm from public.sa_words where n = w;
  pos := array(select i - 1 from generate_series(1, length(nm)) i where substr(nm, i, 1) ~ '[A-Za-z0-9]');
  np := coalesce(cardinality(pos), 0);
  nl := case when np < 2 then 0 else least(least(greatest(floor(np * 0.35)::int, 1), 8), np - 1) end;
  slots := array(select p from unnest(pos) p order by random() limit nl);
  st := round(0.4 * turn_ms); en := round(0.9 * turn_ms);
  gap := case when nl > 0 then (en - st)::numeric / nl else 0 end;
  return jsonb_build_object('fieldAt', 0, 'lettersAt', 0, 'earlyAt', st, 'slots', to_jsonb(coalesce(slots, '{}')),
    'times', to_jsonb(array(select round(st + i * gap)::int from generate_series(1, nl) i)));
end $function$;

-- The third argument (the plan's fieldAt) is no longer the cut-off: the bonus ends when letters start.
create or replace function public.sa_points(elapsed integer, turn_ms integer, field_at integer)
 returns integer
 language sql
 immutable
 set search_path to ''
as $function$
  select round(20 + 80 * least(1, greatest(0, (turn_ms - elapsed)::numeric / turn_ms)) + case when elapsed < round(0.4 * turn_ms) then 25 else 0 end)::int;
$function$;
