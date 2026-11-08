-- My diseases in online rooms (Yazan 2026-10-26, step 3). An approved case or word joins its game's own bank table
-- with its maker as owner, so the games' referees (dp_guess, nm_guess, sm_score_question, sa_*) use it unchanged.
-- Owned rows never come up in the normal draw; when their maker hosts a room with "Use my words" on (settings.own,
-- on unless 'off'), they fill up to half the match.
-- match_own gives the players of a match the owned items it uses, since their phones don't have them.

create sequence if not exists public.own_n start 100001;

alter table public.dp_cases add column if not exists owner uuid references auth.users on delete cascade, add column if not exists item uuid;
alter table public.nm_words add column if not exists owner uuid references auth.users on delete cascade, add column if not exists item uuid;
alter table public.sa_words add column if not exists owner uuid references auth.users on delete cascade, add column if not exists item uuid;
alter table public.sm_questions add column if not exists owner uuid references auth.users on delete cascade, add column if not exists item uuid,
  add column if not exists stem text, add column if not exists choices text[];
create unique index if not exists dp_cases_item on public.dp_cases(item);
create unique index if not exists nm_words_item on public.nm_words(item);
create unique index if not exists sa_words_item on public.sa_words(item);
create unique index if not exists sm_questions_item on public.sm_questions(item);
create index if not exists dp_cases_owner on public.dp_cases(owner) where owner is not null;
create index if not exists nm_words_owner on public.nm_words(owner) where owner is not null;
create index if not exists sa_words_owner on public.sa_words(owner) where owner is not null;
create index if not exists sm_questions_owner on public.sm_questions(owner) where owner is not null;

-- A case joins the Diagnostic Pursuit bank while it is approved (clues as the app builds them, toDPCase).
create or replace function public.own_sync_case() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.custom_cases; g text;
begin
  if tg_op = 'DELETE' then
    delete from public.dp_cases where item = old.id;
    return null;
  end if;
  c := new;
  if c.status <> 'approved' or c.answer_id is null then
    delete from public.dp_cases where item = c.id;
    return null;
  end if;
  g := case c.gender when 'Female' then 'woman' when 'Male' then 'man' else 'patient' end;
  insert into public.dp_cases(number, difficulty, fields, disease, canonical_id, answer_id, clues, owner, item)
  values (nextval('public.own_n'), 'Medium', case when c.field is null then '{}'::text[] else array[c.field] end, c.diagnosis, c.answer_id, c.answer_id,
    array(select trim(u.x) from unnest(array[case when left(c.presentation, 40) ~ '\d' then c.presentation else 'A ' || c.age || '-year-old ' || g || ': ' || c.presentation end,
                                             c.history, c.exam, c.investigation] || coalesce(c.findings, '{}')) with ordinality u(x, i)
           where trim(coalesce(u.x, '')) <> '' order by u.i),
    c.user_id, c.id)
  on conflict (item) do update set fields = excluded.fields, disease = excluded.disease, canonical_id = excluded.canonical_id,
    answer_id = excluded.answer_id, clues = excluded.clues;
  return null;
end $$;

-- A word joins its game's bank while it is approved (The Imposter and Nova Password referees read player_words).
create or replace function public.own_sync_word() returns trigger
language plpgsql security definer set search_path = '' as $$
declare w public.player_words; d jsonb; cid text;
begin
  if tg_op = 'DELETE' then w := old; else w := new; end if;
  if tg_op = 'DELETE' or w.status <> 'approved' then
    delete from public.sa_words where item = w.id;
    delete from public.nm_words where item = w.id;
    delete from public.sm_questions where item = w.id;
    return null;
  end if;
  d := w.data;
  cid := 'c:' || w.id;
  if w.game = 'the-silent-artist' then
    insert into public.sa_words(n, id, name, field, aliases, owner, item)
    values (nextval('public.own_n'), cid, d->>'name', d->>'field', array(select jsonb_array_elements_text(coalesce(d->'aliases', '[]'))), w.user_id, w.id)
    on conflict (item) do update set name = excluded.name, field = excluded.field, aliases = excluded.aliases;
  elsif w.game = 'nova-medicordle' then
    insert into public.nm_words(n, id, style, word, definition, owner, item)
    values (nextval('public.own_n'), cid, case when length(d->>'word') = 6 then 'classic' else 'custom' end, d->>'word', d->>'definition', w.user_id, w.id)
    on conflict (item) do update set style = excluded.style, word = excluded.word, definition = excluded.definition;
  elsif w.game = 'the-streak-master' then
    insert into public.sm_questions(n, id, kind, answer, stem, choices, owner, item)
    values (nextval('public.own_n'), cid, 'clinical', (d->>'answer')::int, d->>'stem', array(select jsonb_array_elements_text(d->'choices')), w.user_id, w.id)
    on conflict (item) do update set answer = excluded.answer, stem = excluded.stem, choices = excluded.choices;
  end if;
  return null;
end $$;
revoke all on function public.own_sync_case() from public, anon, authenticated;
revoke all on function public.own_sync_word() from public, anon, authenticated;

drop trigger if exists own_sync on public.custom_cases;
create trigger own_sync after insert or update or delete on public.custom_cases for each row execute function public.own_sync_case();
drop trigger if exists own_sync on public.player_words;
create trigger own_sync after insert or update or delete on public.player_words for each row execute function public.own_sync_word();

-- Items already approved before this change.
update public.custom_cases set status = status where status = 'approved';
update public.player_words set status = status where status = 'approved';

-- Up to half of k from `own`, the rest from `bank`, shuffled.
create or replace function public.own_mix(bank int[], own int[], k int) returns int[]
language plpgsql set search_path = '' as $$
declare o int[] := coalesce(own[1:k / 2], '{}');
begin
  return array(select z from unnest(o || coalesce(bank[1:k - cardinality(o)], '{}')) z order by random());
end $$;

create or replace function public.start_match(r uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare me uuid := auth.uid(); rm public.rooms; m uuid; n int; d text; k int; picks int[]; st text; mine uuid;
begin
  select * into rm from public.rooms where id = r for update;
  if not found or rm.host <> me or rm.status <> 'lobby' then raise exception 'cannot start'; end if;
  -- My diseases: the host's own approved items join only with "Use my words" on.
  mine := case when coalesce(rm.settings->>'own', 'on') <> 'off' then me end;
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
    picks := public.own_mix(array(select number from public.dp_cases where difficulty = d and owner is null order by random() limit k),
                            array(select number from public.dp_cases where owner = mine order by random()), k);
  elsif rm.game = 'the-riddler' then
    k := least(greatest(coalesce((rm.settings->>'photos')::int, 5), 1), 10);
    picks := array(select g from generate_series(1, 86) g order by random() limit k);
  elsif rm.game = 'nova-medicordle' then
    k := least(greatest(coalesce((rm.settings->>'words')::int, 5), 1), 10);
    st := coalesce(rm.settings->>'style', 'classic');
    picks := public.own_mix(array(select w.n from public.nm_words w where w.style = st and w.owner is null order by random() limit k),
                            array(select w.n from public.nm_words w where w.style = st and w.owner = mine order by random()), k);
  elsif rm.game = 'the-streak-master' then
    k := least(greatest(coalesce((rm.settings->>'questions')::int, 15), 1), 20);
    st := coalesce(rm.settings->>'style', 'mixed');
    if st = 'mixed' then
      picks := array(select z.qn from (
        (select q.n as qn from public.sm_questions q where q.kind = 'basic' and q.owner is null order by random() limit k / 2)
        union all
        (select q.n from public.sm_questions q where q.kind = 'clinical' and q.owner is null order by random() limit k - k / 2)) z order by random());
    else
      picks := array(select q.n from public.sm_questions q where q.kind = st and q.owner is null order by random() limit k);
    end if;
    picks := public.own_mix(picks, array(select q.n from public.sm_questions q where q.owner = mine order by random()), k);
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

create or replace function public.sa_advance(m uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare x public.matches; t timestamptz := now(); total int; early boolean; tr public.sa_turns; turn_ms int; st timestamptz; nxt int;
  np int; g int; got int; sumpts int; dpts int; w int; hst uuid;
begin
  select * into x from public.matches where id = m for update;
  if not found then return; end if;
  total := array_length(x.case_numbers, 1);
  turn_ms := coalesce((x.settings->>'turn')::int, 90) * 1000;
  loop
    exit when x.phase = 'done';
    early := false;
    if x.phase in ('pick', 'case') then
      update public.match_players mp set dropped = true
       from public.matches mm join public.room_players rp on rp.room_id = mm.room_id
       where mm.id = m and mp.match_id = m and rp.user_id = mp.user_id and not mp.dropped
         and (rp.state not in ('in') or rp.last_ping < t - interval '60 seconds');
      select * into tr from public.sa_turns where match_id = m and turn = x.case_index;
      if exists (select 1 from public.match_players where match_id = m and user_id = tr.drawer and dropped) then early := true;
      elsif x.phase = 'pick' then early := tr.word is not null;
      else
        early := not exists (
          select 1 from public.match_players mp
          left join public.race_results rr on rr.match_id = m and rr.item_index = x.case_index and rr.user_id = mp.user_id
          where mp.match_id = m and not mp.dropped and mp.user_id <> tr.drawer and not coalesce(rr.done, false));
      end if;
    end if;
    exit when t < x.phase_ends_at and not early;
    st := case when early then least(t, x.phase_ends_at) else x.phase_ends_at end;

    if x.phase in ('countdown', 'reveal') then
      if not exists (select 1 from public.sa_turns where match_id = m) then
        select count(*) into np from public.match_players where match_id = m;
        -- SA12: everyone draws 1, 2 or 3 times, in one random order repeated each lap.
        insert into public.sa_turns(match_id, turn, drawer)
          select m, lap * np + (o.rn - 1), o.user_id
            from (select user_id, row_number() over (order by random()) rn from public.match_players where match_id = m) o
            cross join generate_series(0, greatest(total / greatest(np, 1), 1) - 1) lap;
      end if;
      nxt := case when x.phase = 'countdown' then 0 else x.case_index + 1 end;
      while nxt < total and exists (select 1 from public.sa_turns s join public.match_players mp on mp.match_id = m and mp.user_id = s.drawer
                                     where s.match_id = m and s.turn = nxt and mp.dropped) loop
        nxt := nxt + 1;
      end loop;
      if nxt >= total or (select count(*) from public.match_players where match_id = m and not dropped) < 2 then
        x.phase := 'done'; x.ended_at := t;
        -- Rule 13: equal scores go to the faster total time of correct guesses.
        update public.match_players mp set rank = q.rk from (
          select p.user_id, rank() over (order by p.dropped, p.score desc, coalesce(tm.ms, 0)) rk
            from public.match_players p
            left join (select rr.user_id, sum(rr.solved_ms) ms from public.race_results rr
                        where rr.match_id = m and not coalesce(rr.drawer, false) and rr.solved_ms is not null
                        group by rr.user_id) tm on tm.user_id = p.user_id
           where p.match_id = m) q
         where mp.match_id = m and mp.user_id = q.user_id;
        update public.rooms set status = 'finished', updated_at = t where id = x.room_id and match_id = m;
      else
        x.case_index := nxt; x.phase := 'pick';
        x.phase_started_at := st; x.phase_ends_at := st + interval '10 seconds';
        -- My diseases: while fewer than half the turns had one, one of the 3 words is an approved word of the host's.
        select case when coalesce(x.settings->>'own', 'on') <> 'off' then host end into hst from public.rooms where id = x.room_id;
        update public.sa_turns s set options = coalesce((select array_agg(z.n order by random()) from (
            select u.n from (
              (select w2.n, 0 o from public.sa_words w2
                where hst is not null and w2.owner = hst
                  and not exists (select 1 from public.sa_turns o where o.match_id = m and w2.n = any(o.options))
                  and (select count(*) from public.sa_turns o where o.match_id = m
                         and exists (select 1 from public.sa_words ow where ow.n = any(o.options) and ow.owner is not null)) < total / 2
                order by random() limit 1)
              union all
              (select w2.n, 1 from public.sa_words w2
                where w2.owner is null
                  and not exists (select 1 from public.sa_turns o where o.match_id = m and w2.n = any(o.options))
                  and (coalesce(x.settings->>'mix', 'mixed') = 'mixed' or (x.settings->>'mix' = 'basic') = (w2.id like 'b%'))
                order by random() limit 3)) u
            order by u.o limit 3) z), '{}')
         where s.match_id = m and s.turn = nxt;
        insert into public.race_results(match_id, item_index, user_id, drawer)
          select m, nxt, mp.user_id, mp.user_id = (select drawer from public.sa_turns where match_id = m and turn = nxt)
            from public.match_players mp where mp.match_id = m and not mp.dropped
          on conflict do nothing;
      end if;
    elsif x.phase = 'pick' then
      w := coalesce(tr.word, tr.options[1 + floor(random() * cardinality(tr.options))::int]);
      update public.sa_turns s set word = w, plan = public.sa_plan(w, turn_ms) where s.match_id = m and s.turn = x.case_index;
      x.case_numbers[x.case_index + 1] := w;
      if exists (select 1 from public.match_players where match_id = m and user_id = tr.drawer and dropped) then
        x.phase := 'reveal'; x.phase_started_at := st; x.phase_ends_at := st + interval '5 seconds';
      else
        x.phase := 'case'; x.phase_started_at := st; x.phase_ends_at := st + make_interval(secs => turn_ms / 1000.0);
      end if;
    else
      -- SA7 drawer: the average of every guesser's points (a miss counts 0), +20 if everyone got it; 0 with 2+ reports.
      select count(*), count(rr.solved_ms), coalesce(sum(rr.points) filter (where rr.solved_ms is not null), 0) into g, got, sumpts
        from public.match_players mp
        left join public.race_results rr on rr.match_id = m and rr.item_index = x.case_index and rr.user_id = mp.user_id
       where mp.match_id = m and not mp.dropped and mp.user_id <> tr.drawer;
      dpts := case when g = 0 or cardinality(tr.reports) >= 2 then 0 else round(sumpts::numeric / g + case when got = g then 20 else 0 end)::int end;
      update public.race_results rr set points = dpts, done = true where rr.match_id = m and rr.item_index = x.case_index and rr.user_id = tr.drawer;
      update public.match_players mp set score = mp.score + dpts where mp.match_id = m and mp.user_id = tr.drawer;
      x.phase := 'reveal'; x.phase_started_at := st; x.phase_ends_at := st + interval '5 seconds';
    end if;
    update public.matches set phase = x.phase, case_index = x.case_index, case_numbers = x.case_numbers,
      phase_started_at = x.phase_started_at, phase_ends_at = x.phase_ends_at, ended_at = x.ended_at where id = m;
  end loop;
end $function$;

-- The owned items a match uses, for its players' phones (which only carry the normal banks). A Silent Artist word
-- shows to its drawer's options, and to everyone once its turn is over.
create or replace function public.match_own(m uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); x public.matches;
begin
  if not public.is_match_member(m) then raise exception 'not in this match'; end if;
  select * into x from public.matches where id = m;
  return jsonb_build_object(
    'dp', coalesce((select jsonb_agg(jsonb_build_object('n', c.number, 'disease', c.disease, 'answer_id', c.answer_id, 'fields', c.fields, 'clues', c.clues))
                      from public.dp_cases c where c.owner is not null and x.game = 'the-diagnostic-pursuit' and c.number = any(x.case_numbers)), '[]'),
    'nm', coalesce((select jsonb_agg(jsonb_build_object('n', w.n, 'style', w.style, 'word', w.word, 'definition', w.definition))
                      from public.nm_words w where w.owner is not null and x.game = 'nova-medicordle' and w.n = any(x.case_numbers)), '[]'),
    'sm', coalesce((select jsonb_agg(jsonb_build_object('n', q.n, 'stem', q.stem, 'choices', q.choices, 'answer', q.answer))
                      from public.sm_questions q where q.owner is not null and x.game = 'the-streak-master' and q.n = any(x.case_numbers)), '[]'),
    'sa', coalesce((select jsonb_agg(jsonb_build_object('n', w.n, 'id', w.id, 'name', w.name, 'field', w.field, 'aliases', w.aliases))
                      from public.sa_words w where w.owner is not null and x.game = 'the-silent-artist'
                       and (w.n in (select unnest(s.options) from public.sa_turns s where s.match_id = m and s.drawer = me)
                            or w.n in (select s.word from public.sa_turns s where s.match_id = m
                                        and (s.turn < x.case_index or (s.turn = x.case_index and x.phase in ('reveal', 'done')))))), '[]'));
end $$;
revoke all on function public.match_own(uuid) from public, anon;
grant execute on function public.match_own(uuid) to authenticated;
