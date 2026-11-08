-- Case Files and Crossword online: 1, 2 or 3 cases (puzzles) back to back (Yazan 2026-10-25, Sparks table). Each case
-- keeps the host's time limit; points add up into one result. Crossword: every puzzle starts with 5 hearts and its own
-- revive, and its stars go by place on that puzzle, so EXP adds up. Also lets the EXP cap take Wheels' new 25 target.

-- The setting is 'count' (1-3); older rooms have none and play one case.
create or replace function public.race_count(settings jsonb) returns int
language sql immutable set search_path = '' as $$
  select least(greatest(coalesce((settings->>'count')::int, 1), 1), 3);
$$;

create or replace function public.start_match(r uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare me uuid := auth.uid(); rm public.rooms; m uuid; n int; d text; k int; picks int[]; st text;
begin
  select * into rm from public.rooms where id = r for update;
  if not found or rm.host <> me or rm.status <> 'lobby' then raise exception 'cannot start'; end if;
  select count(*) into n from public.room_players where room_id = r and state = 'in';
  if n < 2 then raise exception 'need 2 players'; end if;
  if rm.game in ('trust-me-not', 'imposter') and n < 3 then raise exception 'need 3 players'; end if;
  if rm.game = 'code-clinic' and n < 4 then raise exception 'need 4 players'; end if;
  if rm.game = 'nova-password' and n <> 4 then raise exception 'need exactly 4 players'; end if;
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
    -- CW10: 1 to 3 random puzzles, back to back.
    picks := array(select z.n from (select distinct w.n from public.cw_words w) z order by random() limit public.race_count(rm.settings));
  elsif rm.game = 'case-files-unsolved' then
    -- CF11: 1 to 3 random cases, back to back.
    picks := array(select cc.n from public.cf_cases cc order by random() limit public.race_count(rm.settings));
  elsif rm.game = 'the-silent-artist' then
    -- SA12: one turn per player per draw; the words are picked turn by turn (sa_advance).
    k := least(greatest(coalesce((rm.settings->>'performs')::int, 1), 1), 3);
    picks := array_fill(0, array[n * k]);
  elsif rm.game in ('the-wheels-of-chaos', 'the-conqueror', 'trust-me-not', 'imposter', 'code-clinic', 'nova-password') then
    -- WC20-WC23, CQ1, IM2, CC1, Nova Password: these referees run the whole match from their own table; there is no list of cases.
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

-- Case Files: a player's match score and finish time over every case so far. A case not finished counts a day, so it
-- ranks behind every finished one (as before).
create or replace function public.cf_total(m uuid, uid uuid) returns void
language sql security definer set search_path = '' as $$
  update public.match_players mp set
    score = coalesce((select sum(rr.points) from public.race_results rr where rr.match_id = m and rr.user_id = uid), 0),
    solve_ms = coalesce((select sum(case when rr.done then coalesce(rr.answered_ms, 86400000) else 86400000 end)
                           from public.race_results rr where rr.match_id = m and rr.user_id = uid), 0)
   where mp.match_id = m and mp.user_id = uid;
$$;

create or replace function public.race_advance(m uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
      -- Crossword: each puzzle starts with full hearts and its own revive.
      if x.game = 'nova-crossword' and x.case_index > 0 then
        update public.match_players mp set hearts = 5, revived = false where mp.match_id = m;
      end if;
    elsif x.phase = 'case' then
      if x.game = 'the-streak-master' then perform public.sm_score_question(m, x.case_index); end if;
      if x.game = 'the-quiz-parade' then perform public.pq_score_question(m, x.case_index); end if;
      if x.game = 'case-files-unsolved' then
        perform public.cf_total(m, mp.user_id) from public.match_players mp where mp.match_id = m;
      end if;
      -- Crossword: the place on this puzzle sets its stars (most letters, then the earlier last claim).
      if x.game = 'nova-crossword' then
        update public.race_results rr set rank = q.rk from (
          select r2.user_id, rank() over (order by r2.points desc, r2.solved_ms nulls last) rk
            from public.race_results r2 where r2.match_id = m and r2.item_index = x.case_index) q
         where rr.match_id = m and rr.item_index = x.case_index and rr.user_id = q.user_id;
      end if;
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

create or replace function public.cf_step(m uuid, stage text, filtered text[] default null::text[], provisional text default null::text, redemption text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare me uuid := auth.uid(); x public.matches; rr public.race_results; c public.cf_cases; ms int; dd int; solved boolean; complete boolean; total int;
begin
  select * into x from public.matches where id = m for update;
  if not found or x.game <> 'case-files-unsolved' then raise exception 'not a case files match'; end if;
  perform public.race_advance(m);
  select * into x from public.matches where id = m;
  if x.phase <> 'case' then return jsonb_build_object('result', 'over'); end if;
  select * into rr from public.race_results r where r.match_id = m and r.item_index = x.case_index and r.user_id = me;
  if not found then raise exception 'not playing'; end if;
  if rr.done then return jsonb_build_object('result', 'done'); end if;
  select * into c from public.cf_cases cc where cc.n = x.case_numbers[x.case_index + 1];
  ms := (extract(epoch from (now() - x.phase_started_at)) * 1000)::int;
  if stage in ('Examination', 'Investigations', 'Treatment', 'Finished') then rr.stage := stage; end if;
  if filtered is not null and rr.dd is null then rr.dd := (select array_agg(f) from (select distinct f from unnest(filtered) f limit 5) z); end if;
  if provisional is not null and rr.prov is null and rr.dd is not null then rr.prov := provisional; end if;
  if redemption is not null and rr.redeem is null and rr.prov is not null and rr.prov <> c.final then rr.redeem := redemption; end if;
  solved := coalesce(rr.prov = c.final, false) or coalesce(rr.redeem = c.final, false);
  complete := coalesce(rr.prov = c.final, false) or rr.redeem is not null;
  dd := case when rr.dd is null then 0 else public.cf_dd_score(c.dd2, rr.dd, c.final, c.parent) end;
  total := dd + case when rr.prov = c.final then 20 else 0 end + case when rr.redeem = c.final then 10 else 0 end
    + case when solved then round(10 * greatest(0, 1 - ms / 300000.0))::int else 0 end;
  if complete then rr.stage := 'Finished'; end if;
  update public.race_results r set stage = rr.stage, dd = rr.dd, prov = rr.prov, redeem = rr.redeem, points = total,
    done = complete, solved_ms = case when solved then ms end, answered_ms = case when complete then ms end
   where r.match_id = m and r.item_index = x.case_index and r.user_id = me;
  -- Points add up over the cases; tie on points = faster finish.
  perform public.cf_total(m, me);
  return jsonb_build_object('result', 'ok', 'complete', complete);
end $function$;

create or replace function public.cw_submit(m uuid, word_id text, answer text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare me uuid := auth.uid(); x public.matches; p public.match_players; w public.cw_words; a text := upper(coalesce(answer, ''));
  at int; got text[] := '{}'; more text[]; gained int := 0; prev jsonb;
begin
  select * into x from public.matches where id = m for update;
  if not found or x.game <> 'nova-crossword' then raise exception 'not a crossword match'; end if;
  perform public.race_advance(m);
  select * into x from public.matches where id = m;
  if x.phase <> 'case' then return jsonb_build_object('result', 'over'); end if;
  select * into p from public.match_players mp where mp.match_id = m and mp.user_id = me;
  if not found or p.dropped then raise exception 'not playing'; end if;
  if p.hearts <= 0 then return jsonb_build_object('result', 'out'); end if;
  select * into w from public.cw_words cw where cw.id = word_id and cw.n = x.case_numbers[x.case_index + 1];
  if not found then raise exception 'no such word'; end if;
  if exists (select 1 from public.cw_claims cc where cc.match_id = m and cc.word_id = w.id) then return jsonb_build_object('result', 'taken'); end if;
  if length(a) <> length(w.answer) or a !~ '^[A-Z]+$' then raise exception 'bad answer'; end if;
  prev := coalesce(p.tried -> w.id, '[]'::jsonb);
  if a <> w.answer and prev ? a then return jsonb_build_object('result', 'repeat', 'hearts', p.hearts); end if;
  at := (extract(epoch from (now() - x.phase_started_at)) * 1000)::int;
  if a <> w.answer then
    update public.match_players mp set hearts = mp.hearts - 1, tried = jsonb_set(mp.tried, array[w.id], prev || to_jsonb(a))
     where mp.match_id = m and mp.user_id = me returning * into p;
    -- Out with the revive already spent: finished for this puzzle (CW6: at 0 hearts you watch).
    if p.hearts <= 0 and p.revived then update public.race_results rr set done = true where rr.match_id = m and rr.item_index = x.case_index and rr.user_id = me; end if;
    return jsonb_build_object('result', 'wrong', 'hearts', p.hearts, 'revived', p.revived);
  end if;
  insert into public.cw_claims(match_id, word_id, user_id, at_ms, auto) values (m, w.id, me, at, false);
  got := array[w.id]; gained := length(w.answer);
  -- Words whose every square is now showing are claimed too (as coded: autoSolved).
  loop
    select coalesce(array_agg(o.id), '{}'), coalesce(sum(length(o.answer)), 0)::int into more, at
      from public.cw_words o
     where o.n = w.n and not exists (select 1 from public.cw_claims cc where cc.match_id = m and cc.word_id = o.id)
       and not exists (
         select 1 from public.cw_cells(o.r, o.c, o.dir, length(o.answer)) k
          where k not in (select public.cw_cells(s.r, s.c, s.dir, length(s.answer)) from public.cw_words s join public.cw_claims cc on cc.word_id = s.id and cc.match_id = m where s.n = w.n));
    exit when cardinality(more) = 0;
    gained := gained + at;
    insert into public.cw_claims(match_id, word_id, user_id, at_ms, auto)
      select m, unnest(more), me, (extract(epoch from (now() - x.phase_started_at)) * 1000)::int, true;
    got := got || more;
  end loop;
  at := (extract(epoch from (now() - x.phase_started_at)) * 1000)::int;
  update public.match_players mp set score = mp.score + gained, solve_ms = at where mp.match_id = m and mp.user_id = me;
  update public.race_results rr set points = rr.points + gained, solved_ms = at where rr.match_id = m and rr.item_index = x.case_index and rr.user_id = me;
  -- Grid complete: everyone is done with this puzzle, so it ends now.
  if not exists (select 1 from public.cw_words o where o.n = w.n and not exists (select 1 from public.cw_claims cc where cc.match_id = m and cc.word_id = o.id)) then
    update public.race_results rr set done = true where rr.match_id = m and rr.item_index = x.case_index;
  end if;
  return jsonb_build_object('result', 'right', 'claimed', to_jsonb(got), 'gained', gained);
end $function$;

create or replace function public.cw_decline(m uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if not exists (select 1 from public.match_players mp where mp.match_id = m and mp.user_id = auth.uid() and mp.hearts <= 0) then raise exception 'still has hearts'; end if;
  update public.race_results rr set done = true
   where rr.match_id = m and rr.user_id = auth.uid() and rr.item_index = (select x.case_index from public.matches x where x.id = m);
end $function$;

create or replace function public.wallet_exp_cap(game text, mode text, settings jsonb)
 returns integer
 language sql
 immutable
 set search_path to ''
as $function$
  select case
    when mode = 'offline' then 0
    when game = 'case-files-unsolved' then case when mode = 'online' then 60 * public.race_count(settings) else 60 end
    when game = 'the-conqueror' then case when mode = 'online' then 400 else 0 end
    when game = 'nova-crossword' then case when mode = 'online' then 12 * public.race_count(settings) else 31 * 12 end
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
    when game = 'imposter' then 60
    when game = 'code-clinic' then 60
    when game = 'nova-password' then 60
    when game = 'trust-me-not' then 250
    when game = 'the-wheels-of-chaos' then (least(100, greatest(25, coalesce((settings->>'target')::int, 50))) + case when mode = 'online' then 38 else 9 end) / 2
    else 0 end;
$function$;

revoke all on function public.cf_total(uuid, uuid) from public, anon, authenticated;
