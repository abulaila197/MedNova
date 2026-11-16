-- MedNova (2026-11-16): put back what this morning's online cleanup broke. Paste all of it once in
-- Supabase > SQL Editor > Run. Safe to paste twice.
-- The cleanup removed race_count and the old invites table, but three live functions still used them:
-- game results upload (wallet_sync, through wallet_exp_cap), achievement collect + achievement counts, Admin player page.

-- 1. The tiny helper the EXP cap still uses (Case Files / Crossword: 1 to 3 cases). Same as before.
create or replace function public.race_count(settings jsonb) returns int
language sql immutable set search_path = '' as $$
  select least(greatest(coalesce((settings->>'count')::int, 1), 1), 3);
$$;

-- 2. Achievements: count challenges from friend_challenges only (old room invites are gone).
do $$
declare d text;
begin
  d := pg_get_functiondef('public.achievement_collect(text,integer,text[])'::regprocedure);
  d := replace(d, '(select count(*) from public.invites where from_user = uid) + ', '');
  execute d;
  d := pg_get_functiondef('public.social_counts()'::regprocedure);
  d := replace(d, '(select count(*) from public.invites where from_user = auth.uid()) + ', '');
  execute d;
  -- 3. Admin > player page: online matches are gone, so that count is 0.
  d := pg_get_functiondef('public.admin_player(uuid)'::regprocedure);
  d := replace(d, '(select count(*) from public.match_players m where m.user_id = target)', '0');
  execute d;
end $$;

-- Check: every number should be 0 (no live function still points at a removed table or function).
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosrc ~ 'public\.(invites|match_players)\y') as broken_functions_left,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'race_count') - 1 as race_count_missing;
