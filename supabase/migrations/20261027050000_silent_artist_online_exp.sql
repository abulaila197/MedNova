-- Online Silent Artist earns EXP (Yazan 2026-10-27): 1 per 10 points, up to 60 a game. Solo and Pass the phone stay at 0.

create or replace function public.wallet_exp_cap(game text, mode text, settings jsonb)
 returns integer
 language sql
 immutable
 set search_path to ''
as $function$
  select case
    when mode = 'offline' then 0
    when game = 'case-files-unsolved' then case when mode = 'online' then 60 * public.race_count(settings) else 60 end
    when game = 'the-conqueror' then case when mode = 'online' then 400 else 0 end
    when game = 'nova-crossword' then case when mode = 'online' then 12 * public.race_count(settings) else 31 * 12 end
    when game = 'the-diagnostic-pursuit' then 12 * least(10, greatest(1, coalesce((settings->>'cases')::int, 5)))
    when game = 'nova-medicordle' then case
      when mode = 'online' then 12 * least(10, greatest(1, coalesce((settings->>'words')::int, 5)))
      when settings->>'word' = 'daily' then 24
      when settings->>'word' = 'endless' then 1800
      else 0 end
    when game = 'the-riddler' then case when mode = 'online' then 12 * least(10, greatest(1, coalesce((settings->>'photos')::int, 5))) else 86 * 12 end
    when game = 'the-silent-artist' then case when mode = 'online' then 60 else 0 end
    when game = 'the-streak-master' then 60
    when game = 'the-quiz-parade' then 60
    when game = 'imposter' then 60
    when game = 'code-clinic' then 60
    when game = 'nova-password' then 60
    when game = 'trust-me-not' then 250
    when game = 'the-wheels-of-chaos' then (least(100, greatest(25, coalesce((settings->>'target')::int, 50))) + case when mode = 'online' then 38 else 9 end) / 2
    else 0 end;
$function$;
