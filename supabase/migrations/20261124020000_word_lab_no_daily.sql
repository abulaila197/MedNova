-- Yazan 2026-11-24: Word Lab has no Daily word any more; Solo is endless words only. The new app sends no
-- settings.word, so Solo's EXP cap no longer depends on it (12 EXP a word, up to 150 words). Older apps still on a
-- Daily word stay capped by their own 24 and by wallet_medicordle_daily_guard until the release cleans it up.
-- Run BEFORE the test update reaches phones. Rerun-safe: only replaces a function.

create or replace function public.wallet_exp_cap(game text, mode text, settings jsonb)
 returns integer language sql immutable set search_path to '' as $function$
  select case
    when mode = 'offline' then 0
    when game = 'case-files-unsolved' then case when mode = 'bots' then 100 * public.race_count(settings) when mode = 'online' then 60 * public.race_count(settings) else 60 end
    when game = 'the-conqueror' then case when mode = 'online' then 400 else 0 end
    when game = 'nova-crossword' then case when mode in ('online', 'bots') then 12 * public.race_count(settings) else 31 * 12 end
    when game = 'the-diagnostic-pursuit' then 12 * least(10, greatest(1, coalesce((settings->>'cases')::int, 5)))
    when game = 'nova-medicordle' then case
      when mode in ('online', 'bots') then 12 * least(10, greatest(1, coalesce((settings->>'words')::int, 5)))
      else 1800 end
    when game = 'the-riddler' then case when mode in ('online', 'bots') then 12 * least(10, greatest(1, coalesce((settings->>'photos')::int, 5))) else 86 * 12 end
    when game = 'the-silent-artist' then case when mode = 'online' then 60 else 0 end
    when game = 'the-streak-master' then 60
    when game = 'the-quiz-parade' then 60
    when game = 'imposter' then 60
    when game = 'code-clinic' then 60
    when game = 'nova-password' then 60
    when game = 'trust-me-not' then 250
    when game = 'the-wheels-of-chaos' then (least(100, greatest(25, coalesce((settings->>'target')::int, 50))) + case when mode in ('online', 'bots') then 38 else 9 end) / 2
    -- Four of a Kind: up to 8 a board. Spot the Flaw: 6 a case. Trace the Treatment: 4 a case.
    -- Who am I?: 12 a case (120 points / 10). Put it in order: 12 a question (120 points / 10).
    when game = 'four-of-a-kind' then 8 * least(5, greatest(1, coalesce((settings->>'boards')::int, 3)))
    when game = 'spot-the-flaw' then 6 * least(5, greatest(1, coalesce((settings->>'cases')::int, 3)))
    when game = 'trace-the-treatment' then 4 * least(5, greatest(1, coalesce((settings->>'cases')::int, 3)))
    when game = 'who-am-i' then 12 * least(10, greatest(1, coalesce((settings->>'cases')::int, 5)))
    when game = 'put-in-order' then 12 * least(10, greatest(1, coalesce((settings->>'cases')::int, 5)))
    else 0 end;
$function$;
