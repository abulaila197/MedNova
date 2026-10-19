-- A host deleting their account no longer deletes the room (and with it every other player's matches, results and
-- room talk). rooms.host now goes to NULL on delete, and a trigger passes the room on at once, the way leave_room
-- does: the first seated player (then the first spectator) becomes host and is marked ready; with nobody left the
-- room closes. So the app only ever sees a NULL host on a closed room.
alter table public.rooms alter column host drop not null;
alter table public.rooms drop constraint rooms_host_fkey;
alter table public.rooms add constraint rooms_host_fkey foreign key (host) references public.profiles(id) on delete set null;

create or replace function public.rooms_rehost()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare nxt uuid;
begin
  -- The leaving host's own room_players row may not be gone yet inside the same delete, so skip it by id.
  select user_id into nxt from public.room_players
    where room_id = new.id and state = 'in' and user_id <> old.host order by joined_at limit 1;
  if nxt is null then
    select user_id into nxt from public.room_players
      where room_id = new.id and state = 'spectator' and user_id <> old.host order by joined_at limit 1;
  end if;
  if nxt is null then
    new.status := 'closed';
  else
    new.host := nxt;
    update public.room_players set ready = true where room_id = new.id and user_id = nxt;
  end if;
  new.updated_at := now();
  return new;
end $$;

revoke all on function public.rooms_rehost() from public, anon, authenticated;

drop trigger if exists rooms_rehost on public.rooms;
create trigger rooms_rehost
  before update of host on public.rooms
  for each row
  when (old.host is not null and new.host is null)
  execute function public.rooms_rehost();
