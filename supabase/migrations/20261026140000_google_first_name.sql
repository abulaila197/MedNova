-- Google sign-in (Yazan 2026-10-26): a first Google sign-in has no username, so handle_new_user gives it the
-- default doc_ name. pick_first_name sets the real one once, for free, while the name is still that default.
-- Same checks as change_name (shape, bad words, taken, not like a friend code).
create or replace function public.pick_first_name(name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n text := trim(name);
begin
  if uid is null or coalesce((select is_anonymous from auth.users where id = uid), false) then
    return jsonb_build_object('ok', false, 'why', 'guest');
  end if;
  if not exists (select 1 from public.profiles
                  where id = uid and username = ('doc_' || substr(replace(uid::text, '-', ''), 1, 10))::extensions.citext) then
    return jsonb_build_object('ok', false, 'why', 'done');
  end if;
  if n !~ '^[A-Za-z0-9_]{3,16}$' then return jsonb_build_object('ok', false, 'why', 'shape'); end if;
  if not public.name_is_clean(n) then return jsonb_build_object('ok', false, 'why', 'bad'); end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || uid::text));
  if exists (select 1 from public.profiles where friend_code = upper(n))
     or exists (select 1 from public.profiles p join auth.users u on u.id = p.id
                 where p.username = n::extensions.citext and p.id <> uid
                   and (u.confirmed_at is not null or coalesce(u.is_anonymous, false))) then
    return jsonb_build_object('ok', false, 'why', 'taken');
  end if;
  -- Free the name from a sign-up that never confirmed its email (same as handle_new_user).
  update public.profiles p set username = 'doc_' || substr(replace(p.id::text, '-', ''), 1, 10)
   where p.username = n::extensions.citext and p.id <> uid;
  update public.profiles set username = n, display_name = n, updated_at = now() where id = uid;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.pick_first_name(text) from anon, public;
grant execute on function public.pick_first_name(text) to authenticated;
