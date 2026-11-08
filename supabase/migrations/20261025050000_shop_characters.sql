-- Style shop characters, Linky, the Inviter set and the Admin set (Yazan 2026-10-25, list #31 #6 #77 #89 #46 #41 #8).
-- Characters are style items 'robot:<slug>': five sold for tokens, three special (Linky earned, Sovereign in a paid
-- package, Admin only on admin accounts).

create or replace function public.style_price(item text) returns int
language sql immutable set search_path = '' as $$
  select case item
    when 'frame:normal' then 0 when 'frame:bronze' then 60 when 'frame:silver' then 150 when 'frame:gold' then 350
    when 'frame:platinum' then 700 when 'frame:stethoscope' then 500 when 'frame:helix' then 800 when 'frame:neuron' then 850
    when 'frame:pulse' then 900 when 'frame:laurel' then 1000 when 'frame:aurora' then 1100 when 'frame:nova' then 1200
    when 'title:medical_student' then 0
    when 'title:intern' then 40 when 'title:night_owl' then 40 when 'title:coffee_powered' then 40
    when 'title:resident' then 100 when 'title:differential_hunter' then 100 when 'title:ward_whisperer' then 100
    when 'title:chief_resident' then 250 when 'title:the_diagnostician' then 250 when 'title:pager_legend' then 250
    when 'title:attending' then 500 when 'title:consultant' then 500 when 'title:riddle_master' then 500
    when 'title:head_of_department' then 1000 when 'title:professor' then 1000
    when 'effect:confetti' then 80 when 'effect:trophy' then 120 when 'effect:medal' then 150 when 'effect:pulse_wave' then 200
    when 'effect:too_easy' then 250 when 'effect:mic_drop' then 300 when 'effect:flatline' then 350 when 'effect:spotlight' then 400
    when 'pack:class' then 30 when 'pack:study' then 30 when 'pack:oncall' then 30
    when 'robot:bloop' then 700 when 'robot:pixel' then 700 when 'robot:nimbus' then 1000 when 'robot:ember' then 1000
    when 'robot:zenith' then 1500
  end
$$;

-- Earned items are worked out here, so they also reach players who qualified before this change:
-- Inviter set at 10 redeemed codes, Linky at 20 codes or every social follow, the Admin set on admin accounts.
create or replace function public.style_owned_all(uid uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  with refs as (select count(*) n from public.referrals where inviter = uid),
       social as (select count(distinct reason) n from public.wallet_ledger where user_id = uid
                  and reason in ('free:tiktok', 'free:instagram', 'free:facebook', 'free:youtube', 'free:channel')),
       adm as (select exists (select 1 from public.admin_emails a join auth.users u on lower(u.email) = lower(a.email) where u.id = uid) yes)
  select array(
    select 'frame:normal' union select 'title:medical_student'
    union select item from public.style_owned where user_id = uid
    union select 'title:p:' || split_part(reason, ':', 2) from public.wallet_ledger where user_id = uid and kind = 'achievement' and reason like 'ach:%:4'
    union select 'frame:rounds' where (select count(*) from public.wallet_ledger where user_id = uid and kind = 'rounds') >= 13
    union select unnest(array['frame:inviter', 'effect:friend_chain']) where (select n from refs) >= 10
    union select 'robot:linky' where (select n from refs) >= 20 or (select n from social) = 5
    union select unnest(array['robot:admin', 'frame:admin', 'title:the_admin']) where (select yes from adm)
  )
$$;
revoke all on function public.style_owned_all(uuid) from public, anon, authenticated;

-- Who may wear which character (replaces 20261025040000's version): shop and special robots once owned.
create or replace function public.avatar_open(uid uuid, slug text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when slug in ('bolt', 'iris') then true
    when slug in ('yazan', 'yara', 'omar', 'layla', 'atlas', 'nova', 'pip') then exists (select 1 from public.hunt_cards h where h.user_id = uid and h.card = slug)
    when slug in ('sprocket', 'kit', 'vex', 'bulwark', 'echo', 'aurora', 'cortex', 'titan') then exists (select 1 from public.style_owned o where o.user_id = uid and o.item = 'mech:' || slug)
    when slug in ('bloop', 'pixel', 'nimbus', 'ember', 'zenith', 'linky', 'sovereign', 'admin') then ('robot:' || slug) = any (public.style_owned_all(uid))
    else false
  end;
$$;
revoke all on function public.avatar_open(uuid, text) from public, anon, authenticated;

-- The Sovereign package ($10, paid through the stores): the revenuecat webhook calls this once per purchase.
create or replace function public.grant_sovereign(uid uuid, event_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.style_owned (user_id, item) values (uid, 'robot:sovereign'), (uid, 'frame:sovereign') on conflict do nothing;
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, at)
  values ('sov' || replace(event_id, '-', ''), uid, 'purchase', 0, 500, 'pack:sovereign_pack', now()) on conflict (id) do nothing;
end $$;
revoke all on function public.grant_sovereign(uuid, text) from public, anon, authenticated;
grant execute on function public.grant_sovereign(uuid, text) to service_role;

-- Wear a character (replaces 20261025040000's version, which knew only the Original pack and the Nova Mechs).
create or replace function public.set_avatar(slug text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  if slug not in ('yazan', 'yara', 'omar', 'layla', 'atlas', 'nova', 'bolt', 'iris', 'pip', 'sprocket', 'kit', 'vex', 'bulwark', 'echo', 'aurora', 'cortex', 'titan',
                  'bloop', 'pixel', 'nimbus', 'ember', 'zenith', 'linky', 'sovereign', 'admin') then
    return jsonb_build_object('ok', false, 'why', 'unknown');
  end if;
  if not public.avatar_open(uid, slug) then return jsonb_build_object('ok', false, 'why', 'not owned'); end if;
  update public.profiles set avatar = slug, updated_at = now() where id = uid;
  return jsonb_build_object('ok', true);
end $$;
