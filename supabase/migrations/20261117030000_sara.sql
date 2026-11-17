-- MedNova: Razan is renamed Sara everywhere (Yazan 2026-11-17). Paste once, before the update with Sara goes to everyone.
-- Safe to paste twice. Replaces razan-on-build-day.sql (do NOT paste that one any more).
-- 1. Every server function that names the character takes 'sara' in place of 'razan' (avatar_open, set_avatar,
--    admin_unlock_character, sparks_refill_min, friend_profile). The old show_razan switch is left off: apps that
--    haven't taken the update keep her hidden, and the update itself no longer reads the switch.
do $$
declare r record;
begin
  for r in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc like '%''razan''%' and p.proname <> 'set_app_flag'
  loop
    execute replace(pg_get_functiondef(r.oid), '''razan''', '''sara''');
  end loop;
end $$;

-- 2. Anyone who already has her or wears her keeps her under the new name.
update public.style_owned set item = 'team:sara' where item = 'team:razan'
  and not exists (select 1 from public.style_owned o where o.user_id = style_owned.user_id and o.item = 'team:sara');
delete from public.style_owned where item = 'team:razan';
update public.profiles set avatar = 'sara' where avatar = 'razan';

-- Check: functions_with_razan = 1 (only the old switch), functions_with_sara = 5, owned_razan = 0, wearing_razan = 0.
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosrc like '%''razan''%') as functions_with_razan,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosrc like '%''sara''%') as functions_with_sara,
  (select count(*) from public.style_owned where item = 'team:razan') as owned_razan,
  (select count(*) from public.profiles where avatar = 'razan') as wearing_razan;
