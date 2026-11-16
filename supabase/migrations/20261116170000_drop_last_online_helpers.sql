-- MedNova (2026-11-16): two small Sketch It online helpers left from online play. Nothing uses them (checked: no
-- function, job or app call). Safe to paste twice.
drop function if exists public.sa_mask(text, jsonb, integer);
drop function if exists public.sa_points(integer, integer, integer);
-- Check: 0
select count(*) as left_over from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('sa_mask', 'sa_points');
