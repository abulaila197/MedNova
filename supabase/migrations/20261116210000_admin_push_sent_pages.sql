-- MedNova build 11 (2026-11-16). Paste NOW (before build 11): build 10 keeps working with it.
-- 1. Admin > Push notifications "sent" list: ten at a time, then ten more per tap. The app asks for how many it shows
--    (lim); build 10 asks with no number and still gets the last 10.
drop function if exists public.admin_push_sent();
create or replace function public.admin_push_sent(lim int default 10)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('kind', l.kind, 'title', l.title, 'body', l.body, 'phones', l.phones, 'at', l.at) order by l.at desc)
                   from (select * from public.admin_push_log order by at desc limit least(greatest(coalesce(lim, 10), 1), 500)) l), '[]');
end $function$;
revoke all on function public.admin_push_sent(int) from public, anon;
grant execute on function public.admin_push_sent(int) to authenticated, service_role;
