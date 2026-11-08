-- Code Clinic Online: rooms can be made for it, a match needs 4 players (CC1: 4 to 6, two teams of 2 or 3), the
-- referee runs it from cc_games, and online EXP is capped at 60 (CC2: winners 60, losers 20 a game).

create or replace function public.create_room(game text, settings jsonb, is_public boolean, wanted text default null::text)
 returns uuid language plpgsql security definer set search_path to '' as $function$
declare me uuid := auth.uid(); r uuid; c text; other uuid; tries int := 0;
begin
  if me is null then raise exception 'not signed in'; end if;
  if game not in ('the-diagnostic-pursuit', 'the-riddler', 'nova-medicordle', 'the-streak-master', 'nova-crossword',
                  'case-files-unsolved', 'the-silent-artist', 'the-wheels-of-chaos', 'the-conqueror', 'trust-me-not', 'the-quiz-parade', 'imposter', 'code-clinic') then
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
  if rm.game in ('trust-me-not', 'imposter') and n < 3 then raise exception 'need 3 players'; end if;
  if rm.game = 'code-clinic' and n < 4 then raise exception 'need 4 players'; end if;
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
  elsif rm.game in ('the-wheels-of-chaos', 'the-conqueror', 'trust-me-not', 'imposter', 'code-clinic') then
    -- WC20-WC23, CQ1, IM2, CC1: these referees run the whole match from their own table; there is no list of cases.
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
    when game = 'imposter' then 60
    when game = 'code-clinic' then 60
    when game = 'trust-me-not' then 250
    when game = 'the-wheels-of-chaos' then (least(100, greatest(50, coalesce((settings->>'target')::int, 50))) + case when mode = 'online' then 38 else 9 end) / 2
    else 0 end;
$function$;
