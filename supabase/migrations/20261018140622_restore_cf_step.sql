-- Restores Case Files online step exactly as migration case_files_online_step_v2 (2026-10-09); it was dropped outside migrations on 2026-10-14.
create or replace function public.cf_step(m uuid, stage text, filtered text[] default null, provisional text default null, redemption text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare me uuid := auth.uid(); x public.matches; rr public.race_results; c public.cf_cases; ms int; dd int; solved boolean; complete boolean; total int;
begin
  select * into x from public.matches where id = m for update;
  if not found or x.game <> 'case-files-unsolved' then raise exception 'not a case files match'; end if;
  perform public.race_advance(m);
  select * into x from public.matches where id = m;
  if x.phase <> 'case' then return jsonb_build_object('result', 'over'); end if;
  select * into rr from public.race_results r where r.match_id = m and r.item_index = 0 and r.user_id = me;
  if not found then raise exception 'not playing'; end if;
  if rr.done then return jsonb_build_object('result', 'done'); end if;
  select * into c from public.cf_cases cc where cc.n = x.case_numbers[1];
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
    done = complete, solved_ms = case when solved then ms end
   where r.match_id = m and r.item_index = 0 and r.user_id = me;
  -- Tie on points = faster finish; a case still open ranks behind every finished one.
  update public.match_players mp set score = total, solve_ms = case when complete then ms else 86400000 end where mp.match_id = m and mp.user_id = me;
  return jsonb_build_object('result', 'ok', 'complete', complete);
end $$;

revoke all on function public.cf_step(uuid, text, text[], text, text) from public, anon;
grant execute on function public.cf_step(uuid, text, text[], text, text) to authenticated;
