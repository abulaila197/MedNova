-- Fixes 2026-11-04, groups 4 to 6 (Medicordle, Case Files, Quiz Parade).

-- #25 Medicordle: a guess that reached the server before the word's clock ran out counts, even when it had to wait
-- in line behind another request that already closed the word (now() is when the request arrived).
do $do$
declare f text;
begin
  f := pg_get_functiondef('public.nm_guess(uuid, text)'::regprocedure);
  if position($a$if x.game <> 'nova-medicordle' or x.phase <> 'case' then return jsonb_build_object('outcome', 'ignored_finished'); end if;$a$ in f) = 0 then
    raise exception 'nm_guess text not found';
  end if;
  f := replace(f, $a$if x.game <> 'nova-medicordle' or x.phase <> 'case' then return jsonb_build_object('outcome', 'ignored_finished'); end if;$a$,
    $b$if x.game <> 'nova-medicordle' or not (x.phase = 'case' or (x.phase = 'reveal' and t <= x.phase_started_at)) then return jsonb_build_object('outcome', 'ignored_finished'); end if;$b$);
  execute f;
end $do$;

-- #10 Case Files: a right diagnosis (or a judged last call) no longer finishes you. You read the discharge, then
-- "End the case" (ended = true) marks you finished. Points and the time bonus stay from when you answered.
drop function if exists public.cf_step(uuid, text, text[], text, text, text[]);
create function public.cf_step(m uuid, stage text, filtered text[] default null, provisional text default null, redemption text default null, first text[] default null, ended boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare me uuid := auth.uid(); x public.matches; rr public.race_results; c public.cf_cases; ms int; el int; dd int; solved boolean; complete boolean; total int; fin boolean;
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
  if stage in ('Examination', 'Investigations', 'Treatment') then rr.stage := stage; end if;
  -- #67: the first list arrives with the narrowed one; both are kept once (at most 5 names each).
  if filtered is not null and rr.dd is null then
    rr.dd := (select array_agg(f) from (select distinct f from unnest(filtered) f limit 5) z);
    rr.dd_first := (select array_agg(f) from (select distinct f from unnest(first) f limit 5) z);
  end if;
  if provisional is not null and rr.prov is null and rr.dd is not null then rr.prov := provisional; end if;
  if redemption is not null and rr.redeem is null and rr.prov is not null and rr.prov <> c.final then rr.redeem := redemption; end if;
  solved := coalesce(rr.prov = c.final, false) or coalesce(rr.redeem = c.final, false);
  complete := coalesce(rr.prov = c.final, false) or rr.redeem is not null;
  -- The clock stops at the answer: reading the discharge afterwards costs nothing.
  el := case when complete then coalesce(rr.answered_ms, ms) else ms end;
  dd := case when rr.dd is null then 0 else public.cf_dd_score2(c.answers, rr.dd_first, rr.dd) end;
  total := dd + case when rr.prov = c.final then 20 else 0 end + case when rr.redeem = c.final then 10 else 0 end
    + case when solved then round(10 * greatest(0, 1 - el / 300000.0))::int else 0 end;
  fin := complete and coalesce(ended, false);
  if complete then rr.stage := case when fin then 'Finished' else 'Discharge' end; end if;
  update public.race_results r set stage = rr.stage, dd = rr.dd, dd_first = rr.dd_first, prov = rr.prov, redeem = rr.redeem, points = total,
    done = fin, solved_ms = case when solved then coalesce(rr.solved_ms, el) end, answered_ms = case when complete then el end
   where r.match_id = m and r.item_index = x.case_index and r.user_id = me;
  -- Points add up over the cases; tie on points = faster finish.
  perform public.cf_total(m, me);
  -- Everyone has ended the case: it closes for the room now.
  if fin then perform public.race_advance(m); end if;
  return jsonb_build_object('result', 'ok', 'complete', complete, 'ended', fin);
end $function$;
revoke all on function public.cf_step(uuid, text, text[], text, text, text[], boolean) from public, anon;
grant execute on function public.cf_step(uuid, text, text[], text, text, text[], boolean) to authenticated;

-- #11 Case Files: once the case closes, everyone's answers (first list, narrowed list, diagnosis, last call).
do $do$
declare f text;
begin
  f := pg_get_functiondef('public.race_state(uuid)'::regprocedure);
  if position($a$'hearts', mp.hearts, 'revived', mp.revived,$a$ in f) = 0 then raise exception 'race_state text not found'; end if;
  f := replace(f, $a$'hearts', mp.hearts, 'revived', mp.revived,$a$,
    $b$'hearts', mp.hearts, 'revived', mp.revived,
        'cf', case when x.game = 'case-files-unsolved' and showing then jsonb_build_object('first', to_jsonb(rr.dd_first), 'dd', to_jsonb(rr.dd), 'prov', rr.prov, 'redeem', rr.redeem) end,$b$);
  execute f;
end $do$;

-- #15 Quiz Parade online: a question type doesn't come back until every other type has come up. Questions are
-- taken in rounds of one per type (random within a type, random order within a round).
do $do$
declare f text; a text; b text;
begin
  f := pg_get_functiondef('public.start_match(uuid)'::regprocedure);
  a := $a$      picks := array(select z.qn from (
        (select q.n as qn from public.pq_keys q where q.kind = 'basic' order by random() limit k / 2)
        union all
        (select q.n from public.pq_keys q where q.kind = 'clinical' order by random() limit k - k / 2)) z order by random());$a$;
  b := $a$      picks := array(select q.n from public.pq_keys q where q.kind = st order by random() limit k);$a$;
  if position(a in f) = 0 or position(b in f) = 0 then raise exception 'start_match text not found'; end if;
  f := replace(f, a, $c$      picks := array(select z.n from (select q.n, row_number() over (partition by q.style order by random()) rn, random() r2
        from public.pq_keys q) z order by z.rn, z.r2 limit k);$c$);
  f := replace(f, b, $c$      picks := array(select z.n from (select q.n, row_number() over (partition by q.style order by random()) rn, random() r2
        from public.pq_keys q where q.kind = st) z order by z.rn, z.r2 limit k);$c$);
  execute f;
end $do$;
