-- The Quiz Parade Online (QP1-QP12, Yazan 2026-10-25). Same race layer as The Streak Master: everyone gets the same
-- question at once; each type has its own clock (QP2) and the next question starts once everyone has answered (QP2b).
-- Points by type (QP3) with part points for Match and Order; Closest number goes to the nearest guess (QP6);
-- +1 for the first fully right answer on each question (QP12). The answer keys stay on the server (pq_keys).

create table if not exists public.pq_keys (
  n int primary key,            -- 1-based place in the app's bank.json
  id text not null unique,
  style text not null check (style in ('mcq', 'tf', 'r2o', 'match', 'reverse', 'order', 'closest')),
  kind text not null check (kind in ('clinical', 'basic')),
  key jsonb not null            -- mcq/reverse/tf/closest {"a": ...}, r2o {"out": [i, j]}, match/order {"n": items}
);
alter table public.pq_keys enable row level security;
revoke all on public.pq_keys from anon, authenticated;

-- QP2: seconds per question, by type.
create or replace function public.pq_time(item int) returns numeric
language sql stable security definer set search_path to '' as $$
  select case k.style when 'tf' then 15 when 'r2o' then 30 when 'match' then 40 when 'order' then 40 else 25 end::numeric
  from public.pq_keys k where k.n = item;
$$;

-- QP3: one answer's points (Closest number is scored by pq_score_question).
create or replace function public.pq_grade(item int, r jsonb) returns int
language plpgsql stable security definer set search_path to '' as $$
declare k public.pq_keys; good int := 0; n int; i int;
begin
  select * into k from public.pq_keys where pq_keys.n = item;
  if not found or r is null or r->>'style' is distinct from k.style then return 0; end if;
  if k.style in ('mcq', 'reverse') then
    return case when (r->>'pick')::int = (k.key->>'a')::int then 2 else 0 end;
  elsif k.style = 'tf' then
    return case when (r->>'value')::boolean = (k.key->>'a')::boolean then 1 else 0 end;
  elsif k.style = 'r2o' then
    return case when jsonb_array_length(r->'picks') = 2
      and (k.key->'out') @> (r->'picks') and (r->'picks') @> (k.key->'out') then 3 else 0 end;
  elsif k.style in ('match', 'order') then
    n := (k.key->>'n')::int;
    for i in 0 .. n - 1 loop
      if ((r->case when k.style = 'match' then 'map' else 'seq' end)->>i)::int = i then good := good + 1; end if;
    end loop;
    return round(4.0 * good / greatest(n, 1))::int;
  end if;
  return 0;
end $$;

-- Lock in one answer for the current question.
create or replace function public.pq_answer(m uuid, response jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare me uuid := auth.uid(); x public.matches; rr public.race_results; t timestamptz := now(); st text;
begin
  if not public.is_match_member(m) then raise exception 'not in this match'; end if;
  perform public.race_advance(m);
  select * into x from public.matches where id = m for update;
  if x.game <> 'the-quiz-parade' or x.phase <> 'case' then return jsonb_build_object('outcome', 'ignored_finished'); end if;
  select k.style into st from public.pq_keys k where k.n = x.case_numbers[x.case_index + 1];
  if response->>'style' is distinct from st or octet_length(response::text) > 400 then return jsonb_build_object('outcome', 'rejected'); end if;
  select * into rr from public.race_results where match_id = m and item_index = x.case_index and user_id = me for update;
  if not found or rr.done then return jsonb_build_object('outcome', 'ignored_finished'); end if;
  update public.race_results set
    guesses = array[response::text], done = true,
    pick = case when st in ('mcq', 'reverse') then (response->>'pick')::int when st = 'tf' then case when (response->>'value')::boolean then 1 else 0 end end,
    answered_ms = (extract(epoch from (t - x.phase_started_at)) * 1000)::int
   where match_id = m and item_index = x.case_index and user_id = me;
  perform public.race_advance(m);
  return jsonb_build_object('outcome', 'locked');
end $$;

-- Scores one question when it ends: points by type, nearest guess for Closest number, +1 to the first fully right.
create or replace function public.pq_score_question(m uuid, idx int) returns void
language plpgsql security definer set search_path to '' as $$
declare x public.matches; item int; k public.pq_keys; best numeric; rec record; pts int; full_marks int; rk int := 0; first_done boolean := false;
begin
  select * into x from public.matches where id = m;
  item := x.case_numbers[idx + 1];
  select * into k from public.pq_keys where n = item;
  full_marks := case k.style when 'tf' then 1 when 'r2o' then 3 when 'match' then 4 when 'order' then 4 else 2 end;
  if k.style = 'closest' then
    select min(abs((rr.guesses[1]::jsonb->>'value')::numeric - (k.key->>'a')::numeric)) into best
      from public.race_results rr where rr.match_id = m and rr.item_index = idx and rr.done and rr.guesses[1] is not null;
  end if;
  for rec in
    select rr.user_id, rr.answered_ms, rr.guesses[1]::jsonb as r from public.race_results rr
     where rr.match_id = m and rr.item_index = idx and rr.done order by rr.answered_ms nulls last
  loop
    if k.style = 'closest' then
      pts := case when best is not null and abs((rec.r->>'value')::numeric - (k.key->>'a')::numeric) = best then 2 else 0 end;
    else
      pts := public.pq_grade(item, rec.r);
    end if;
    if pts = full_marks then
      rk := rk + 1;
      update public.race_results set solved_ms = rec.answered_ms, rank = rk, rank_points = pts, bonus = case when not first_done then 1 else 0 end,
        points = pts + case when not first_done then 1 else 0 end
       where match_id = m and item_index = idx and user_id = rec.user_id;
      update public.match_players set score = score + pts + case when not first_done then 1 else 0 end,
        solve_ms = solve_ms + rec.answered_ms, correct = correct + 1
       where match_id = m and user_id = rec.user_id;
      first_done := true;
    elsif pts > 0 then
      update public.race_results set rank_points = pts, bonus = 0, points = pts where match_id = m and item_index = idx and user_id = rec.user_id;
      update public.match_players set score = score + pts where match_id = m and user_id = rec.user_id;
    end if;
  end loop;
end $$;

revoke all on function public.pq_time(int), public.pq_grade(int, jsonb), public.pq_score_question(uuid, int) from public, anon, authenticated;
grant execute on function public.pq_answer(uuid, jsonb) to authenticated;
