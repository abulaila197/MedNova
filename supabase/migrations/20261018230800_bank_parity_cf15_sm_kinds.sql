-- S2 / GB3: Case Files case 15 (MP-2314) differential slot. The app bundle has dd2 = [["Renal colic"]]
-- (content fix 9728023, 2026-10-10) but cf_cases was never updated, so online scoring gave -2 instead of +10.
update public.cf_cases set dd2 = '[["Renal colic"]]'::jsonb where n = 15 and id = 'MP-2314';

-- GA6: Streak Master questions 401-403 are clinical in the bundle (c-001..c-003) but tagged basic on the
-- server, so an online "Basic science" room could draw them. Answers already match.
update public.sm_questions set kind = 'clinical' where n in (401, 402, 403) and kind = 'basic';
