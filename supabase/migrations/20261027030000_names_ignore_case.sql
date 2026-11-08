-- Name checks ignore capitals again (Yazan 2026-10-27, "couldn't reach the server" when changing name).
-- With search_path '' the citext "=" is not found, so "p.username = n::extensions.citext" fell back to a
-- case-sensitive text compare: "yazan" passed the taken check while "Yazan" existed, and the unique index
-- (which does ignore capitals) then failed the update. operator(extensions.=) picks citext's own compare.

create or replace function public.username_available(name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select name ~ '^[A-Za-z0-9_]{3,16}$' and public.name_is_clean(name)
     and not exists (select 1 from public.profiles where friend_code = upper(name))
     and not exists (
       select 1 from public.profiles p join auth.users u on u.id = p.id
        where p.username operator(extensions.=) name::extensions.citext
          and (u.confirmed_at is not null or coalesce(u.is_anonymous, false)));
$$;

create or replace function public.new_friend_code() returns text
language plpgsql set search_path = '' as $$
declare c text; alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from public.profiles where friend_code = c or username operator(extensions.=) c::extensions.citext);
  end loop;
  return c;
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare wanted text := new.raw_user_meta_data->>'username';
begin
  if wanted is not null then
    -- Free the name from a sign-up that never confirmed its email.
    update public.profiles p set username = 'doc_' || substr(replace(p.id::text, '-', ''), 1, 10)
     where p.username operator(extensions.=) wanted::extensions.citext and p.id <> new.id
       and exists (select 1 from auth.users u where u.id = p.id and u.confirmed_at is null and not coalesce(u.is_anonymous, false));
  end if;
  insert into public.profiles (id, username, display_name, friend_code)
  values (
    new.id,
    coalesce(wanted, 'doc_' || substr(replace(new.id::text, '-', ''), 1, 10)),
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), wanted, 'Doctor'),
    public.new_friend_code()
  );
  return new;
end $$;

create or replace function public.pick_first_name(name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n text := trim(name);
begin
  if uid is null or coalesce((select is_anonymous from auth.users where id = uid), false) then
    return jsonb_build_object('ok', false, 'why', 'guest');
  end if;
  if not exists (select 1 from public.profiles
                  where id = uid and username operator(extensions.=) ('doc_' || substr(replace(uid::text, '-', ''), 1, 10))::extensions.citext) then
    return jsonb_build_object('ok', false, 'why', 'done');
  end if;
  if n !~ '^[A-Za-z0-9_]{3,16}$' then return jsonb_build_object('ok', false, 'why', 'shape'); end if;
  if not public.name_is_clean(n) then return jsonb_build_object('ok', false, 'why', 'bad'); end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || uid::text));
  if exists (select 1 from public.profiles where friend_code = upper(n))
     or exists (select 1 from public.profiles p join auth.users u on u.id = p.id
                 where p.username operator(extensions.=) n::extensions.citext and p.id <> uid
                   and (u.confirmed_at is not null or coalesce(u.is_anonymous, false))) then
    return jsonb_build_object('ok', false, 'why', 'taken');
  end if;
  -- Free the name from a sign-up that never confirmed its email (same as handle_new_user).
  update public.profiles p set username = 'doc_' || substr(replace(p.id::text, '-', ''), 1, 10)
   where p.username operator(extensions.=) n::extensions.citext and p.id <> uid;
  update public.profiles set username = n, display_name = n, updated_at = now() where id = uid;
  return jsonb_build_object('ok', true);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'why', 'taken');
end $$;

create or replace function public.change_name(name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n text := trim(name); cost int; bal int;
begin
  if uid is null or coalesce((select is_anonymous from auth.users where id = uid), false) then
    return jsonb_build_object('ok', false, 'why', 'guest');
  end if;
  if n !~ '^[A-Za-z0-9_]{3,16}$' then return jsonb_build_object('ok', false, 'why', 'shape'); end if;
  if not public.name_is_clean(n) then return jsonb_build_object('ok', false, 'why', 'bad'); end if;
  if exists (select 1 from public.profiles where id = uid and username::text = n and display_name = n) then
    return jsonb_build_object('ok', false, 'why', 'same');
  end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || uid::text));
  if exists (select 1 from public.profiles where friend_code = upper(n))
     or exists (select 1 from public.profiles p join auth.users u on u.id = p.id
                 where p.username operator(extensions.=) n::extensions.citext and p.id <> uid
                   and (u.confirmed_at is not null or coalesce(u.is_anonymous, false))) then
    return jsonb_build_object('ok', false, 'why', 'taken');
  end if;
  cost := public.name_change_cost(uid);
  bal := (public.wallet_balance(uid)->>'tokens')::int;
  if bal < cost then return jsonb_build_object('ok', false, 'why', 'tokens', 'need', cost - bal); end if;
  -- Free the name from a sign-up that never confirmed its email (same as handle_new_user).
  update public.profiles p set username = 'doc_' || substr(replace(p.id::text, '-', ''), 1, 10)
   where p.username operator(extensions.=) n::extensions.citext and p.id <> uid;
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, note, at)
  values ('s' || replace(gen_random_uuid()::text, '-', ''), uid, 'spend', 0, -cost, 'rename:' || n, null, now());
  update public.profiles set username = n, display_name = n, updated_at = now() where id = uid;
  return jsonb_build_object('ok', true, 'cost', cost, 'next', cost * 2);
exception when unique_violation then
  -- Safety net: never "couldn't reach the server" for a taken name. The spend above rolls back with it.
  return jsonb_build_object('ok', false, 'why', 'taken');
end $$;
