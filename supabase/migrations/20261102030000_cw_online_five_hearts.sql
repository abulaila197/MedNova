-- Nova Crossword online: 5 hearts per puzzle again (Yazan 2026-11-02, #13). Solo and Pass the phone keep 3 (app side).
-- Only Crossword uses match_players.hearts. New online players start with 5, and each next puzzle of a 2 or 3
-- puzzle match refills to 5.
alter table public.match_players alter column hearts set default 5;

do $$
declare
  src text := pg_get_functiondef('public.race_advance'::regproc);
  old text := 'update public.match_players mp set hearts = 3, revived = false where mp.match_id = m;';
begin
  if position(old in src) = 0 then raise exception 'race_advance: refill line not found'; end if;
  execute replace(src, old, 'update public.match_players mp set hearts = 5, revived = false where mp.match_id = m;');
end $$;

-- Check: both should say 5 / true.
select (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'match_players' and column_name = 'hearts') as start_hearts,
       (pg_get_functiondef('public.race_advance'::regproc) like '%set hearts = 5, revived = false%') as refill_is_5;
