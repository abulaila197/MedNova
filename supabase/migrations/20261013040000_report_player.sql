-- Session 4 (Yazan 2026-10-13, look "Reason chips"): report a player from Friends or the online lobby.
-- Lands in the Admin reports list as kind 'Player' with the player and the reason as chips.
create or replace function public.report_player(target uuid, reason text, note text) returns uuid
language plpgsql security definer set search_path = public as $$
declare rid uuid; who record;
begin
  if auth.uid() is null then raise exception 'sign in'; end if;
  if target = auth.uid() then raise exception 'self'; end if;
  if reason not in ('Rude name', 'Abusive chat', 'Cheating', 'Other') then raise exception 'reason'; end if;
  if (select count(*) from public.reports r where r.user_id = auth.uid() and r.created_at > now() - interval '1 day') >= 30 then
    raise exception 'too many';
  end if;
  select p.username::text as username, p.display_name into who from public.profiles p where p.id = target;
  if not found then raise exception 'no player'; end if;
  insert into public.reports (user_id, kind, body, context)
  values (auth.uid(), 'Player', left(coalesce(note, ''), 500),
          jsonb_build_object('player_id', target, 'chips', jsonb_build_array('@' || who.username || ' (' || who.display_name || ')', reason)))
  returning id into rid;
  return rid;
end $$;
revoke execute on function public.report_player(uuid, text, text) from public, anon;
grant execute on function public.report_player(uuid, text, text) to authenticated;
