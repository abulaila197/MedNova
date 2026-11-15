-- MedNova (2026-11-16): Admin switches that reach every phone without a new build.
-- First switch: show_razan (off = Razan hidden everywhere). Safe to paste twice.
create table if not exists public.app_flags (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_flags enable row level security;
drop policy if exists app_flags_read on public.app_flags;
create policy app_flags_read on public.app_flags for select to anon, authenticated using (true);
grant select on public.app_flags to anon, authenticated;

insert into public.app_flags (key, value) values ('show_razan', 'false'::jsonb) on conflict (key) do nothing;

create or replace function public.set_app_flag(flag text, val jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if flag not in ('show_razan') then raise exception 'unknown switch'; end if;
  insert into public.app_flags (key, value, updated_at) values (flag, val, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;
revoke all on function public.set_app_flag(text, jsonb) from public, anon;
grant execute on function public.set_app_flag(text, jsonb) to authenticated;

-- Check: one row, show_razan = false.
select * from public.app_flags;
