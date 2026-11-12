-- Admin Players: total active days and the current active-day streak per player (Yazan 2026-11-12), counted from
-- 11 Nov 2026 in Egypt time. A day counts when the app was open (the minute ping on profiles.last_seen), a game was
-- played or anything reached the wallet. Runs after 20261109180000_admin_players.sql.

create table if not exists public.active_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
alter table public.active_days enable row level security;
revoke all on public.active_days from anon, authenticated;

create or replace function public.egypt_day(t timestamptz) returns date
language sql immutable set search_path = '' as $$ select (t at time zone 'Africa/Cairo')::date $$;

-- Every last_seen ping marks today (once per player per day; the insert is skipped when the row is there).
create or replace function public.mark_active_day() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  if new.last_seen is not null and new.last_seen >= timestamptz '2026-11-11 00:00 Africa/Cairo'
     and (old.last_seen is null or public.egypt_day(old.last_seen) <> public.egypt_day(new.last_seen)) then
    insert into public.active_days (user_id, day) values (new.id, public.egypt_day(new.last_seen)) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists profiles_active_day on public.profiles;
create trigger profiles_active_day after update of last_seen on public.profiles
  for each row execute function public.mark_active_day();

-- Plays and wallet rows mark their day too (a game finished offline syncs later with its own time).
create or replace function public.mark_active_day_play() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  if new.user_id is not null and coalesce(new.started_at, now()) >= timestamptz '2026-11-11 00:00 Africa/Cairo' then
    insert into public.active_days (user_id, day) values (new.user_id, public.egypt_day(coalesce(new.started_at, now()))) on conflict do nothing;
  end if;
  return new;
end $$;
create or replace function public.mark_active_day_ledger() returns trigger
language plpgsql security definer set search_path = 'public' as $$
begin
  if new.user_id is not null and coalesce(new.at, now()) >= timestamptz '2026-11-11 00:00 Africa/Cairo' then
    insert into public.active_days (user_id, day) values (new.user_id, public.egypt_day(coalesce(new.at, now()))) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists plays_active_day on public.plays;
create trigger plays_active_day after insert on public.plays for each row execute function public.mark_active_day_play();
drop trigger if exists ledger_active_day on public.wallet_ledger;
create trigger ledger_active_day after insert on public.wallet_ledger for each row execute function public.mark_active_day_ledger();

-- Backfill from 11 Nov: plays, wallet rows and the last time each player was seen.
insert into public.active_days (user_id, day)
select user_id, public.egypt_day(started_at) from public.plays where user_id is not null and started_at >= timestamptz '2026-11-11 00:00 Africa/Cairo'
union select user_id, public.egypt_day(ended_at) from public.plays where user_id is not null and ended_at >= timestamptz '2026-11-11 00:00 Africa/Cairo'
union select user_id, public.egypt_day(at) from public.wallet_ledger where user_id is not null and at >= timestamptz '2026-11-11 00:00 Africa/Cairo'
union select id, public.egypt_day(last_seen) from public.profiles where last_seen >= timestamptz '2026-11-11 00:00 Africa/Cairo'
on conflict do nothing;

-- The streak: days in a row up to today, or up to yesterday if today hasn't started yet for them.
create or replace function public.active_streak(uid uuid) returns int
language sql stable security definer set search_path = 'public' as $$
  with d as (select day, day - (row_number() over (order by day))::int as grp from public.active_days where user_id = uid),
  last_run as (select grp, max(day) as last, count(*) as n from d group by grp order by max(day) desc limit 1)
  select coalesce((select n::int from last_run where last >= public.egypt_day(now()) - 1), 0);
$$;
revoke execute on function public.active_streak(uuid) from public, anon, authenticated;

-- The list again, with the two counts (and a sort by most active days).
drop function if exists public.admin_players(text, text, int, int);
create function public.admin_players(q text default '', sort text default 'active', lim int default 50, off int default 0)
returns table (id uuid, username text, display_name text, avatar text, level int, exp int, created_at timestamptz,
               last_seen timestamptz, providers text[], unlimited boolean, banned boolean, active_days int, active_streak int)
language plpgsql stable security definer set search_path = 'public', 'auth' as $$
declare pat text := replace(replace(replace(coalesce(trim(q), ''), '\', ''), '%', ''), '_', '\_');
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query
    with ex as (select w.user_id, sum(w.exp)::int as exp from public.wallet_ledger w where w.kind = 'exp' group by w.user_id),
    ad as (select a.user_id, count(*)::int as n from public.active_days a group by a.user_id),
    base as (
      select pr.id, pr.username::text as username, pr.display_name, pr.avatar, coalesce(ex.exp, 0) as exp,
             pr.created_at, pr.last_seen, coalesce(ad.n, 0) as days
      from public.profiles pr left join ex on ex.user_id = pr.id left join ad on ad.user_id = pr.id
      where pat = '' or pr.username::text ilike '%' || pat || '%' or pr.display_name ilike '%' || pat || '%'
    )
    select b.id, b.username, b.display_name, b.avatar, public.wallet_level(b.exp)::int, b.exp, b.created_at, b.last_seen,
           coalesce((select array_agg(distinct i.provider order by i.provider) from auth.identities i where i.user_id = b.id), '{}'),
           exists (select 1 from public.subscriptions s where s.user_id = b.id and s.expires_at > now()),
           exists (select 1 from public.bans x where x.user_id = b.id),
           b.days, public.active_streak(b.id)
    from base b
    order by
      case when sort = 'newest' then b.created_at end desc nulls last,
      case when sort = 'level' then b.exp end desc nulls last,
      case when sort = 'days' then b.days end desc nulls last,
      b.last_seen desc nulls last, b.username
    limit greatest(1, least(coalesce(lim, 50), 100)) offset greatest(0, coalesce(off, 0));
end $$;
revoke execute on function public.admin_players(text, text, int, int) from public, anon;
grant execute on function public.admin_players(text, text, int, int) to authenticated;
