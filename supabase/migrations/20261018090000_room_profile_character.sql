-- Rooms use your profile character (Yazan 2026-10-18): no lobby pick, duplicates allowed, robots included.
-- Character stickers follow it; other sticker packs are the non-character ones you own.
create or replace function public.room_player_character() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new."character" := coalesce((select pr.avatar from public.profiles pr where pr.id = new.user_id), 'yara');
  return new;
end $$;

create or replace trigger room_players_character before insert or update of "character" on public.room_players
  for each row execute function public.room_player_character();

-- Changing your profile character updates the rooms you are in.
create or replace function public.profile_avatar_rooms() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.room_players set "character" = new.avatar where user_id = new.id and state in ('in', 'spectator');
  return new;
end $$;

create or replace trigger profiles_avatar_rooms after update of avatar on public.profiles
  for each row when (old.avatar is distinct from new.avatar) execute function public.profile_avatar_rooms();

-- Character stickers: only your own character's; packs: only non-character packs you own.
create or replace function public.send_talk(r uuid, kind text, item text)
returns text language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); ch text;
begin
  if me is null then raise exception 'not signed in'; end if;
  select p."character" into ch from public.room_players p where p.room_id = r and p.user_id = me and p.state in ('in','spectator');
  if not found then return 'not_member'; end if;
  if kind = 'sticker' and item not like ch || '-%'
     and not exists (select 1 from public.style_owned o where o.user_id = me and o.item = 'pack:' || split_part(send_talk.item, '-', 1)) then
    return 'not_yours';
  end if;
  if exists (select 1 from public.room_messages m where m.room_id = r and m.user_id = me and m.created_at > now() - interval '3 seconds') then
    return 'cooldown';
  end if;
  insert into public.room_messages(room_id, user_id, kind, item) values (r, me, send_talk.kind, send_talk.item);
  return 'sent';
end $$;
