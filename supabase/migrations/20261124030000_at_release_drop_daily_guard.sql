-- Yazan 2026-11-24, run at PRODUCTION release (once phones have the update with no Daily word): the old Daily-word
-- EXP guard is no longer needed. Rerun-safe.

drop trigger if exists wallet_medicordle_daily_guard on public.wallet_ledger;
drop function if exists public.wallet_medicordle_daily_guard();
