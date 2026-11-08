-- Group 1 fix (Yazan 2026-11-02): race_state's variable `item` clashed with the `item` column that My diseases added to
-- nm_words and sm_questions (Oct 26): "column reference item is ambiguous" at every answer reveal and at Medicordle's
-- first word, which rolled back the match's step, so race matches froze (no answer, no streak, no results).
-- Same function as live, with the variable renamed to v_item. Nothing else changes.
create or replace function public.race_state(m uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare me uuid := auth.uid(); x public.matches; ms bigint := (extract(epoch from now()) * 1000)::bigint; v_item int; ans text; word text; showing boolean;
begin
  if not public.is_match_member(m) then raise exception 'not in this match'; end if;
  perform public.race_advance(m);
  select * into x from public.matches where id = m;
  if x.game = 'the-silent-artist' then return public.sa_state(m); end if;
  v_item := case when x.phase = 'countdown' then null else x.case_numbers[x.case_index + 1] end;
  showing := x.phase in ('reveal', 'done');
  if x.game = 'nova-medicordle' and v_item is not null then select w.word into word from public.nm_words w where w.n = v_item; end if;
  if showing and v_item is not null then
    ans := case x.game
      when 'the-riddler' then 'r-' || lpad(v_item::text, 3, '0')
      when 'nova-medicordle' then word
      when 'the-streak-master' then (select q.answer::text from public.sm_questions q where q.n = v_item) end;
  end if;
  return jsonb_build_object(
    'now', ms, 'room_id', x.room_id, 'game', x.game, 'phase', x.phase,
    'phase_started_at', (extract(epoch from x.phase_started_at) * 1000)::bigint,
    'phase_ends_at', (extract(epoch from x.phase_ends_at) * 1000)::bigint,
    'index', x.case_index, 'total', array_length(x.case_numbers, 1), 'item', v_item, 'answer', ans, 'settings', x.settings,
    'claims', case when x.game = 'nova-crossword' then coalesce((select jsonb_agg(jsonb_build_object('word_id', cc.word_id, 'user_id', cc.user_id, 'at_ms', cc.at_ms, 'auto', cc.auto) order by cc.at_ms)
      from public.cw_claims cc where cc.match_id = m), '[]'::jsonb) end,
    'tried', case when x.game = 'nova-crossword' then (select mp.tried from public.match_players mp where mp.match_id = m and mp.user_id = me) end,
    'word_len', case when word is not null then length(word) end,
    'players', coalesce((select jsonb_agg(jsonb_build_object(
        'user_id', mp.user_id, 'name', mp.display_name, 'character', mp.character, 'team', mp.team,
        'score', case when x.game = 'case-files-unsolved' and not showing and mp.user_id <> me then null else mp.score end, 'solve_ms', mp.solve_ms, 'dropped', mp.dropped, 'rank', mp.rank,
        'streak', mp.streak, 'best_streak', mp.best_streak, 'correct', mp.correct,
        'done', coalesce(rr.done, false), 'solved', rr.solved_ms is not null, 'item_rank', rr.rank, 'item_points', case when x.game = 'case-files-unsolved' and not showing and mp.user_id <> me then null else rr.points end, 'stage', rr.stage,
        'tries', coalesce(array_length(rr.guesses, 1), 0), 'pick', case when showing then rr.pick end,
        'hearts', mp.hearts, 'revived', mp.revived,
        'greens', case when word is not null then public.race_state_greens(rr.guesses, word) end)
        order by case when x.game = 'case-files-unsolved' and not showing then mp.display_name end, mp.score desc, mp.solve_ms)
      from public.match_players mp
      left join public.race_results rr on rr.match_id = m and rr.item_index = x.case_index and rr.user_id = mp.user_id
      where mp.match_id = m), '[]'::jsonb),
    'me', (select jsonb_build_object('locked_until', (extract(epoch from rr.locked_until) * 1000)::bigint, 'wrong', to_jsonb(rr.wrong),
        'guesses', to_jsonb(rr.guesses),
        'marks', case when word is not null then (select coalesce(jsonb_agg(public.nm_marks(g, word) order by o), '[]'::jsonb) from unnest(rr.guesses) with ordinality u(g, o)) end,
        'pick', rr.pick, 'done', rr.done, 'solved_ms', rr.solved_ms, 'rank', rr.rank, 'points', rr.points)
      from public.race_results rr where rr.match_id = m and rr.item_index = x.case_index and rr.user_id = me),
    'my_items', case when x.phase = 'done' then coalesce((select jsonb_agg(jsonb_build_object('index', rr.item_index, 'item', x.case_numbers[rr.item_index + 1],
        'solved_ms', rr.solved_ms, 'rank', rr.rank, 'points', rr.points, 'wrong', to_jsonb(rr.wrong), 'guesses', to_jsonb(rr.guesses), 'pick', rr.pick) order by rr.item_index)
      from public.race_results rr where rr.match_id = m and rr.user_id = me), '[]'::jsonb) else null end
  );
end $function$;

select 'race_state fixed' as done;

-- Quiz Parade answer shows for 3 s instead of 5 s (Yazan 2026-11-02).
create or replace function public.race_conf(game text, settings jsonb)
 returns integer[]
 language sql
 immutable
 set search_path to ''
as $function$
  select case game
    when 'the-riddler' then array[90000, 5000]
    when 'nova-medicordle' then array[coalesce((settings->>'wordtime')::int, 90) * 1000, 5000]
    when 'the-streak-master' then array[coalesce((settings->>'qtime')::int, 15) * 1000, 5000]
    when 'nova-crossword' then array[coalesce((settings->>'timelimit')::int, 10) * 60000, 4000]
    when 'case-files-unsolved' then array[coalesce((settings->>'timelimit')::int, 10) * 60000, 8000]
    when 'the-quiz-parade' then array[25000, 3000]
    else array[60000, 5000] end;
$function$;

select 'quiz parade reveal 3 s' as done;
