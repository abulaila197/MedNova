-- MedNova (2026-11-16): what the phone's store (Apple / Google, through RevenueCat) answered when a purchase, a
-- restore or loading the products went wrong, so a failed buy can be read exactly (App Review 2.1(b), Nov 2026).
-- Admin page reads the newest rows. Rows older than 60 days are cleared. Safe to paste twice.
create table if not exists public.store_errors (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  stage text not null check (stage in ('products', 'login', 'buy', 'restore')),
  product text check (length(product) <= 80),
  platform text check (length(platform) <= 40),
  app text check (length(app) <= 40),
  device text check (length(device) <= 80),
  storefront text check (length(storefront) <= 10),
  found int,
  code text check (length(code) <= 80),
  message text check (length(message) <= 600),
  underlying text check (length(underlying) <= 600)
);
create index if not exists store_errors_at on public.store_errors (at desc);
alter table public.store_errors enable row level security;
drop policy if exists store_errors_add on public.store_errors;
create policy store_errors_add on public.store_errors for insert to authenticated with check (user_id = auth.uid());
drop policy if exists store_errors_admin on public.store_errors;
create policy store_errors_admin on public.store_errors for select to authenticated using (public.is_admin());
grant insert on public.store_errors to authenticated;
grant select on public.store_errors to authenticated;

-- A phone can't flood it: at most 20 rows per account per day.
create or replace function public.store_errors_cap() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.store_errors where user_id = new.user_id and at > now() - interval '1 day') >= 20 then
    return null;
  end if;
  delete from public.store_errors where at < now() - interval '60 days';
  return new;
end $$;
drop trigger if exists store_errors_cap on public.store_errors;
create trigger store_errors_cap before insert on public.store_errors for each row execute function public.store_errors_cap();

-- Check: the table is there and empty.
select count(*) as store_errors_rows from public.store_errors;
