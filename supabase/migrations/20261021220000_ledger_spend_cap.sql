-- One spend row was capped at -1000 tokens, so the Nova (1,200) and Aurora (1,100) frames failed to buy or gift
-- ("Could not reach MedNova"). Spending has no limit now; the +5000 earning cap stays as a safety net (Yazan 2026-10-21).
alter table public.wallet_ledger drop constraint wallet_ledger_tokens_check;
alter table public.wallet_ledger add constraint wallet_ledger_tokens_check check (tokens <= 5000);
