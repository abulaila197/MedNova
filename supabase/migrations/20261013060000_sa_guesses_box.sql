-- Silent Artist online guesses box (P20): every wrong guess of the turn is kept on the turn, and sa_state shows
-- everyone the latest 4 while the artist draws. Near misses ('close') and correct guesses are never shown, and a
-- guess that fails the name filter is judged as usual but not shown.
alter table public.sa_turns add column if not exists guesses jsonb not null default '[]'::jsonb;

create or replace function public.sa_judge_g(m uuid, u uuid, wid text, verdict text, g text)
returns text language plpgsql security definer set search_path to '' as $$
declare r text; t text := left(regexp_replace(trim(coalesce(g, '')), '\s+', ' ', 'g'), 40);
begin
  r := public.sa_judge(m, u, wid, verdict);
  if r = 'wrong' and length(t) > 0 and public.name_is_clean(t) then
    update public.sa_turns s
       set guesses = case when jsonb_array_length(s.guesses) >= 20 then s.guesses - 0 else s.guesses end
                     || jsonb_build_array(jsonb_build_object('u', u, 'g', t))
     where s.match_id = m and s.turn = (select case_index from public.matches where id = m);
  end if;
  return r;
end $$;
revoke execute on function public.sa_judge_g(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.sa_judge_g(uuid, uuid, text, text, text) to service_role;

do $mig$
declare src text := pg_get_functiondef('public.sa_state(uuid)'::regprocedure);
  old text := '''reported'', me = any(tr.reports))';
  new text := '''reported'', me = any(tr.reports),
      ''guesses'', case when x.phase = ''case'' then (select coalesce(jsonb_agg(z.e || jsonb_build_object(''i'', z.i) order by z.i), ''[]''::jsonb)
        from (select e, i from jsonb_array_elements(tr.guesses) with ordinality q(e, i) order by i desc limit 4) z) end)';
begin
  if position('''guesses'', case' in src) > 0 then return; end if;
  if position(old in src) = 0 then raise exception 'sa_state: reported line not found'; end if;
  execute replace(src, old, new);
end $mig$;
