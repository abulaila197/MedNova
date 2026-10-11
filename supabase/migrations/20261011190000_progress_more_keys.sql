-- Streak bests and Learn review progress also sync to the account. The key list check is replaced by a wider one.
alter table public.player_progress drop constraint if exists player_progress_key_check;
alter table public.player_progress add constraint player_progress_key_check check (
  key in ('crossword:best', 'riddler:best', 'casefiles:played', 'streak:best', 'learn:review', 'learn:opened')
);
