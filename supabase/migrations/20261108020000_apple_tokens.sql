-- Sign in with Apple refresh tokens (Apple rule 5.1.1(v), Yazan 2026-11-08): when a player deletes an account made
-- with Apple, the delete-account function revokes the Apple link with this token. Only the server reads or writes it.
create table if not exists public.apple_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
alter table public.apple_tokens enable row level security;
revoke all on public.apple_tokens from public, anon, authenticated;
