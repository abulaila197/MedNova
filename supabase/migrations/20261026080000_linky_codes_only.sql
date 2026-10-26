-- Linky only at 20 redeemed codes; the "follow all our pages" way is gone (Yazan 2026-10-26). Nobody had all 5 follows.
create or replace function public.style_owned_all(uid uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  with refs as (select count(*) n from public.referrals where inviter = uid),
       adm as (select exists (select 1 from public.admin_emails a join auth.users u on lower(u.email) = lower(a.email) where u.id = uid) yes)
  select array(
    select 'frame:normal' union select 'title:medical_student'
    union select item from public.style_owned where user_id = uid
    union select 'title:p:' || split_part(reason, ':', 2) from public.wallet_ledger where user_id = uid and kind = 'achievement' and reason like 'ach:%:4'
    union select 'frame:rounds' where (select count(*) from public.wallet_ledger where user_id = uid and kind = 'rounds') >= 13
    union select unnest(array['frame:inviter', 'effect:friend_chain']) where (select n from refs) >= 10
    union select 'robot:linky' where (select n from refs) >= 20
    union select unnest(array['robot:admin', 'frame:admin', 'title:the_admin']) where (select yes from adm)
  )
$$;
revoke all on function public.style_owned_all(uuid) from public, anon, authenticated;
