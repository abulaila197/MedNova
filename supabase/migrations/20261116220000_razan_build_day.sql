-- MedNova: paste ONLY on the day build 11 is live in the stores (Yazan 2026-11-16: Razan for build 11, not build 10).
-- 2. Razan shows everywhere for good (Yazan 2026-11-16). Build 11 no longer reads this switch; turning it on here
--    shows her on build 10 phones too. The app_flags table is dropped later, once nobody runs build 10.
update public.app_flags set value = 'true'::jsonb where key = 'show_razan';
