-- Game progress that lives outside the play record (Crossword stars, Riddler bests, Case Files stamps), kept on the
-- account so it follows the player to another phone. The phone merges (best wins) and writes back the result.
create table if not exists public.player_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (key in ('crossword:best', 'riddler:best', 'casefiles:played')),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.player_progress enable row level security;
create policy "read own progress" on public.player_progress for select to authenticated using (user_id = auth.uid());
create policy "add own progress" on public.player_progress for insert to authenticated with check (user_id = auth.uid());
create policy "update own progress" on public.player_progress for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Reports from the red ! (guests too). The app sends what was on screen; only the admin reads them.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null,
  body text not null default '',
  context jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security; -- no policies: only the functions below touch it

create or replace function public.submit_report(kind text, body text, context jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if kind not in ('Medical content', 'Game', 'Technical', 'Other') then raise exception 'kind'; end if;
  -- A signed-in player can send up to 30 a day; keeps a stuck button from flooding the list.
  if auth.uid() is not null and (select count(*) from public.reports r where r.user_id = auth.uid() and r.created_at > now() - interval '1 day') >= 30 then
    raise exception 'too many';
  end if;
  insert into public.reports (user_id, kind, body, context)
  values (auth.uid(), kind, left(coalesce(body, ''), 1000), coalesce(context, '{}'::jsonb))
  returning id into rid;
  return rid;
end $$;

create or replace function public.admin_reports(show text default 'new')
returns table (id uuid, kind text, body text, context jsonb, status text, created_at timestamptz, username text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query
    select r.id, r.kind, r.body, r.context, r.status, r.created_at, pr.username::text
    from public.reports r left join public.profiles pr on pr.id = r.user_id
    where show = 'all' or r.status = show
    order by r.created_at desc limit 200;
end $$;

create or replace function public.admin_report_status(report uuid, status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if status not in ('new', 'done') then raise exception 'status'; end if;
  update public.reports r set status = admin_report_status.status where r.id = report;
end $$;

revoke all on function public.submit_report(text, text, jsonb), public.admin_reports(text), public.admin_report_status(uuid, text) from public;
grant execute on function public.submit_report(text, text, jsonb) to anon, authenticated;
grant execute on function public.admin_reports(text), public.admin_report_status(uuid, text) to authenticated;

-- Supabase gives anon execute on new functions by default; the admin ones are for signed-in admins only.
revoke execute on function public.admin_reports(text), public.admin_report_status(uuid, text) from anon;
