-- Daily challenges, chests and Nova Mechs (Yazan 2026-10-18).
-- Three challenges a day, one after the other: each only counts what happens after the one before it is done.
--   1: play 5 games -> wooden chest
--   2: play 8 games, watch 5 ads, share the app 5 times -> golden chest
--   3: play 12 games, share 5 times, finish all Learn review cards -> diamond chest
-- All 3 done 5 days in a row -> epic chest (the only source of 5-star robots). Chests are earned only, never sold.
-- The day is the player's own day (their phone's midnight), sent as a UTC offset in minutes.

alter table public.wallet_ledger drop constraint if exists wallet_ledger_kind_check;
alter table public.wallet_ledger add constraint wallet_ledger_kind_check
  check (kind = any (array['exp','spend','refund','convert','grant','daily','achievement','purchase','free','hunt','rounds','chest']));

-- Shares and "review pile finished" are counted on the phone (a share counts when an app is picked on iPhone,
-- when the share menu opens on Android); the server keeps one row per event.
create table if not exists public.challenge_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('share', 'review')),
  at timestamptz not null default now()
);
create index if not exists challenge_events_user_at on public.challenge_events (user_id, at);
alter table public.challenge_events enable row level security;

create table if not exists public.chest_earned (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('wooden', 'golden', 'diamond', 'epic')),
  at timestamptz not null default now(),
  primary key (user_id, day, kind)
);
alter table public.chest_earned enable row level security;

create table if not exists public.chest_opened (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('wooden', 'golden', 'diamond', 'epic')),
  items jsonb not null,
  at timestamptz not null default now()
);
create index if not exists chest_opened_user on public.chest_opened (user_id);
alter table public.chest_opened enable row level security;

create or replace function public.challenge_log(kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return jsonb_build_object('ok', false, 'why', 'signin'); end if;
  if kind not in ('share', 'review') then raise exception 'kind'; end if;
  -- More than the challenges can use is never needed: 20 a day each.
  if (select count(*) from public.challenge_events e where e.user_id = uid and e.kind = challenge_log.kind and e.at > now() - interval '1 day') >= 20 then
    return jsonb_build_object('ok', true);
  end if;
  insert into public.challenge_events (user_id, kind) values (uid, challenge_log.kind);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.challenge_log(text) from public, anon;
grant execute on function public.challenge_log(text) to authenticated;

-- The nth event time after `since` (null when there are fewer than n).
create or replace function public.challenge_nth(ts timestamptz[], since timestamptz, n int) returns timestamptz
language sql immutable set search_path = '' as $$
  select x from unnest(ts) x where x > since order by x offset n - 1 limit 1
$$;

create or replace function public.challenge_count(ts timestamptz[], since timestamptz, cap int) returns int
language sql immutable set search_path = '' as $$
  select least(cap, count(*)::int) from unnest(ts) x where x > since
$$;

create or replace function public.chests_owned(uid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'wooden', (select count(*) from public.chest_earned where user_id = uid and kind = 'wooden') - (select count(*) from public.chest_opened where user_id = uid and kind = 'wooden'),
    'golden', (select count(*) from public.chest_earned where user_id = uid and kind = 'golden') - (select count(*) from public.chest_opened where user_id = uid and kind = 'golden'),
    'diamond', (select count(*) from public.chest_earned where user_id = uid and kind = 'diamond') - (select count(*) from public.chest_opened where user_id = uid and kind = 'diamond'),
    'epic', (select count(*) from public.chest_earned where user_id = uid and kind = 'epic') - (select count(*) from public.chest_opened where user_id = uid and kind = 'epic'))
$$;
revoke all on function public.chests_owned(uuid) from public, anon, authenticated;

-- Today's challenges for the signed-in player. Also files any chest just earned (once per day and kind).
create or replace function public.challenges_status(tz_min int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  off interval; dday date; start timestamptz; far timestamptz := timestamptz '1970-01-01';
  g timestamptz[]; a timestamptz[]; sh timestamptz[]; rv timestamptz[];
  t1 timestamptz; t2 timestamptz; t3 timestamptz; step int; streak int := 0; d date;
begin
  if tz_min is null or tz_min not between -840 and 840 then raise exception 'tz'; end if;
  off := make_interval(mins => tz_min);
  dday := (now() + off)::date;
  start := (dday::timestamp - off) at time zone 'UTC';
  if uid is null then
    return jsonb_build_object('signed_in', false, 'day', dday, 'step', 1, 'streak', 0,
      'resets', (extract(epoch from start + interval '1 day') * 1000)::bigint,
      'chests', jsonb_build_object('wooden', 0, 'golden', 0, 'diamond', 0, 'epic', 0),
      'tasks', jsonb_build_array(
        jsonb_build_array(jsonb_build_object('k', 'games', 'n', 0, 'of', 5)),
        jsonb_build_array(jsonb_build_object('k', 'games', 'n', 0, 'of', 8), jsonb_build_object('k', 'ads', 'n', 0, 'of', 5), jsonb_build_object('k', 'shares', 'n', 0, 'of', 5)),
        jsonb_build_array(jsonb_build_object('k', 'games', 'n', 0, 'of', 12), jsonb_build_object('k', 'shares', 'n', 0, 'of', 5), jsonb_build_object('k', 'review', 'n', 0, 'of', 1))));
  end if;
  perform pg_advisory_xact_lock(hashtext('chest:' || uid::text));

  select coalesce(array_agg(p.ended_at), '{}') into g from public.plays p
    where p.user_id = uid and p.status = 'finished' and p.ended_at >= start and not coalesce(p.settings ? 'custom', false);
  select coalesce(array_agg(v.at), '{}') into a from public.ad_views v where v.user_id = uid and v.at >= start;
  select coalesce(array_agg(e.at), '{}') into sh from public.challenge_events e where e.user_id = uid and e.kind = 'share' and e.at >= start;
  select coalesce(array_agg(e.at), '{}') into rv from public.challenge_events e where e.user_id = uid and e.kind = 'review' and e.at >= start;

  t1 := public.challenge_nth(g, far, 5);
  if t1 is not null then
    t2 := greatest(public.challenge_nth(g, t1, 8), public.challenge_nth(a, t1, 5), public.challenge_nth(sh, t1, 5));
    if public.challenge_nth(g, t1, 8) is null or public.challenge_nth(a, t1, 5) is null or public.challenge_nth(sh, t1, 5) is null then t2 := null; end if;
  end if;
  if t2 is not null then
    t3 := greatest(public.challenge_nth(g, t2, 12), public.challenge_nth(sh, t2, 5), public.challenge_nth(rv, t2, 1));
    if public.challenge_nth(g, t2, 12) is null or public.challenge_nth(sh, t2, 5) is null or public.challenge_nth(rv, t2, 1) is null then t3 := null; end if;
  end if;
  step := case when t3 is not null then 4 when t2 is not null then 3 when t1 is not null then 2 else 1 end;

  if t1 is not null then insert into public.chest_earned (user_id, day, kind) values (uid, dday, 'wooden') on conflict do nothing; end if;
  if t2 is not null then insert into public.chest_earned (user_id, day, kind) values (uid, dday, 'golden') on conflict do nothing; end if;
  if t3 is not null then insert into public.chest_earned (user_id, day, kind) values (uid, dday, 'diamond') on conflict do nothing; end if;

  -- Days in a row with all 3 done, counting back from today (or yesterday while today is still open).
  d := case when t3 is not null then dday else dday - 1 end;
  while exists (select 1 from public.chest_earned c where c.user_id = uid and c.day = d and c.kind = 'diamond') loop
    streak := streak + 1; d := d - 1;
    exit when streak >= 400;
  end loop;
  -- Every 5th day of a run pays an epic chest; the dots then start again.
  if t3 is not null and streak > 0 and streak % 5 = 0 then
    insert into public.chest_earned (user_id, day, kind) values (uid, dday, 'epic') on conflict do nothing;
  end if;

  return jsonb_build_object('signed_in', true, 'day', dday, 'step', step,
    'streak', case when streak = 0 then 0 when streak % 5 = 0 and t3 is not null then 5 else streak % 5 end,
    'resets', (extract(epoch from start + interval '1 day') * 1000)::bigint,
    'chests', public.chests_owned(uid),
    'tasks', jsonb_build_array(
      jsonb_build_array(jsonb_build_object('k', 'games', 'n', public.challenge_count(g, far, 5), 'of', 5)),
      jsonb_build_array(
        jsonb_build_object('k', 'games', 'n', case when t1 is null then 0 else public.challenge_count(g, t1, 8) end, 'of', 8),
        jsonb_build_object('k', 'ads', 'n', case when t1 is null then 0 else public.challenge_count(a, t1, 5) end, 'of', 5),
        jsonb_build_object('k', 'shares', 'n', case when t1 is null then 0 else public.challenge_count(sh, t1, 5) end, 'of', 5)),
      jsonb_build_array(
        jsonb_build_object('k', 'games', 'n', case when t2 is null then 0 else public.challenge_count(g, t2, 12) end, 'of', 12),
        jsonb_build_object('k', 'shares', 'n', case when t2 is null then 0 else public.challenge_count(sh, t2, 5) end, 'of', 5),
        jsonb_build_object('k', 'review', 'n', case when t2 is null then 0 else public.challenge_count(rv, t2, 1) end, 'of', 1))));
end $$;
revoke all on function public.challenges_status(int) from public;
grant execute on function public.challenges_status(int) to anon, authenticated;

-- What a chest can hold. Items are style_owned keys: 'mech:<robot>', 'pack:<text pack>', 'effect:<win effect>';
-- tokens are 'tokens:<n>'. Duplicates pay `dupe` tokens instead.
create or replace function public.chest_items() returns table (key text, rarity text, dupe int, stars int)
language sql immutable set search_path = '' as $$
  values ('tokens:10', 'common', 0, 0), ('tokens:20', 'common', 0, 0), ('tokens:30', 'uncommon', 0, 0),
    ('pack:arcade', 'uncommon', 15, 0), ('pack:comic', 'uncommon', 15, 0), ('pack:chrome', 'uncommon', 15, 0),
    ('tokens:50', 'rare', 0, 0), ('mech:sprocket', 'rare', 25, 3), ('mech:kit', 'rare', 25, 3),
    ('tokens:100', 'epic', 0, 0), ('mech:vex', 'epic', 50, 4), ('mech:bulwark', 'epic', 50, 4), ('mech:echo', 'epic', 50, 4),
    ('mech:aurora', 'legendary', 80, 5), ('mech:cortex', 'legendary', 80, 5), ('mech:titan', 'legendary', 80, 5),
    ('effect:too_easy', 'legendary', 70, 0), ('effect:mic_drop', 'legendary', 70, 0)
$$;

-- Rarity odds in percent per chest (the approved table).
create or replace function public.chest_odds(kind text) returns jsonb
language sql immutable set search_path = '' as $$
  select case kind
    when 'wooden' then '{"common":70,"uncommon":24,"rare":5,"epic":1}'::jsonb
    when 'golden' then '{"common":50,"uncommon":30,"rare":14,"epic":5,"legendary":1}'::jsonb
    when 'diamond' then '{"common":30,"uncommon":32,"rare":22,"epic":12,"legendary":4}'::jsonb
    when 'epic' then '{"rare":45,"epic":35,"legendary":20}'::jsonb
  end
$$;

create or replace function public.chest_open(kind text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); n int; i int; roll numeric; acc numeric; rar text; odds jsonb := public.chest_odds(kind);
  o record; it record; own text[]; got jsonb := '[]'::jsonb; dupe boolean; pay int; open_id uuid := gen_random_uuid(); prize int := 0;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if odds is null then raise exception 'kind'; end if;
  perform pg_advisory_xact_lock(hashtext('chest:' || uid::text));
  if (public.chests_owned(uid)->>kind)::int < 1 then return jsonb_build_object('ok', false, 'why', 'none'); end if;
  n := case kind when 'wooden' then 1 when 'golden' then 2 else 3 end;
  for i in 1..n loop
    roll := random() * 100; acc := 0; rar := null;
    for o in select k, (odds->>k)::numeric v from unnest(array['common','uncommon','rare','epic','legendary']) k where odds ? k loop
      acc := acc + o.v;
      if rar is null and roll < acc then rar := o.k; end if;
    end loop;
    rar := coalesce(rar, 'rare');
    -- 5-star robots only come from the epic chest; outside it, Legendary means a win effect.
    select * into it from public.chest_items() c
      where c.rarity = rar and not (kind <> 'epic' and c.stars = 5) order by random() limit 1;
    own := public.style_owned_all(uid);
    if it.key like 'tokens:%' then
      pay := split_part(it.key, ':', 2)::int; dupe := false;
    else
      dupe := it.key = any (own);
      pay := case when dupe then it.dupe else 0 end;
      if not dupe then insert into public.style_owned (user_id, item, seen) values (uid, it.key, true) on conflict do nothing; end if;
    end if;
    if pay > 0 then
      perform public.pay_free(uid, 'chest', pay, 'chest:' || open_id || ':' || i, case when dupe then 'Duplicate ' || it.key else 'Chest tokens' end);
    end if;
    got := got || jsonb_build_object('key', it.key, 'rarity', rar, 'dupe', dupe, 'tokens', pay);
  end loop;
  insert into public.chest_opened (id, user_id, kind, items) values (open_id, uid, kind, got);
  -- Nova Mechs complete: double the Original pack prize, once.
  if (select count(*) from public.style_owned where user_id = uid and item like 'mech:%') >= 8
     and not exists (select 1 from public.wallet_ledger where user_id = uid and reason = 'mechs:prize') then
    perform public.pay_free(uid, 'chest', 400, 'mechs:prize', 'Nova Mechs complete');
    prize := 400;
  end if;
  return jsonb_build_object('ok', true, 'items', got, 'prize', prize, 'chests', public.chests_owned(uid));
end $$;
revoke all on function public.chest_open(text) from public, anon;
grant execute on function public.chest_open(text) to authenticated;

-- The character a player wears: any of the 9 originals, or a Nova Mech they own.
create or replace function public.avatar_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.avatar in ('sprocket', 'kit', 'vex', 'bulwark', 'echo', 'aurora', 'cortex', 'titan')
     and not exists (select 1 from public.style_owned o where o.user_id = new.id and o.item = 'mech:' || new.avatar) then
    raise exception 'robot not owned';
  end if;
  return new;
end $$;
create or replace trigger profiles_avatar_check before update of avatar on public.profiles for each row execute function public.avatar_check();

create or replace function public.set_avatar(slug text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  if slug not in ('yazan', 'yara', 'omar', 'layla', 'atlas', 'nova', 'bolt', 'iris', 'pip', 'sprocket', 'kit', 'vex', 'bulwark', 'echo', 'aurora', 'cortex', 'titan') then
    return jsonb_build_object('ok', false, 'why', 'unknown');
  end if;
  if slug in ('sprocket', 'kit', 'vex', 'bulwark', 'echo', 'aurora', 'cortex', 'titan')
     and not exists (select 1 from public.style_owned o where o.user_id = uid and o.item = 'mech:' || slug) then
    return jsonb_build_object('ok', false, 'why', 'not owned');
  end if;
  update public.profiles set avatar = slug, updated_at = now() where id = uid;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.set_avatar(text) from public, anon;
grant execute on function public.set_avatar(text) to authenticated;
