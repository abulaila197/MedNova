-- DP online clue flow (#18, Yazan 2026-10-26): a right answer by anyone shows the next clue at once to everyone
-- still playing; the 10 s clock then restarts from that clue (Q9 A). A wrong answer changes nothing (the 5 s lock
-- stays). Everyone right still ends the case. The clue count now lives on the match instead of being worked out
-- from the time, so every phone shows the same clue.

alter table public.matches add column if not exists dp_clues int;
alter table public.matches add column if not exists dp_clue_at timestamptz;

create or replace function public.dp_advance(m uuid)
returns void language plpgsql security definer set search_path to '' as $function$
declare x public.matches; total int; t timestamptz := now(); early boolean;
begin
  select * into x from public.matches where id = m for update;
  if not found then return; end if;
  total := array_length(x.case_numbers, 1);
  loop
    exit when x.phase = 'done';
    if x.phase = 'case' then
      -- rule 11: a seat is held 60 s; after that the player is out and ranked last
      update public.match_players mp set dropped = true
       from public.matches mm join public.room_players rp on rp.room_id = mm.room_id
       where mm.id = m and mp.match_id = m and rp.user_id = mp.user_id and not mp.dropped
         and (rp.state not in ('in') or rp.last_ping < t - interval '60 seconds');
      select not exists (
        select 1 from public.match_players mp
        left join public.dp_case_results cr on cr.match_id = m and cr.case_index = x.case_index and cr.user_id = mp.user_id
        where mp.match_id = m and not mp.dropped and cr.solved_ms is null) into early;
      -- one clue every 10 s since the last clue (a right answer can bring one early, see dp_guess)
      x.dp_clues := coalesce(x.dp_clues, 1);
      x.dp_clue_at := coalesce(x.dp_clue_at, x.phase_started_at);
      while x.dp_clues < 6 and least(t, x.phase_ends_at) >= x.dp_clue_at + interval '10 seconds' loop
        x.dp_clues := x.dp_clues + 1;
        x.dp_clue_at := x.dp_clue_at + interval '10 seconds';
      end loop;
    else
      early := false;
    end if;
    if t < x.phase_ends_at and not early then
      update public.matches set dp_clues = x.dp_clues, dp_clue_at = x.dp_clue_at where id = m;
      exit;
    end if;
    if x.phase = 'countdown' then
      x.phase := 'case'; x.case_index := 0;
      x.phase_started_at := x.phase_ends_at; x.phase_ends_at := x.phase_started_at + interval '60 seconds';
      x.dp_clues := 1; x.dp_clue_at := x.phase_started_at;
      insert into public.dp_case_results(match_id, case_index, user_id) select m, 0, user_id from public.match_players where match_id = m and not dropped on conflict do nothing;
    elsif x.phase = 'case' then
      x.phase := 'reveal';
      x.phase_started_at := least(t, x.phase_ends_at); x.phase_ends_at := x.phase_started_at + interval '5 seconds';
    elsif x.phase = 'reveal' then
      if x.case_index + 1 < total then
        x.phase := 'case'; x.case_index := x.case_index + 1;
        x.phase_started_at := x.phase_ends_at; x.phase_ends_at := x.phase_started_at + interval '60 seconds';
        x.dp_clues := 1; x.dp_clue_at := x.phase_started_at;
        insert into public.dp_case_results(match_id, case_index, user_id) select m, x.case_index, user_id from public.match_players where match_id = m and not dropped on conflict do nothing;
      else
        x.phase := 'done'; x.ended_at := t;
        update public.match_players mp set rank = q.rk from (
          select user_id, rank() over (order by dropped, score desc, solve_ms) rk from public.match_players where match_id = m) q
         where mp.match_id = m and mp.user_id = q.user_id;
        update public.rooms set status = 'finished', updated_at = t where id = x.room_id and match_id = m;
      end if;
    end if;
    update public.matches set phase = x.phase, case_index = x.case_index, phase_started_at = x.phase_started_at, phase_ends_at = x.phase_ends_at,
      ended_at = x.ended_at, dp_clues = x.dp_clues, dp_clue_at = x.dp_clue_at where id = m;
  end loop;
end $function$;

create or replace function public.dp_guess(m uuid, answer text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare me uuid := auth.uid(); x public.matches; cr public.dp_case_results; t timestamptz := now(); ok boolean; el int; cl int; rk int; pts int[];
begin
  if not public.is_match_member(m) then raise exception 'not in this match'; end if;
  perform public.dp_advance(m);
  select * into x from public.matches where id = m for update;
  if x.phase <> 'case' then return jsonb_build_object('outcome', 'ignored_finished'); end if;
  select * into cr from public.dp_case_results where match_id = m and case_index = x.case_index and user_id = me for update;
  if not found or cr.solved_ms is not null then return jsonb_build_object('outcome', 'ignored_finished'); end if;
  if cr.locked_until is not null and t < cr.locked_until then
    return jsonb_build_object('outcome', 'ignored_locked', 'locked_until', (extract(epoch from cr.locked_until) * 1000)::bigint);
  end if;
  select (c.answer_id = answer) into ok from public.dp_cases c where c.number = x.case_numbers[x.case_index + 1];
  if ok then
    el := (extract(epoch from (t - x.phase_started_at)) * 1000)::int;
    cl := least(6, greatest(1, coalesce(x.dp_clues, el / 10000 + 1)));
    select count(*) + 1 into rk from public.dp_case_results where match_id = m and case_index = x.case_index and solved_ms is not null and solved_ms < el;
    pts := public.dp_points(rk, cl, el);
    update public.dp_case_results set solved_ms = el, clues_shown = cl, rank = rk, rank_points = pts[1], clues_bonus = pts[2], time_bonus = pts[3], points = pts[1] + pts[2] + pts[3]
     where match_id = m and case_index = x.case_index and user_id = me;
    update public.match_players set score = score + pts[1] + pts[2] + pts[3], solve_ms = solve_ms + el where match_id = m and user_id = me;
    -- #18: the next clue now for everyone still playing; the next one 10 s after it.
    if cl < 6 then
      update public.matches set dp_clues = cl + 1, dp_clue_at = t where id = m;
    end if;
    perform public.dp_advance(m);
    return jsonb_build_object('outcome', 'correct', 'rank', rk, 'clues', cl, 'points', pts[1] + pts[2] + pts[3]);
  end if;
  if answer = any(cr.wrong) then return jsonb_build_object('outcome', 'ignored_duplicate'); end if;
  update public.dp_case_results set wrong = wrong || answer, locked_until = t + interval '5 seconds'
   where match_id = m and case_index = x.case_index and user_id = me;
  return jsonb_build_object('outcome', 'wrong', 'locked_until', (extract(epoch from (t + interval '5 seconds')) * 1000)::bigint);
end $function$;

create or replace function public.dp_state(m uuid)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare me uuid := auth.uid(); x public.matches; ans text; ms bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  if not public.is_match_member(m) then raise exception 'not in this match'; end if;
  perform public.dp_advance(m);
  select * into x from public.matches where id = m;
  if x.phase in ('reveal','done') then
    select answer_id into ans from public.dp_cases where number = x.case_numbers[x.case_index + 1];
  end if;
  return jsonb_build_object(
    'now', ms,
    'room_id', x.room_id,
    'phase', x.phase,
    'phase_started_at', (extract(epoch from x.phase_started_at) * 1000)::bigint,
    'phase_ends_at', (extract(epoch from x.phase_ends_at) * 1000)::bigint,
    'case_index', x.case_index,
    'total', array_length(x.case_numbers, 1),
    'case_number', case when x.phase = 'countdown' then null else x.case_numbers[x.case_index + 1] end,
    'answer_id', ans,
    'clues', case when x.phase = 'case' then coalesce(x.dp_clues, 1) else null end,
    'clue_at', case when x.phase = 'case' then (extract(epoch from coalesce(x.dp_clue_at, x.phase_started_at)) * 1000)::bigint else null end,
    'settings', x.settings,
    'players', coalesce((select jsonb_agg(jsonb_build_object(
        'user_id', mp.user_id, 'name', mp.display_name, 'character', mp.character, 'team', mp.team,
        'score', mp.score, 'solve_ms', mp.solve_ms, 'dropped', mp.dropped, 'rank', mp.rank,
        'solved', cr.solved_ms is not null, 'case_rank', cr.rank, 'case_points', cr.points, 'solved_ms', cr.solved_ms)
        order by mp.score desc, mp.solve_ms)
      from public.match_players mp
      left join public.dp_case_results cr on cr.match_id = m and cr.case_index = x.case_index and cr.user_id = mp.user_id
      where mp.match_id = m), '[]'::jsonb),
    'me', (select jsonb_build_object('locked_until', (extract(epoch from cr.locked_until) * 1000)::bigint, 'wrong', to_jsonb(coalesce(cr.wrong, '{}'::text[])),
        'solved_ms', cr.solved_ms, 'rank', cr.rank, 'points', cr.points, 'clues', cr.clues_shown)
      from public.dp_case_results cr where cr.match_id = m and cr.case_index = x.case_index and cr.user_id = me),
    'my_cases', case when x.phase = 'done' then coalesce((select jsonb_agg(jsonb_build_object('case_index', cr.case_index, 'case_number', x.case_numbers[cr.case_index + 1],
        'solved_ms', cr.solved_ms, 'clues', cr.clues_shown, 'rank', cr.rank, 'points', cr.points, 'wrong', to_jsonb(coalesce(cr.wrong, '{}'::text[]))) order by cr.case_index)
      from public.dp_case_results cr where cr.match_id = m and cr.user_id = me), '[]'::jsonb) else null end
  );
end $function$;
