-- Welcome gift + special inbox cards (Yazan 2026-11-18).
-- Group 5 (coupons) was dropped. Instead every NEW real account (not a guest) gets one inbox gift:
-- 50 tokens + 100 Sparks. A guest who turns into a real account gets it then. Existing players don't.
-- Welcome and character-unlock messages carry `special` so the app gives them their own card look.

alter table public.inbox_messages add column if not exists special text;
comment on column public.inbox_messages.special is 'welcome | character:<slug>: the app draws these cards with their own look';
create unique index if not exists inbox_messages_one_welcome on public.inbox_messages (target) where special = 'welcome';

-- Old unlock notes get the look too.
update public.inbox_messages
   set special = 'character:' || lower(split_part(title, ' ', 1))
 where special is null and created_by is not null and title like '% is unlocked'
   and body like 'A gift from the MedNova team: % is now yours. Wear it from your profile.';

create or replace function public.welcome_gift() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  if coalesce(new.is_anonymous, false) then return new; end if;
  if tg_op = 'UPDATE' and not coalesce(old.is_anonymous, false) then return new; end if;
  insert into public.inbox_messages (target, title, body, tokens, sparks, gift, special)
  values (new.id, 'Welcome to MedNova, Doctor!',
          'We''re glad you''re here. Here are 50 tokens and 100 Sparks to start your first games. Learn, play and have fun!',
          50, 100, true, 'welcome')
  on conflict do nothing;
  return new;
end $$;
revoke all on function public.welcome_gift() from public, anon, authenticated;

-- After handle_new_user (the profile must exist: inbox_for reads it). Trigger names fire in alphabetical order.
drop trigger if exists zz_welcome_gift on auth.users;
create trigger zz_welcome_gift after insert or update of is_anonymous on auth.users
  for each row execute function public.welcome_gift();

create or replace function public.admin_unlock_character(target uuid, slug text)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare nice text := initcap(slug);
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if not exists (select 1 from public.profiles where id = target) then raise exception 'no player'; end if;
  if public.avatar_open(target, slug) then return jsonb_build_object('ok', false, 'why', 'owned'); end if;
  if slug in ('yazan', 'yara', 'omar', 'layla', 'atlas', 'nova', 'pip') then
    insert into public.hunt_cards (user_id, card) values (target, slug) on conflict do nothing;
  elsif slug in ('sprocket', 'kit', 'vex', 'bulwark', 'echo', 'aurora', 'cortex', 'titan') then
    insert into public.style_owned (user_id, item, seen) values (target, 'mech:' || slug, false) on conflict do nothing;
  elsif slug in ('bloop', 'pixel', 'nimbus', 'ember', 'zenith', 'linky', 'sovereign') then
    insert into public.style_owned (user_id, item, seen) values (target, 'robot:' || slug, false) on conflict do nothing;
  elsif slug in ('mohamed', 'maged', 'dina', 'abdo', 'osama', 'sara') then
    insert into public.style_owned (user_id, item, seen) values (target, 'team:' || slug, false) on conflict do nothing;
  else
    return jsonb_build_object('ok', false, 'why', 'unknown');
  end if;
  insert into public.inbox_messages (target, title, body, gift, created_by, special)
  values (target, nice || ' is unlocked', 'A gift from the MedNova team: ' || nice || ' is now yours. Wear it from your profile.',
          true, auth.uid(), 'character:' || slug);
  return jsonb_build_object('ok', true);
end $function$;

create or replace function public.inbox_list() returns jsonb
language sql stable security definer set search_path to '' as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'title', m.title, 'body', m.body, 'tokens', m.tokens, 'sparks', m.sparks, 'chest', m.chest, 'chests', m.chests,
      'at', m.created_at, 'read', c.read_at is not null, 'collected', c.collected_at is not null,
      'item', m.item, 'challenge', m.challenge, 'special', m.special,
      'from', case when m.from_user is null then null else jsonb_build_object(
        'id', m.from_user,
        'name', coalesce((select coalesce(nullif(p.display_name, ''), p.username::text) from public.profiles p where p.id = m.from_user), 'A friend'),
        'avatar', (select p.avatar from public.profiles p where p.id = m.from_user)) end)
    order by m.created_at desc), '[]'::jsonb)
  from public.inbox_for(auth.uid()) m
  left join public.inbox_claims c on c.message_id = m.id and c.user_id = auth.uid()
  where c.cleared_at is null
$function$;
