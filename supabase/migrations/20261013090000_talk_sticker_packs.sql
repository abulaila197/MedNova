-- Bought sticker packs (Yazan 2026-10-13): a player may send their room character's stickers, or any pack they own.
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
