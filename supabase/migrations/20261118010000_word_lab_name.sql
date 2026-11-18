-- Six Word Tries -> Word Lab (Yazan 2026-11-18). Run when the update goes to PRODUCTION, not before:
-- older apps don't know the new English name in their Arabic inbox rewrite.
create or replace function public.challenge_game_name(slug text) returns text language sql immutable set search_path to '' as $$
  select case slug
    when 'the-diagnostic-pursuit' then 'Race to Diagnosis'
    when 'the-silent-artist' then 'Sketch It'
    when 'nova-crossword' then 'Nova Crossword'
    when 'the-quiz-parade' then 'Quick Fire Quiz'
    when 'the-riddler' then 'Medical Riddles'
    when 'nova-medicordle' then 'Word Lab'
    when 'the-streak-master' then 'The Streak Master'
    when 'case-files-unsolved' then 'Case Files'
    when 'the-wheels-of-chaos' then 'The Wheels of Chaos'
    when 'imposter' then 'The Imposter'
    when 'tilt-and-tell' then 'Tilt & Tell'
    when 'who-am-i' then 'Who am I?'
    when 'put-in-order' then 'Put it in order'
    else initcap(replace(coalesce(slug, 'a game'), '-', ' ')) end;
$$;
create or replace function public.challenge_game_name_ar(slug text) returns text language sql immutable set search_path to '' as $$
  select case slug
    when 'the-diagnostic-pursuit' then 'سباق التشخيص'
    when 'the-silent-artist' then 'ارسم وخمّن'
    when 'nova-crossword' then 'كلمات متقاطعة'
    when 'the-quiz-parade' then 'أسئلة سريعة'
    when 'the-riddler' then 'فوازير طبية'
    when 'nova-medicordle' then 'معمل الكلمات'
    when 'the-streak-master' then 'سلسلة الإجابات'
    when 'case-files-unsolved' then 'ملفات غامضة'
    when 'the-wheels-of-chaos' then 'عجلة الفوضى'
    when 'imposter' then 'الدخيل'
    when 'tilt-and-tell' then 'على راسك'
    when 'four-of-a-kind' then 'رباعيات'
    when 'spot-the-flaw' then 'اكتشف الغلطة'
    when 'trace-the-treatment' then 'تتبّع العلاج'
    when 'who-am-i' then 'مين أنا؟'
    when 'put-in-order' then 'رتّبها صح'
    else public.challenge_game_name(slug) end;
$$;
-- Old rows still say "Six Word Tries" in English.
create or replace function public.game_en_to_ar(en text) returns text language sql immutable set search_path to '' as $$
  select case when en = 'Six Word Tries' then 'معمل الكلمات' else coalesce((select public.challenge_game_name_ar(s) from unnest(array['the-diagnostic-pursuit', 'the-silent-artist',
    'nova-crossword', 'the-quiz-parade', 'the-riddler', 'nova-medicordle', 'the-streak-master', 'case-files-unsolved',
    'the-wheels-of-chaos', 'imposter', 'tilt-and-tell', 'four-of-a-kind', 'spot-the-flaw', 'trace-the-treatment', 'who-am-i', 'put-in-order']) s
    where public.challenge_game_name(s) = en limit 1), en) end;
$$;
