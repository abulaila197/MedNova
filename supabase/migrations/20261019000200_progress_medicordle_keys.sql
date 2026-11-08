-- GA5: Medicordle's Endless "already paid EXP" words and Daily streaks (per style) follow the account across phones.
-- The key list check is replaced by a wider one. Apply BEFORE shipping the app build that adds these keys to
-- PROGRESS_KEYS: until then every progress upsert from that build would fail the check.
alter table public.player_progress drop constraint if exists player_progress_key_check;
alter table public.player_progress add constraint player_progress_key_check check (
  key in ('crossword:best', 'riddler:best', 'casefiles:played', 'streak:best', 'learn:review', 'learn:opened',
          'medicordle:endless:paid', 'medicordle:streak:classic', 'medicordle:streak:custom')
);
