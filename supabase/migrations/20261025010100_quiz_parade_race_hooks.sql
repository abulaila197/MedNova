-- The Quiz Parade on the race layer: room creation, question picks, per-type clocks, scoring and the EXP cap (QP11).

create or replace function public.race_conf(game text, settings jsonb)
 returns integer[] language sql immutable set search_path to '' as $function$
  select case game
    when 'the-riddler' then array[90000, 5000]
    when 'nova-medicordle' then array[coalesce((settings->>'wordtime')::int, 90) * 1000, 5000]
    when 'the-streak-master' then array[coalesce((settings->>'qtime')::int, 15) * 1000, 5000]
    when 'nova-crossword' then array[coalesce((settings->>'timelimit')::int, 10) * 60000, 4000]
    when 'case-files-unsolved' then array[coalesce((settings->>'timelimit')::int, 10) * 60000, 8000]
    -- QP2: each question's own clock comes from pq_time; this is only the result pause.
    when 'the-quiz-parade' then array[25000, 5000]
    else array[60000, 5000] end;
$function$;

create or replace function public.race_advance(m uuid)
 returns void language plpgsql security definer set search_path to '' as $function$
declare x public.matches; total int; t timestamptz := now(); early boolean; conf int[];
begin
  select * into x from public.matches where id = m for update;
  if not found then return; end if;
  if x.game = 'the-silent-artist' then perform public.sa_advance(m); return; end if;
  total := array_length(x.case_numbers, 1);
  conf := public.race_conf(x.game, x.settings);
  loop
    exit when x.phase = 'done';
    if x.phase = 'case' then
      update public.match_players mp set dropped = true
       from public.matches mm join public.room_players rp on rp.room_id = mm.room_id
       where mm.id = m and mp.match_id = m and rp.user_id = mp.user_id and not mp.dropped
         and (rp.state not in ('in') or rp.last_ping < t - interval '60 seconds');
      select not exists (
        select 1 from public.match_players mp
        left join public.race_results rr on rr.match_id = m and rr.item_index = x.case_index and rr.user_id = mp.user_id
        where mp.match_id = m and not mp.dropped and not coalesce(rr.done, false)) into early;
    else
      early := false;
    end if;
    exit when t < x.phase_ends_at and not early;
    if x.phase = 'countdown' or (x.phase = 'reveal' and x.case_index + 1 < total) then
      if x.phase = 'countdown' then x.case_index := 0; else x.case_index := x.case_index + 1; end if;
      x.phase := 'case';
      x.phase_started_at := x.phase_ends_at;
      x.phase_ends_at := x.phase_started_at + make_interval(secs => case when x.game = 'the-quiz-parade'
        then public.pq_time(x.case_numbers[x.case_index + 1])::double precision else conf[1] / 1000.0 end);
      insert into public.race_results(match_id, item_index, user_id) select m, x.case_index, user_id from public.match_players where match_id = m and not dropped on conflict do nothing;
    elsif x.phase = 'case' then
      -- Streak Master: no answer in time breaks the streak.
      if x.game = 'the-streak-master' then perform public.sm_score_question(m, x.case_index); end if;
      if x.game = 'the-quiz-parade' then perform public.pq_score_question(m, x.case_index); end if;
      x.phase := 'reveal';
      x.phase_started_at := least(t, x.phase_ends_at); x.phase_ends_at := x.phase_started_at + make_interval(secs => conf[2] / 1000.0);
    else
      x.phase := 'done'; x.ended_at := t;
      update public.match_players mp set rank = q.rk from (
        select user_id, rank() over (order by dropped, score desc, best_streak desc, correct desc, solve_ms) rk from public.match_players where match_id = m) q
       where mp.match_id = m and mp.user_id = q.user_id;
      update public.rooms set status = 'finished', updated_at = t where id = x.room_id and match_id = m;
    end if;
    update public.matches set phase = x.phase, case_index = x.case_index, phase_started_at = x.phase_started_at, phase_ends_at = x.phase_ends_at, ended_at = x.ended_at where id = m;
  end loop;
end $function$;

create or replace function public.create_room(game text, settings jsonb, is_public boolean, wanted text default null::text)
 returns uuid language plpgsql security definer set search_path to '' as $function$
declare me uuid := auth.uid(); r uuid; c text; other uuid; tries int := 0;
begin
  if me is null then raise exception 'not signed in'; end if;
  if game not in ('the-diagnostic-pursuit', 'the-riddler', 'nova-medicordle', 'the-streak-master', 'nova-crossword',
                  'case-files-unsolved', 'the-silent-artist', 'the-wheels-of-chaos', 'the-conqueror', 'trust-me-not', 'the-quiz-parade') then
    raise exception 'game not online yet';
  end if;
  for other in select room_id from public.room_players where user_id = me and state in ('in','spectator') loop
    perform public.leave_room(other);
  end loop;
  loop
    c := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.rooms where code = c and status <> 'closed');
    tries := tries + 1;
    if tries > 30 then raise exception 'no free room code'; end if;
  end loop;
  insert into public.rooms(code, game, host, is_public, settings) values (c, game, me, is_public, coalesce(settings, '{}')) returning id into r;
  insert into public.room_players(room_id, user_id, character, ready, state) values (r, me, coalesce(wanted, 'yara'), true, 'in');
  return r;
end $function$;

create or replace function public.start_match(r uuid)
 returns uuid language plpgsql security definer set search_path to '' as $function$
declare me uuid := auth.uid(); rm public.rooms; m uuid; n int; d text; k int; picks int[]; st text;
begin
  select * into rm from public.rooms where id = r for update;
  if not found or rm.host <> me or rm.status <> 'lobby' then raise exception 'cannot start'; end if;
  select count(*) into n from public.room_players where room_id = r and state = 'in';
  if n < 2 then raise exception 'need 2 players'; end if;
  if rm.game = 'trust-me-not' and n < 3 then raise exception 'need 3 players'; end if;
  if n > public.room_cap(rm.game) then raise exception 'too many players'; end if;
  if exists (select 1 from public.room_players where room_id = r and state = 'in' and not ready) then raise exception 'not everyone is ready'; end if;
  if rm.game = 'the-diagnostic-pursuit' then
    d := coalesce(rm.settings->>'difficulty', 'Medium');
    k := least(greatest(coalesce((rm.settings->>'cases')::int, 5), 1), 10);
    picks := array(select number from public.dp_cases where difficulty = d order by random() limit k);
  elsif rm.game = 'the-riddler' then
    k := least(greatest(coalesce((rm.settings->>'photos')::int, 5), 1), 10);
    picks := array(select g from generate_series(1, 86) g order by random() limit k);
  elsif rm.game = 'nova-medicordle' then
    k := least(greatest(coalesce((rm.settings->>'words')::int, 5), 1), 10);
    st := coalesce(rm.settings->>'style', 'classic');
    picks := array(select w.n from public.nm_words w where w.style = st order by random() limit k);
  elsif rm.game = 'the-streak-master' then
    k := least(greatest(coalesce((rm.settings->>'questions')::int, 15), 1), 20);
    st := coalesce(rm.settings->>'style', 'mixed');
    if st = 'mixed' then
      picks := array(select z.qn from (
        (select q.n as qn from public.sm_questions q where q.kind = 'basic' order by random() limit k / 2)
        union all
        (select q.n from public.sm_questions q where q.kind = 'clinical' order by random() limit k - k / 2)) z order by random());
    else
      picks := array(select q.n from public.sm_questions q where q.kind = st order by random() limit k);
    end if;
  elsif rm.game = 'the-quiz-parade' then
    -- QP4: 5, 10 or 15 questions; Mixed is about half and half.
    k := coalesce((rm.settings->>'questions')::int, 10);
    if k not in (5, 10, 15) then k := 10; end if;
    st := coalesce(rm.settings->>'style', 'mixed');
    if st = 'mixed' then
      picks := array(select z.qn from (
        (select q.n as qn from public.pq_keys q where q.kind = 'basic' order by random() limit k / 2)
        union all
        (select q.n from public.pq_keys q where q.kind = 'clinical' order by random() limit k - k / 2)) z order by random());
    else
      picks := array(select q.n from public.pq_keys q where q.kind = st order by random() limit k);
    end if;
  elsif rm.game = 'nova-crossword' then
    -- CW10: one random puzzle.
    picks := array(select z.n from (select distinct w.n from public.cw_words w) z order by random() limit 1);
  elsif rm.game = 'case-files-unsolved' then
    -- CF11: one random case.
    picks := array(select cc.n from public.cf_cases cc order by random() limit 1);
  elsif rm.game = 'the-silent-artist' then
    -- SA12: one turn per player per draw; the words are picked turn by turn (sa_advance).
    k := least(greatest(coalesce((rm.settings->>'performs')::int, 1), 1), 3);
    picks := array_fill(0, array[n * k]);
  elsif rm.game in ('the-wheels-of-chaos', 'the-conqueror', 'trust-me-not') then
    -- WC20-WC23, CQ1: these referees run the whole match from their own table; there is no list of cases.
    picks := array[0];
  else
    raise exception 'no online for this game';
  end if;
  if coalesce(array_length(picks, 1), 0) = 0 then raise exception 'no cases'; end if;
  insert into public.matches(room_id, game, settings, case_numbers, phase, phase_started_at, phase_ends_at)
    values (r, rm.game, rm.settings, picks, 'countdown', now(), now() + interval '3500 milliseconds') returning id into m;
  insert into public.match_players(match_id, user_id, display_name, character, team)
    select m, p.user_id, pr.display_name, p.character, p.team from public.room_players p join public.profiles pr on pr.id = p.user_id
     where p.room_id = r and p.state = 'in';
  update public.rooms set status = 'playing', match_id = m, updated_at = now() where id = r;
  return m;
end $function$;

create or replace function public.wallet_exp_cap(game text, mode text, settings jsonb)
 returns integer language sql immutable set search_path to '' as $function$
  select case
    when mode = 'offline' then 0
    when game = 'case-files-unsolved' then 60
    when game = 'the-conqueror' then case when mode = 'online' then 400 else 0 end
    when game = 'nova-crossword' then case when mode = 'online' then 12 else 31 * 12 end
    when game = 'the-diagnostic-pursuit' then 12 * least(10, greatest(1, coalesce((settings->>'cases')::int, 5)))
    when game = 'nova-medicordle' then case
      when mode = 'online' then 12 * least(10, greatest(1, coalesce((settings->>'words')::int, 5)))
      when settings->>'word' = 'daily' then 24
      when settings->>'word' = 'endless' then 1800
      else 0 end
    when game = 'the-riddler' then case when mode = 'online' then 12 * least(10, greatest(1, coalesce((settings->>'photos')::int, 5))) else 86 * 12 end
    when game = 'the-silent-artist' then 0
    when game = 'the-streak-master' then 60
    when game = 'the-quiz-parade' then 60
    when game = 'trust-me-not' then 250
    when game = 'the-wheels-of-chaos' then (least(100, greatest(50, coalesce((settings->>'target')::int, 50))) + case when mode = 'online' then 38 else 9 end) / 2
    else 0 end;
$function$;
