-- Characters and chests (Yazan 2026-10-25, list #28 #29 #39).

-- #29: epic chest odds 40 rare / 35 epic / 25 legendary.
create or replace function public.chest_odds(kind text) returns jsonb
language sql immutable set search_path = '' as $$
  select case kind
    when 'wooden' then '{"common":70,"uncommon":24,"rare":5,"epic":1}'::jsonb
    when 'golden' then '{"common":50,"uncommon":30,"rare":14,"epic":5,"legendary":1}'::jsonb
    when 'diamond' then '{"common":30,"uncommon":32,"rare":22,"epic":12,"legendary":4}'::jsonb
    when 'epic' then '{"rare":40,"epic":35,"legendary":25}'::jsonb
  end
$$;

-- #28: the diamond chest's 4% legendary roll can now give a 5-star robot too (wooden and golden still can't).
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
    perform public.pay_free(uid, 'chest', 400, 'mechs:prize', 'Nova Mechs complete');
    prize := 400;
  end if;
  return jsonb_build_object('ok', true, 'items', got, 'prize', prize, 'chests', public.chests_owned(uid));
end $$;

-- #39: Original pack characters open card by card in the treasure hunt; Bolt and Iris (1 star) are open to all.
-- Players already wearing one keep it until they change.
alter table public.profiles alter column avatar set default 'bolt';

create or replace function public.avatar_open(uid uuid, slug text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when slug in ('bolt', 'iris') then true
    when slug in ('yazan', 'yara', 'omar', 'layla', 'atlas', 'nova', 'pip') then exists (select 1 from public.hunt_cards h where h.user_id = uid and h.card = slug)
    when slug in ('sprocket', 'kit', 'vex', 'bulwark', 'echo', 'aurora', 'cortex', 'titan') then exists (select 1 from public.style_owned o where o.user_id = uid and o.item = 'mech:' || slug)
    else false
  end;
$$;
revoke all on function public.avatar_open(uuid, text) from public, anon, authenticated;

create or replace function public.avatar_check() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.avatar is distinct from old.avatar and not public.avatar_open(new.id, new.avatar) then
    raise exception 'character not owned';
  end if;
  return new;
end $$;

create or replace function public.set_avatar(slug text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  if slug not in ('yazan', 'yara', 'omar', 'layla', 'atlas', 'nova', 'bolt', 'iris', 'pip', 'sprocket', 'kit', 'vex', 'bulwark', 'echo', 'aurora', 'cortex', 'titan') then
    return jsonb_build_object('ok', false, 'why', 'unknown');
  end if;
  if not public.avatar_open(uid, slug) then return jsonb_build_object('ok', false, 'why', 'not owned'); end if;
  update public.profiles set avatar = slug, updated_at = now() where id = uid;
  return jsonb_build_object('ok', true);
end $$;
