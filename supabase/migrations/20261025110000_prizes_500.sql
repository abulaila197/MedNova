-- Collection prizes (Yazan, 2026-10-25): all 8 Nova Mechs 500 tokens (was 400), the treasure hunt 500 (was 200),
-- and a new prize of 500 tokens, once, for owning all five Style shop robots (Bloop, Pixel, Nimbus, Ember, Zenith).
-- Mirrors MECHS_PRIZE, HUNT_PRIZE and SHOP_ROBOTS_PRIZE on the phone.

CREATE OR REPLACE FUNCTION public.chest_open(kind text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    select * into it from public.chest_items() c
      where c.rarity = rar and not (kind in ('wooden', 'golden') and c.stars = 5) order by random() limit 1;
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
  if (select count(*) from public.style_owned where user_id = uid and item like 'mech:%') >= 8
     and not exists (select 1 from public.wallet_ledger where user_id = uid and reason = 'mechs:prize') then
    perform public.pay_free(uid, 'chest', 500, 'mechs:prize', 'Nova Mechs complete');
    prize := 500;
  end if;
  return jsonb_build_object('ok', true, 'items', got, 'prize', prize, 'chests', public.chests_owned(uid));
end $function$;

CREATE OR REPLACE FUNCTION public.hunt_prize()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('hunt:' || uid::text));
  if (select count(*) from public.hunt_cards where user_id = uid) < 9 then return jsonb_build_object('ok', false, 'why', 'not yet'); end if;
  if exists (select 1 from public.wallet_ledger where user_id = uid and reason = 'hunt:prize') then return jsonb_build_object('ok', false, 'why', 'done'); end if;
  perform public.pay_free(uid, 'hunt', 500, 'hunt:prize');
  return jsonb_build_object('ok', true, 'tokens', 500);
end $function$;

-- style_buy: the owner of the bought item (you, or the friend you gift it to) gets the robots prize once all five are theirs.
CREATE OR REPLACE FUNCTION public.style_buy(item text, gift_to uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid := auth.uid(); target uuid := coalesce(gift_to, auth.uid()); cost int := public.style_cost(item); bal int; prize int := 0;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if cost is null or cost = 0 then return jsonb_build_object('ok', false, 'why', 'not sold'); end if;
  if gift_to is not null and (gift_to = uid or not exists (select 1 from public.friendships f
      where f.status = 'accepted' and f.user_a = least(uid, gift_to) and f.user_b = greatest(uid, gift_to))) then
    return jsonb_build_object('ok', false, 'why', 'not friends');
  end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || uid::text));
  if item = any (public.style_owned_all(target)) then return jsonb_build_object('ok', false, 'why', 'owned'); end if;
  bal := (public.wallet_balance(uid)->>'tokens')::int;
  if bal < cost then return jsonb_build_object('ok', false, 'why', 'tokens', 'need', cost - bal); end if;
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, note, at)
  values ('s' || replace(gen_random_uuid()::text, '-', ''), uid, 'spend', 0, -cost,
          case when gift_to is null then 'style:' || item else 'gift:' || item || ':' || gift_to end, null, now());
  insert into public.style_owned (user_id, item, from_user, seen) values (target, item, case when gift_to is null then null else uid end, gift_to is null);
  if item like 'robot:%'
     and (select count(distinct o.item) from public.style_owned o where o.user_id = target
          and o.item in ('robot:bloop', 'robot:pixel', 'robot:nimbus', 'robot:ember', 'robot:zenith')) = 5
     and not exists (select 1 from public.wallet_ledger where user_id = target and reason = 'robots:prize') then
    perform pg_advisory_xact_lock(hashtext('robots:' || target::text));
    if not exists (select 1 from public.wallet_ledger where user_id = target and reason = 'robots:prize') then
      perform public.pay_free(target, 'chest', 500, 'robots:prize', 'Style robots complete');
      prize := case when gift_to is null then 500 else 0 end;
    end if;
  end if;
  return jsonb_build_object('ok', true, 'cost', cost, 'prize', prize);
end $function$;
