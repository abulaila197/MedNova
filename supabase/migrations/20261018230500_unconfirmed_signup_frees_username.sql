-- S9: auth.signUp creates the auth user (and, through handle_new_user, the profile with its username)
-- before the email code is entered. A sign-up that is never confirmed (mistyped email, abandoned) kept
-- the username forever, so the real sign-up said "That username is taken".
-- Now a username held only by a never-confirmed sign-up counts as free, and the next sign-up that picks
-- it takes it over; the unconfirmed profile falls back to its 'doc_<id>' name. First to confirm keeps it.
-- Nothing changes while "Confirm email" is off (auto-confirmed users have confirmed_at set at once),
-- for OAuth users (confirmed by the provider) or for anonymous users (never hold a chosen name).
create or replace function public.username_available(name text)
returns boolean language sql stable security definer set search_path to '' as $function$
  select name ~ '^[A-Za-z0-9_]{3,16}$' and public.name_is_clean(name)
     and not exists (
       select 1 from public.profiles p join auth.users u on u.id = p.id
        where p.username = name::extensions.citext
          and (u.confirmed_at is not null or coalesce(u.is_anonymous, false)));
$function$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare wanted text := new.raw_user_meta_data->>'username';
begin
  if wanted is not null then
    -- Free the name from a sign-up that never confirmed its email.
    update public.profiles p set username = 'doc_' || substr(replace(p.id::text, '-', ''), 1, 10)
     where p.username = wanted::extensions.citext and p.id <> new.id
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
end $function$;
