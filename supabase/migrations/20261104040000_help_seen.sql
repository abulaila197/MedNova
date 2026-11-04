-- Help pop-ups stay seen after a reinstall (Yazan 2026-11-04, point 2).
-- Each account keeps the list of pop-ups it has closed (the welcome tour plus one per page). The app reads it after
-- sign-in and adds to it each time a pop-up is closed. Only the player's own functions can read or change it.

create table if not exists public.help_seen (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pages text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.help_seen enable row level security;
revoke all on public.help_seen from anon, authenticated;

create or replace function public.my_help_seen()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select h.pages from public.help_seen h where h.user_id = auth.uid()), '{}'::text[]);
$$;

-- Adds pages to the list (at most 60 names of up to 40 letters; anything else is ignored).
create or replace function public.mark_help_seen(p_pages text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := auth.uid(); nw text[];
begin
  if me is null then return; end if;
  select coalesce(array_agg(distinct x), '{}') into nw
  from unnest(coalesce(p_pages, '{}')) x where x is not null and length(x) between 1 and 40;
  if cardinality(nw) = 0 then return; end if;
  insert into public.help_seen (user_id, pages) values (me, nw[1:60])
  on conflict (user_id) do update
    set pages = (select coalesce(array_agg(distinct y), '{}') from unnest(public.help_seen.pages || excluded.pages) y)[1:60],
        updated_at = now();
end;
$$;

revoke all on function public.my_help_seen() from public, anon;
revoke all on function public.mark_help_seen(text[]) from public, anon;
grant execute on function public.my_help_seen() to authenticated;
grant execute on function public.mark_help_seen(text[]) to authenticated;
