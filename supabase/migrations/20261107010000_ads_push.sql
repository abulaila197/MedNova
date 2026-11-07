-- Group 2 (Yazan 2026-11-07): real rewarded ads paid by the server, and push notifications.
--
-- Ads: Google calls our admob-ssv edge function when an ad is watched to the end; that function (service role) calls
-- ad_reward_grant(). The phone only asks ad_reward_check(nonce) whether its reward arrived. sparks_ad() and
-- ad_watched() can no longer be called by phones, so nobody can pay themselves without an ad.
--   Recharge ad ("Sparks reward"): +10 Sparks, 20 a day.  Shop ad ("Shop reward"): 1 token, 10 a day (Yazan 2026-11-07).
--
-- Push: phones register their Expo push address (push_register). Social pushes go out at once from triggers
-- (friend requests, accepted requests, room invites, Inbox gifts); one gentle reminder a day at most goes out at
-- 16:00 UTC (18:00 Cairo). Players turn either kind off in Settings (push_set_prefs). Sent through Expo's free push
-- service with pg_net.

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------- ads

create table if not exists public.ad_rewards (
  tx text primary key,                  -- Google's transaction id: each ad pays once
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('sparks', 'store')),
  nonce text not null,                  -- the phone's id for this ad (custom data)
  ok boolean not null,
  why text,
  at timestamptz not null default now()
);
create index if not exists ad_rewards_user_nonce on public.ad_rewards (user_id, nonce);
alter table public.ad_rewards enable row level security;
-- No policies: written by ad_reward_grant (service role), read through ad_reward_check.

create or replace function public.ad_reward_grant(tx text, uid uuid, custom text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  k text := split_part(coalesce(custom, ''), ':', 1);
  nonce text := left(split_part(coalesce(custom, ''), ':', 2), 80);
  n int;
begin
  if tx is null or tx = '' or uid is null or k not in ('sparks', 'store') or nonce = '' then
    return jsonb_build_object('ok', false, 'why', 'bad');
  end if;
  if not exists (select 1 from auth.users u where u.id = uid) then return jsonb_build_object('ok', false, 'why', 'user'); end if;
  if exists (select 1 from public.ad_rewards r where r.tx = ad_reward_grant.tx) then return jsonb_build_object('ok', true, 'why', 'again'); end if;
  if k = 'sparks' then
    perform pg_advisory_xact_lock(hashtext('sparks:' || uid::text));
    select count(*) into n from public.sparks_log l where l.user_id = uid and l.kind = 'ad' and l.at >= date_trunc('day', now());
    if n >= 20 then
      insert into public.ad_rewards (tx, user_id, kind, nonce, ok, why) values (ad_reward_grant.tx, uid, k, nonce, false, 'cap');
      return jsonb_build_object('ok', false, 'why', 'cap');
    end if;
    perform public.sparks_add(uid, 10, 'ad');
  else
    perform pg_advisory_xact_lock(hashtext('free:' || uid::text));
    select count(*) into n from public.ad_views a where a.user_id = uid and a.source = 'store' and a.at >= date_trunc('day', now());
    if n >= 10 then
      insert into public.ad_rewards (tx, user_id, kind, nonce, ok, why) values (ad_reward_grant.tx, uid, k, nonce, false, 'cap');
      return jsonb_build_object('ok', false, 'why', 'cap');
    end if;
    insert into public.ad_views (user_id, source) values (uid, 'store');
    perform public.pay_free(uid, 'free', 1, 'free:ad:' || to_char(now(), 'YYYY-MM-DD') || ':' || (n + 1), 'Watched an ad');
  end if;
  insert into public.ad_rewards (tx, user_id, kind, nonce, ok) values (ad_reward_grant.tx, uid, k, nonce, true);
  return jsonb_build_object('ok', true);
end $$;

-- The phone asks whether Google's reward for its ad arrived. With it: the Sparks bar as sparks_view gives it.
create or replace function public.ad_reward_check(nonce text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r public.ad_rewards;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into r from public.ad_rewards a where a.user_id = uid and a.nonce = ad_reward_check.nonce order by a.at desc limit 1;
  if not found then return jsonb_build_object('done', false); end if;
  return public.sparks_view(uid) || jsonb_build_object('done', true, 'ok', r.ok, 'why', r.why);
end $$;

-- The old free stand-in (+5 with no ad) now pays 10 like a real ad, but phones can't call it any more.
create or replace function public.sparks_ad() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('sparks:' || uid::text));
  select count(*) into n from public.sparks_log where user_id = uid and kind = 'ad' and at >= date_trunc('day', now());
  if n >= 20 then return public.sparks_view(uid) || jsonb_build_object('ok', false, 'why', 'cap'); end if;
  perform public.sparks_add(uid, 10, 'ad');
  return public.sparks_view(uid) || jsonb_build_object('ok', true);
end $$;

revoke all on function public.sparks_ad(), public.ad_watched(text) from public, anon, authenticated;
revoke all on function public.ad_reward_grant(text, uuid, text) from public, anon, authenticated;
grant execute on function public.ad_reward_grant(text, uuid, text) to service_role;
revoke all on function public.ad_reward_check(text) from public, anon;
grant execute on function public.ad_reward_check(text) to authenticated;

-- ---------------------------------------------------------------- push

create table if not exists public.push_devices (
  token text primary key,               -- ExponentPushToken[...]
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null default 'android',
  updated_at timestamptz not null default now()
);
create index if not exists push_devices_user on public.push_devices (user_id);

create table if not exists public.push_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  social boolean not null default true,
  reminders boolean not null default true
);

create table if not exists public.push_sent (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  at timestamptz not null default now()
);
create index if not exists push_sent_user_at on public.push_sent (user_id, at);

alter table public.push_devices enable row level security;
alter table public.push_prefs enable row level security;
alter table public.push_sent enable row level security;
-- No policies: phones use the functions below.

-- One phone = one account: signing in with another account moves the phone over.
create or replace function public.push_register(token text, platform text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  if push_register.token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,80}\]$' then raise exception 'token'; end if;
  insert into public.push_devices (token, user_id, platform, updated_at)
  values (push_register.token, uid, case when push_register.platform = 'ios' then 'ios' else 'android' end, now())
  on conflict on constraint push_devices_pkey do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
  -- At most 5 phones per account (oldest drop off).
  delete from public.push_devices d where d.user_id = uid and d.token not in (
    select x.token from public.push_devices x where x.user_id = uid order by x.updated_at desc limit 5);
end $$;

create or replace function public.push_unregister(token text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_devices d where d.token = push_unregister.token and d.user_id = auth.uid();
$$;

create or replace function public.push_my_prefs()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('social', coalesce(p.social, true), 'reminders', coalesce(p.reminders, true),
    'devices', (select count(*) from public.push_devices d where d.user_id = auth.uid()))
  from (select 1) one left join public.push_prefs p on p.user_id = auth.uid();
$$;

create or replace function public.push_set_prefs(social boolean, reminders boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  insert into public.push_prefs (user_id, social, reminders) values (uid, coalesce(push_set_prefs.social, true), coalesce(push_set_prefs.reminders, true))
  on conflict (user_id) do update set social = excluded.social, reminders = excluded.reminders;
  return public.push_my_prefs();
end $$;

-- Sends one notification to each listed player's phones (if that kind is on for them), 100 per request to Expo.
-- kind: 'friend' | 'invite' | 'inbox' (social) or 'sparks' | 'daily' | 'rounds' (reminders).
create or replace function public.push_send(uids uuid[], kind text, title text, body text)
returns int language plpgsql security definer set search_path = '' as $$
declare
  is_social boolean := kind in ('friend', 'invite', 'inbox');
  msgs jsonb;
  sent int := 0;
  part jsonb;
  i int := 0;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'to', d.token, 'title', left(title, 60), 'body', left(body, 160), 'sound', 'default',
      'channelId', 'default', 'data', jsonb_build_object('kind', kind))), '[]'::jsonb)
    into msgs
  from public.push_devices d
  left join public.push_prefs p on p.user_id = d.user_id
  where d.user_id = any (uids)
    and case when is_social then coalesce(p.social, true) else coalesce(p.reminders, true) end;
  if jsonb_array_length(msgs) = 0 then return 0; end if;
  while i < jsonb_array_length(msgs) loop
    select jsonb_agg(m) into part from (select m from jsonb_array_elements(msgs) with ordinality as x(m, o) where o > i and o <= i + 100) q;
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := part,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'));
    i := i + 100;
  end loop;
  insert into public.push_sent (user_id, kind)
  select distinct d.user_id, kind from public.push_devices d where d.user_id = any (uids);
  get diagnostics sent = row_count;
  return sent;
end $$;
revoke all on function public.push_send(uuid[], text, text, text) from public, anon, authenticated;

create or replace function public.push_name(uid uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce('Dr. ' || nullif(p.display_name, ''), '@' || p.username::text, 'A player') from public.profiles p where p.id = uid;
$$;
revoke all on function public.push_name(uuid) from public, anon, authenticated;

-- Friend requests and accepted requests.
create or replace function public.push_on_friendship()
returns trigger language plpgsql security definer set search_path = '' as $$
declare other uuid;
begin
  begin
    if tg_op = 'INSERT' and new.status = 'pending' then
      other := case when new.requester = new.user_a then new.user_b else new.user_a end;
      perform public.push_send(array[other], 'friend', 'New friend request', coalesce(public.push_name(new.requester), 'Someone') || ' wants to be your friend on MedNova.');
    elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
      other := case when new.requester = new.user_a then new.user_b else new.user_a end;
      perform public.push_send(array[new.requester], 'friend', 'Friend request accepted', coalesce(public.push_name(other), 'Your friend') || ' is now your friend. Challenge them!');
    end if;
  exception when others then null; -- a push must never stop the friendship itself
  end;
  return null;
end $$;
drop trigger if exists push_on_friendship on public.friendships;
create trigger push_on_friendship after insert or update of status on public.friendships
  for each row execute function public.push_on_friendship();

-- Room invites ("come and play").
create or replace function public.push_on_invite()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform public.push_send(array[new.to_user], 'invite', 'You''re invited to play',
      coalesce(public.push_name(new.from_user), 'A friend') || ' invited you to an online game. Open MedNova to join.');
  exception when others then null;
  end;
  return null;
end $$;
drop trigger if exists push_on_invite on public.invites;
create trigger push_on_invite after insert on public.invites for each row execute function public.push_on_invite();

-- Inbox: gifts and messages (from the team, or a friend's gift). A message to everyone goes to every phone.
create or replace function public.push_on_inbox()
returns trigger language plpgsql security definer set search_path = '' as $$
declare who uuid[];
begin
  begin
    if new.target is not null then who := array[new.target];
    else select array_agg(distinct d.user_id) into who from public.push_devices d;
    end if;
    if who is not null then
      perform public.push_send(who, 'inbox',
        case when new.from_user is not null then 'A gift from a friend' else 'New in your Inbox' end,
        case when new.from_user is not null then coalesce(public.push_name(new.from_user), 'A friend') || ' sent you a gift. Open your Inbox to collect it.'
             else coalesce(nullif(new.title, ''), 'Something is waiting for you') end);
    end if;
  exception when others then null;
  end;
  return null;
end $$;
drop trigger if exists push_on_inbox on public.inbox_messages;
create trigger push_on_inbox after insert on public.inbox_messages for each row execute function public.push_on_inbox();

-- One gentle reminder a day at most, at 16:00 UTC (18:00 Cairo, 19:00 Riyadh), only to players who were here in the
-- last 30 days but not in the last 4 hours. First that applies: Grand Rounds closes tonight (Fridays, if they
-- played this week) > daily reward waiting > Sparks bar full.
create or replace function public.push_reminders()
returns int language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
  friday boolean := extract(isodow from now()) = 5;
  wk_start timestamptz := timestamptz '2026-10-10 00:00:00+00' + floor(extract(epoch from now() - timestamptz '2026-10-10 00:00:00+00') / 604800) * interval '7 days';
begin
  for r in
    select distinct d.user_id from public.push_devices d
    join public.profiles p on p.id = d.user_id
    left join public.push_prefs pp on pp.user_id = d.user_id
    where coalesce(pp.reminders, true)
      and p.last_seen > now() - interval '30 days' and p.last_seen < now() - interval '4 hours'
      and not exists (select 1 from public.push_sent s where s.user_id = d.user_id and s.kind in ('sparks', 'daily', 'rounds') and s.at > now() - interval '20 hours')
  loop
    if friday and exists (select 1 from public.plays pl where pl.user_id = r.user_id and pl.ended_at >= wk_start) then
      perform public.push_send(array[r.user_id], 'rounds', 'Grand Rounds closes tonight', 'This week''s Grand Rounds ends at midnight. A few more games could lift your rank.');
    elsif not exists (select 1 from public.wallet_ledger w where w.user_id = r.user_id and w.kind = 'daily' and w.at > now() - interval '20 hours') then
      perform public.push_send(array[r.user_id], 'daily', 'Your daily reward is ready', 'Tap to collect today''s tokens and Sparks.');
    elsif not exists (select 1 from public.subscriptions su where su.user_id = r.user_id and su.expires_at > now())
      and (public.sparks_now(r.user_id)).value >= 100 then
      perform public.push_send(array[r.user_id], 'sparks', 'Your Sparks bar is full', 'You have a full bar of Sparks. Time for a game?');
    else
      continue;
    end if;
    n := n + 1;
  end loop;
  -- Keep the log small: 30 days is plenty.
  delete from public.push_sent where at < now() - interval '30 days';
  return n;
end $$;
revoke all on function public.push_reminders() from public, anon, authenticated;

select cron.unschedule('push-reminders') where exists (select 1 from cron.job where jobname = 'push-reminders');
select cron.schedule('push-reminders', '0 16 * * *', 'select public.push_reminders()');

revoke all on function public.push_register(text, text), public.push_unregister(text), public.push_my_prefs(), public.push_set_prefs(boolean, boolean) from public, anon;
grant execute on function public.push_register(text, text), public.push_unregister(text), public.push_my_prefs(), public.push_set_prefs(boolean, boolean) to authenticated;
