-- GB8 (Yazan 2026-10-18): Silent Artist online final places break equal scores by the faster total time (rule 13),
-- as Offline does: the sum of each player's own correct-guess times (race_results.solved_ms on rows where they
-- guessed, not drew). Only the final rank statement changes; the rest is the live sa_advance as of 2026-10-18.
create or replace function public.sa_advance(m uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare x public.matches; t timestamptz := now(); total int; early boolean; tr public.sa_turns; turn_ms int; st timestamptz; nxt int;
  np int; g int; got int; sumpts int; dpts int; w int;
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
        update public.sa_turns s set options = coalesce((select array_agg(z.n) from (
            select w2.n from public.sa_words w2
             where not exists (select 1 from public.sa_turns o where o.match_id = m and w2.n = any(o.options))
               and (coalesce(x.settings->>'mix', 'mixed') = 'mixed' or (x.settings->>'mix' = 'basic') = (w2.id like 'b%'))
             order by random() limit 3) z), '{}')
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
