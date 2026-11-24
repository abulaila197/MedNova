-- Yazan 2026-11-24: a Sparks ad (Recharge) pays 25 Sparks, 5 a day (was 10 Sparks, 20 a day).
-- The Shop ad (1 token, 10 a day) is unchanged. Rerun-safe: only replaces functions.

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
    if n >= 5 then
      insert into public.ad_rewards (tx, user_id, kind, nonce, ok, why) values (ad_reward_grant.tx, uid, k, nonce, false, 'cap');
      return jsonb_build_object('ok', false, 'why', 'cap');
    end if;
    perform public.sparks_add(uid, 25, 'ad');
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

create or replace function public.sparks_ad() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('sparks:' || uid::text));
  select count(*) into n from public.sparks_log where user_id = uid and kind = 'ad' and at >= date_trunc('day', now());
  if n >= 5 then return public.sparks_view(uid) || jsonb_build_object('ok', false, 'why', 'cap'); end if;
  perform public.sparks_add(uid, 25, 'ad');
  return public.sparks_view(uid) || jsonb_build_object('ok', true);
end $$;

create or replace function public.sparks_view(uid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'value', s.value, 'at', s.at, 'refill_min', public.sparks_refill_min(uid),
    'ads_left', greatest(0, 5 - (select count(*) from public.sparks_log l where l.user_id = uid and l.kind = 'ad' and l.at >= date_trunc('day', now()))),
    'unlimited', exists (select 1 from public.subscriptions b where b.user_id = uid and b.expires_at > now()))
  from public.sparks_state s where s.user_id = uid;
$$;
