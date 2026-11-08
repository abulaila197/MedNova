-- Silent Artist online: the guess is judged on the server. The 'silent-artist' edge function runs the coded
-- matcher on the typed text against the turn's word (sa_target), then records the verdict here (sa_judge).
-- The old sa_guess took the phone's own verdict, so phones can no longer call it.
create or replace function public.sa_target(m uuid, u uuid)
returns text language plpgsql security definer set search_path to '' as $$
declare x public.matches; tr public.sa_turns; rr public.race_results; wid text;
begin
  select * into x from public.matches where id = m;
  if not found or x.game <> 'the-silent-artist' then return null; end if;
  perform public.sa_advance(m);
  select * into x from public.matches where id = m;
  if x.phase <> 'case' then return null; end if;
  select * into tr from public.sa_turns where match_id = m and turn = x.case_index;
  if tr.drawer = u then return null; end if;
  select * into rr from public.race_results r where r.match_id = m and r.item_index = x.case_index and r.user_id = u;
  if not found or rr.done then return null; end if;
  select id into wid from public.sa_words where n = tr.word;
  return wid;
end $$;

create or replace function public.sa_judge(m uuid, u uuid, wid text, verdict text)
returns text language plpgsql security definer set search_path to '' as $$
declare x public.matches; tr public.sa_turns; rr public.race_results; cur text; el int; pts int; rk int;
begin
  select * into x from public.matches where id = m for update;
  if not found or x.game <> 'the-silent-artist' then raise exception 'not a silent artist match'; end if;
  perform public.sa_advance(m);
  select * into x from public.matches where id = m;
  if x.phase <> 'case' then return 'over'; end if;
  select * into tr from public.sa_turns where match_id = m and turn = x.case_index;
  select id into cur from public.sa_words where n = tr.word;
  -- The turn moved on between the check and the verdict.
  if cur is distinct from wid then return 'over'; end if;
  if tr.drawer = u then return 'ignored'; end if;
  select * into rr from public.race_results r where r.match_id = m and r.item_index = x.case_index and r.user_id = u;
  if not found or rr.done then return 'ignored'; end if;
  if verdict = 'correct' then
    el := (extract(epoch from (now() - x.phase_started_at)) * 1000)::int;
    pts := public.sa_points(el, coalesce((x.settings->>'turn')::int, 90) * 1000, (tr.plan->>'fieldAt')::int);
    select count(*) + 1 into rk from public.race_results r where r.match_id = m and r.item_index = x.case_index and r.solved_ms is not null and not r.drawer;
    update public.race_results r set solved_ms = el, points = pts, done = true, rank = rk where r.match_id = m and r.item_index = x.case_index and r.user_id = u;
    update public.match_players mp set score = mp.score + pts, correct = mp.correct + 1 where mp.match_id = m and mp.user_id = u;
    perform public.sa_advance(m);
    return 'correct';
  end if;
  return case when verdict = 'close' then 'close' else 'wrong' end;
end $$;

revoke all on function public.sa_target(uuid, uuid) from public, anon, authenticated;
revoke all on function public.sa_judge(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.sa_target(uuid, uuid) to service_role;
grant execute on function public.sa_judge(uuid, uuid, text, text) to service_role;
revoke all on function public.sa_guess(uuid, text[], text[]) from public, anon, authenticated;
