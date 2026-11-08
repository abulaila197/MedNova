-- Session 3 money stage (MN1-MN8): token packs and the $2.99 monthly subscription.
-- RevenueCat checks the store receipts and calls the revenuecat function, which writes these rows. Phones only read.

-- Bought tokens are 'purchase' wallet rows (one per store transaction, so a retried webhook never pays twice).
alter table public.wallet_ledger drop constraint if exists wallet_ledger_kind_check;
alter table public.wallet_ledger add constraint wallet_ledger_kind_check
  check (kind = any (array['exp','spend','refund','convert','grant','daily','achievement','purchase']));

create or replace function public.wallet_balance(uid uuid default auth.uid()) returns jsonb
language sql stable security definer set search_path = public as $$
  with s as (
    select coalesce(sum(exp) filter (where kind = 'exp'), 0) exp,
           coalesce(sum(tokens) filter (where kind in ('spend','refund','grant','daily','achievement','purchase')), 0) other
    from public.wallet_ledger where user_id = uid
  )
  select jsonb_build_object('exp', exp, 'level', public.wallet_level(exp), 'tokens', public.wallet_level_tokens(public.wallet_level(exp)) + other)
  from s where uid = auth.uid() or public.is_admin();
$$;

-- One row per player who has ever subscribed. Active while expires_at is in the future.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  product text not null,
  expires_at timestamptz,
  will_renew boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "read own subscription" on public.subscriptions for select to authenticated using (user_id = auth.uid());
