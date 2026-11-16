-- MedNova (2026-11-16): the usage guard checks every 3 hours instead of every hour (DB size and sign-ins grow slowly),
-- and the server's call counters start fresh, so the next days show what the new build really uses. Safe to paste twice.
select cron.schedule('usage-guard', '5 */3 * * *', 'select public.check_usage_guard() as usage_guard_ready');
select extensions.pg_stat_statements_reset();

-- Check: usage-guard runs at minute 5 every 3 hours.
select jobname, schedule from cron.job where jobname = 'usage-guard';
