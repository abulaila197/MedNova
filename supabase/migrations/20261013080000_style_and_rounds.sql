-- Session 5 (Yazan 2026-10-13): Grand Rounds weekly goal, Style shop (frames, titles, win effects, reaction packs),
-- token spends (booster, second chance, name glow), Platinum tier and new achievements.
-- Every price lives here; the phone only asks. Purchases are 'spend' wallet rows written by the server.

alter table public.wallet_ledger drop constraint if exists wallet_ledger_kind_check;
alter table public.wallet_ledger add constraint wallet_ledger_kind_check
  check (kind = any (array['exp','spend','refund','convert','grant','daily','achievement','purchase','free','hunt','rounds']));

create or replace function public.wallet_balance(uid uuid default auth.uid()) returns jsonb
language sql stable security definer set search_path = '' as $$
  with s as (
    select coalesce(sum(exp) filter (where kind = 'exp'), 0) exp,
           coalesce(sum(tokens) filter (where kind not in ('exp','convert')), 0) other
    from public.wallet_ledger where user_id = uid
  )
  select jsonb_build_object('exp', exp, 'level', public.wallet_level(exp), 'tokens', public.wallet_level_tokens(public.wallet_level(exp)) + other)
  from s where uid = auth.uid() or public.is_admin();
$$;

-- ---------- Catalogue ----------
-- item = 'frame:<key>', 'title:<key>', 'effect:<key>', 'pack:<character>'. Null = not sold (earned only or unknown).
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
    when 'effect:confetti' then 80 when 'effect:pulse_wave' then 150 when 'effect:signed_off' then 200 when 'effect:supernova' then 300
    when 'pack:yazan' then 60 when 'pack:yara' then 60 when 'pack:omar' then 60 when 'pack:layla' then 60 when 'pack:atlas' then 60
    when 'pack:nova' then 60 when 'pack:bolt' then 60 when 'pack:iris' then 60 when 'pack:pip' then 60
  end
$$;

-- Weeks start Saturday 00:00 UTC (same as the leaderboard); week 0 is the week of 2026-10-10.
create or replace function public.week_index(at timestamptz default now()) returns int
language sql immutable set search_path = '' as $$
  select floor(extract(epoch from (at - timestamptz '2026-10-10 00:00:00+00')) / 604800)::int
$$;

-- This week's Style deal: one frame and one title at 30% off, each walking its own list.
create or replace function public.style_deal(w int default public.week_index()) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'frame', 'frame:' || (array['bronze','silver','gold','platinum','stethoscope','helix','neuron','pulse','laurel','aurora','nova'])[((w * 7) % 11 + 11) % 11 + 1],
    'title', 'title:' || (array['intern','night_owl','coffee_powered','resident','differential_hunter','ward_whisperer','chief_resident',
      'the_diagnostician','pager_legend','attending','consultant','riddle_master','head_of_department','professor'])[((w * 5) % 14 + 14) % 14 + 1],
    'off', 30)
$$;

create or replace function public.style_cost(item text) returns int
language sql stable set search_path = '' as $$
  select case when public.style_price(item) is null then null
    when item in ((public.style_deal()->>'frame'), (public.style_deal()->>'title')) then round(public.style_price(item) * 0.7)::int
    else public.style_price(item) end
$$;

-- ---------- Ownership ----------
create table if not exists public.style_owned (
  user_id uuid not null references auth.users (id) on delete cascade,
  item text not null,
  from_user uuid references auth.users (id) on delete set null,
  seen boolean not null default true,
  at timestamptz not null default now(),
  primary key (user_id, item)
);
alter table public.style_owned enable row level security;
create policy "style: read own" on public.style_owned for select to authenticated using (user_id = (select auth.uid()));

-- What each player wears. Written only through style_wear, which checks ownership.
create table if not exists public.style_worn (
  user_id uuid primary key references auth.users (id) on delete cascade,
  frame text not null default 'normal',
  title text not null default 'medical_student',
  effect text,
  glow_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.style_worn enable row level security;

-- Everything a player owns: free items, bought or gifted rows, and earned items
-- (Platinum titles = an achievement's Platinum tier; Grand Rounds frame = 13 weeks finished).
create or replace function public.style_owned_all(uid uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select array(
    select 'frame:normal' union select 'title:medical_student'
    union select item from public.style_owned where user_id = uid
    union select 'title:p:' || split_part(reason, ':', 2) from public.wallet_ledger where user_id = uid and kind = 'achievement' and reason like 'ach:%:4'
    union select 'frame:rounds' where (select count(*) from public.wallet_ledger where user_id = uid and kind = 'rounds') >= 13
  )
$$;
revoke all on function public.style_owned_all(uuid) from public, anon, authenticated;

-- The Style shop page: owned items, worn items, this week's deal, prices and unseen gifts.
create or replace function public.style_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'owned', to_jsonb(public.style_owned_all(auth.uid())),
    'worn', (select to_jsonb(w) - 'user_id' - 'updated_at' from public.style_worn w where w.user_id = auth.uid()),
    'deal', public.style_deal(),
    'deal_ends', (extract(epoch from (timestamptz '2026-10-10 00:00:00+00' + (public.week_index() + 1) * interval '7 days')) * 1000)::bigint,
    'gifts', coalesce((select jsonb_agg(jsonb_build_object('item', o.item, 'from', coalesce(nullif(p.display_name, ''), p.username::text)))
      from public.style_owned o left join public.profiles p on p.id = o.from_user where o.user_id = auth.uid() and not o.seen), '[]'::jsonb)
  ) where auth.uid() is not null
$$;

create or replace function public.style_gifts_seen() returns void
language sql security definer set search_path = '' as $$
  update public.style_owned set seen = true where user_id = auth.uid() and not seen;
$$;

-- Buy an item for yourself, or as a gift for a friend (they must not own it yet).
create or replace function public.style_buy(item text, gift_to uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); target uuid := coalesce(gift_to, auth.uid()); cost int := public.style_cost(item); bal int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if cost is null or cost = 0 then return jsonb_build_object('ok', false, 'why', 'not sold'); end if;
  if gift_to is not null and (gift_to = uid or not exists (select 1 from public.friendships f
      where f.status = 'accepted' and f.user_a = least(uid, gift_to) and f.user_b = greatest(uid, gift_to))) then
    return jsonb_build_object('ok', false, 'why', 'not friends');
  end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || uid::text));
  if item = any (public.style_owned_all(target)) then return jsonb_build_object('ok', false, 'why', 'owned'); end if;
  bal := (public.wallet_balance(uid)->>'tokens')::int;
  if bal < cost then return jsonb_build_object('ok', false, 'why', 'tokens', 'need', cost - bal); end if;
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, note, at)
  values ('s' || replace(gen_random_uuid()::text, '-', ''), uid, 'spend', 0, -cost,
          case when gift_to is null then 'style:' || item else 'gift:' || item || ':' || gift_to end, null, now());
  insert into public.style_owned (user_id, item, from_user, seen) values (target, item, case when gift_to is null then null else uid end, gift_to is null);
  return jsonb_build_object('ok', true, 'cost', cost);
end $$;

-- Put on a frame, title or win effect you own (effect null = none).
create or replace function public.style_wear(frame text default null, title text default null, effect text default null, clear_effect boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); own text[] := public.style_owned_all(auth.uid());
begin
  if uid is null then raise exception 'not signed in'; end if;
  if (frame is not null and not ('frame:' || frame) = any (own)) or (title is not null and not ('title:' || title) = any (own))
     or (effect is not null and not ('effect:' || effect) = any (own)) then
    return jsonb_build_object('ok', false, 'why', 'not owned');
  end if;
  insert into public.style_worn (user_id) values (uid) on conflict (user_id) do nothing;
  update public.style_worn w set frame = coalesce(style_wear.frame, w.frame), title = coalesce(style_wear.title, w.title),
    effect = case when clear_effect then null else coalesce(style_wear.effect, w.effect) end, updated_at = now()
  where w.user_id = uid;
  return jsonb_build_object('ok', true);
end $$;

-- Other players' looks, for faces, titles, win effects and leaderboard glow (anyone signed in may read these).
create or replace function public.style_of(ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(w.user_id, jsonb_build_object('frame', w.frame, 'title', w.title, 'effect', w.effect,
    'glow', w.glow_until is not null and w.glow_until > now())), '{}'::jsonb)
  from public.style_worn w where auth.uid() is not null and w.user_id = any (ids[1:200])
$$;

-- ---------- Other token spends ----------
-- what: 'glow' (50, leaderboard name glow for 7 days), 'second' (second chance in a Solo run, ref = the play id:
-- 5, then 10, then 20; at most 3 a run), 'booster' (24 for 10 plays of this game week's game, ref = that game).
create or replace function public.token_spend(what text, ref text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cost int; bal int; n int; wk int := public.week_index(); r jsonb;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || uid::text));
  if what = 'glow' then cost := 50;
  elsif what = 'second' then
    if coalesce(ref, '') = '' then return jsonb_build_object('ok', false, 'why', 'ref'); end if;
    select count(*) into n from public.wallet_ledger where user_id = uid and kind = 'spend' and reason = 'second:' || ref;
    if n >= 3 then return jsonb_build_object('ok', false, 'why', 'max'); end if;
    cost := (array[5, 10, 20])[n + 1];
  elsif what = 'booster' then
    r := public.rounds_week(wk);
    if r->>'kind' <> 'game' or r->>'game' <> ref then return jsonb_build_object('ok', false, 'why', 'not this week'); end if;
    cost := 24;
  else return jsonb_build_object('ok', false, 'why', 'unknown');
  end if;
  bal := (public.wallet_balance(uid)->>'tokens')::int;
  if bal < cost then return jsonb_build_object('ok', false, 'why', 'tokens', 'need', cost - bal); end if;
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, at)
  values ('s' || replace(gen_random_uuid()::text, '-', ''), uid, 'spend', 0, -cost,
          case what when 'glow' then 'glow:' || wk when 'second' then 'second:' || ref else 'booster:' || wk || ':' || ref end, now());
  if what = 'glow' then
    insert into public.style_worn (user_id) values (uid) on conflict (user_id) do nothing;
    update public.style_worn set glow_until = greatest(coalesce(glow_until, now()), now()) + interval '7 days' where user_id = uid;
  end if;
  return jsonb_build_object('ok', true, 'cost', cost, 'week', wk);
end $$;

-- ---------- Grand Rounds ----------
-- 13-week cycle: weeks 0-9 one game each (Games page order), then all Online, all Solo, all Pass the phone.
create or replace function public.rounds_week(w int) returns jsonb
language sql immutable set search_path = '' as $$
  select case when s < 10 then jsonb_build_object('kind', 'game', 'slot', s, 'game', (array['the-diagnostic-pursuit','the-silent-artist','trust-me-not',
      'the-wheels-of-chaos','the-riddler','the-conqueror','case-files-unsolved','nova-medicordle','the-streak-master','nova-crossword'])[s + 1])
    else jsonb_build_object('kind', 'mode', 'slot', s, 'mode', (array['online','solo','offline'])[s - 9]) end
  from (select ((w % 13) + 13) % 13 s) x
$$;

-- Parts of a week's goal. Game weeks: 45 finished games, 10 Solo + 20 Online + 15 Pass the phone
-- (online-only games: 45 Online). Mode weeks: 60 wins in that kind of mode.
create or replace function public.rounds_parts(wk jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case when wk->>'kind' = 'mode' then jsonb_build_array(jsonb_build_object('k', wk->>'mode', 'of', 60))
    when wk->>'game' in ('the-conqueror', 'trust-me-not') then jsonb_build_array(jsonb_build_object('k', 'online', 'of', 45))
    else jsonb_build_array(jsonb_build_object('k', 'solo', 'of', 10), jsonb_build_object('k', 'online', 'of', 20), jsonb_build_object('k', 'offline', 'of', 15)) end
$$;

-- A win: Online and Pass the phone = you (seat 0) placed first with others in the game; Solo = a finished game that scored.
create or replace function public.rounds_progress(uid uuid, w int) returns jsonb
language sql stable security definer set search_path = '' as $$
  with wk as (select public.rounds_week(w) j),
  fin as (
    select p.game, p.mode, p.score, p.standings from public.plays p
    where p.user_id = uid and p.status = 'finished' and not coalesce(p.settings ? 'custom', false)
      and p.ended_at >= timestamptz '2026-10-10 00:00:00+00' + w * interval '7 days'
      and p.ended_at < timestamptz '2026-10-10 00:00:00+00' + (w + 1) * interval '7 days'
  ),
  parts as (select e from wk, jsonb_array_elements(public.rounds_parts(wk.j)) e)
  select coalesce(jsonb_agg(jsonb_build_object('k', e->>'k', 'of', (e->>'of')::int, 'n', least((e->>'of')::int, (
    select count(*) from fin, wk where fin.mode = e->>'k' and case when wk.j->>'kind' = 'game' then fin.game = wk.j->>'game'
      else case when fin.mode = 'solo' then coalesce(fin.score, 0) > 0
        else jsonb_array_length(fin.standings) > 1 and fin.standings @> '[{"seat":0,"rank":1}]'::jsonb end end)::int))), '[]'::jsonb)
  from parts
$$;
revoke all on function public.rounds_progress(uuid, int) from public, anon, authenticated;

create or replace function public.rounds_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  with w as (select public.week_index() i)
  select jsonb_build_object(
    'week', w.i,
    'this', public.rounds_week(w.i),
    'next', public.rounds_week(w.i + 1),
    'ends', (extract(epoch from (timestamptz '2026-10-10 00:00:00+00' + (w.i + 1) * interval '7 days')) * 1000)::bigint,
    'prize', 30,
    'parts', case when auth.uid() is null then public.rounds_parts(public.rounds_week(w.i))
      else public.rounds_progress(auth.uid(), w.i) end,
    'claimed', exists (select 1 from public.wallet_ledger l where l.user_id = auth.uid() and l.kind = 'rounds' and l.reason = 'rounds:' || w.i),
    'stamps', coalesce((select jsonb_agg((substr(l.reason, 8))::int order by l.at) from public.wallet_ledger l where l.user_id = auth.uid() and l.kind = 'rounds'), '[]'::jsonb),
    'boosted', (select count(*) from public.wallet_ledger l where l.user_id = auth.uid() and l.kind = 'spend' and l.reason like 'booster:' || w.i || ':%')
  ) from w
$$;

-- Collect this week's prize (30 tokens + a stamp), once, when every part is full.
create or replace function public.rounds_claim() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); w int := public.week_index(); p jsonb;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('rounds:' || uid::text));
  if exists (select 1 from public.wallet_ledger where user_id = uid and kind = 'rounds' and reason = 'rounds:' || w) then
    return jsonb_build_object('ok', false, 'why', 'done');
  end if;
  p := public.rounds_progress(uid, w);
  if exists (select 1 from jsonb_array_elements(p) e where (e->>'n')::int < (e->>'of')::int) then
    return jsonb_build_object('ok', false, 'why', 'not yet');
  end if;
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, at)
  values ('r' || replace(gen_random_uuid()::text, '-', ''), uid, 'rounds', 0, 30, 'rounds:' || w, now());
  return jsonb_build_object('ok', true, 'tokens', 30);
end $$;

-- ---------- Achievements: Platinum tier (4) and new keys ----------
create or replace function public.achievement_goal(key text, tier int) returns int
language sql immutable set search_path = '' as $$
  select (case key
    when 'first_rounds' then array[1,50,250,600]
    when 'full_rotation' then array[1,5,20,50]
    when 'night_shift' then array[1,10,50,125]
    when 'clean_diagnosis' then array[1,10,50,125]
    when 'hot_streak' then array[10,20,35,60]
    when 'two_guess' then array[1,5,20,50]
    when 'riddle_me_this' then array[25,150,500,1200]
    when 'cold_case' then array[10,50,150,375]
    when 'full_marks' then array[10,20,31]
    when 'conqueror' then array[1,10,50,125]
    when 'most_trusted' then array[1,10,50,125]
    when 'team_player' then array[1,10,50,125]
    when 'house_call' then array[1,20,100,250]
    when 'pass_stethoscope' then array[10,50,200,500]
    when 'back_to_basics' then array[20,200,1000,2500]
    when 'dossier_reader' then array[50,200,511]
    when 'week_on_call' then array[7,30,100,250]
    when 'residency' then array[180,365,730,1095]
    when 'career' then array[10,25,50,100]
    when 'recruiter' then array[3,10,30,75]
    when 'case_writer' then array[5,10,20,50]
    when 'challenger' then array[10,20,30,75]
    when 'ad_watcher' then array[20,50,100,250]
    when 'grand_rounds' then array[1,5,13,26]
    when 'frame_collector' then array[1,4,8,11]
    when 'title_collector' then array[1,5,10,14]
    when 'app_tour' then array[1]
  end)[tier]
$$;

-- Bronze/Silver/Gold pay 1/3/5 (Case Writer 3/4/5, Commercial Break 5/10/20); Platinum pays the three added up.
-- "Get to know the app" is one step-set paying 5.
create or replace function public.achievement_tokens(key text, tier int) returns int
language sql immutable set search_path = '' as $$
  select case when key = 'app_tour' then 5 else
    (case key when 'case_writer' then array[3,4,5,12] when 'ad_watcher' then array[5,10,20,35] else array[1,3,5,9] end)[tier] end
$$;

-- New name: an extra argument on achievement_claim would make old 2-argument calls ambiguous, and DROP is not allowed here.
create or replace function public.achievement_collect(key text, tier int, steps text[] default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  goal int := public.achievement_goal(key, tier);
  have bigint;
  tok int := public.achievement_tokens(key, tier);
begin
  if uid is null then raise exception 'not signed in'; end if;
  if goal is null then return jsonb_build_object('ok', false, 'why', 'unknown'); end if;
  perform pg_advisory_xact_lock(hashtext('ach:' || uid::text));
  if exists (select 1 from public.wallet_ledger where user_id = uid and kind = 'achievement' and reason = 'ach:' || key || ':' || tier) then
    return jsonb_build_object('ok', false, 'why', 'done');
  end if;
  if tier > 1 and not exists (select 1 from public.wallet_ledger where user_id = uid and kind = 'achievement' and reason = 'ach:' || key || ':' || (tier - 1)) then
    return jsonb_build_object('ok', false, 'why', 'order');
  end if;
  have := case key
    when 'first_rounds' then (select count(*) from public.plays where user_id = uid and status = 'finished' and not coalesce(settings ? 'custom', false))
    when 'pass_stethoscope' then (select count(*) from public.plays where user_id = uid and status = 'finished' and mode = 'offline' and not coalesce(settings ? 'custom', false))
    when 'full_rotation' then (select case when count(*) < 10 then 0 else min(c) end from
      (select count(*) c from public.plays where user_id = uid and status = 'finished' and not coalesce(settings ? 'custom', false) group by game) g)
    when 'week_on_call' then (select count(*) from public.wallet_ledger where user_id = uid and kind = 'daily')
    when 'residency' then (select count(*) from public.wallet_ledger where user_id = uid and kind = 'daily')
    when 'career' then (public.wallet_balance(uid)->>'level')::int
    when 'recruiter' then (select count(*) from public.referrals where inviter = uid)
    when 'case_writer' then (select count(*) from public.custom_cases where user_id = uid)
    when 'challenger' then (select count(*) from public.invites where from_user = uid)
    when 'ad_watcher' then (select count(*) from public.ad_views where user_id = uid)
    when 'grand_rounds' then (select count(*) from public.wallet_ledger where user_id = uid and kind = 'rounds')
    when 'frame_collector' then (select count(*) from public.style_owned where user_id = uid and item like 'frame:%')
    when 'title_collector' then (select count(*) from public.style_owned where user_id = uid and item like 'title:%')
    -- The tour is visited on the phone; the claim must name every page.
    when 'app_tour' then case when steps @> array['learn','dossiers','mycases','community','profile','friends','leaderboard','achievements',
      'store','freetokens','settings','faq','about','contact','rounds'] then 1 else 0 end
    else goal
  end;
  if have < goal then return jsonb_build_object('ok', false, 'why', 'not yet'); end if;
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, at)
  values ('a' || replace(gen_random_uuid()::text, '-', ''), uid, 'achievement', 0, tok, 'ach:' || key || ':' || tier, now());
  return jsonb_build_object('ok', true, 'tokens', tok);
end $$;

-- Old phones keep working through the old name, with the new rules.
create or replace function public.achievement_claim(key text, tier int) returns jsonb
language sql security definer set search_path = '' as $$ select public.achievement_collect(key, tier, null) $$;

create or replace function public.social_counts() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'recruiter', (select count(*) from public.referrals where inviter = auth.uid()),
    'case_writer', (select count(*) from public.custom_cases where user_id = auth.uid()),
    'challenger', (select count(*) from public.invites where from_user = auth.uid()),
    'ad_watcher', (select count(*) from public.ad_views where user_id = auth.uid()),
    'grand_rounds', (select count(*) from public.wallet_ledger where user_id = auth.uid() and kind = 'rounds'),
    'frame_collector', (select count(*) from public.style_owned where user_id = auth.uid() and item like 'frame:%'),
    'title_collector', (select count(*) from public.style_owned where user_id = auth.uid() and item like 'title:%')
  ) where auth.uid() is not null;
$$;

revoke all on function public.style_status(), public.style_gifts_seen(), public.style_buy(text, uuid), public.style_wear(text, text, text, boolean),
  public.style_of(uuid[]), public.token_spend(text, text), public.rounds_status(), public.rounds_claim(),
  public.achievement_collect(text, int, text[]) from public, anon;
grant execute on function public.style_status(), public.style_gifts_seen(), public.style_buy(text, uuid), public.style_wear(text, text, text, boolean),
  public.style_of(uuid[]), public.token_spend(text, text), public.rounds_status(), public.rounds_claim(),
  public.achievement_collect(text, int, text[]) to authenticated;
-- Guests see the week too.
grant execute on function public.rounds_status() to anon;
