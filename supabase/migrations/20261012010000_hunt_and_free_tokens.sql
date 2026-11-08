-- Session 3, card hunt + free tokens + friends page + custom cases + contact (decided with Yazan 2026-10-11/12).
-- Everything players send in is kept here AND listed on the Admin page; only the server pays tokens.

-- New wallet kinds: 'free' (one-time free ways, stories, feedback, invite codes, Ambassador, global mission)
-- and 'hunt' (the card collection prize).
alter table public.wallet_ledger drop constraint if exists wallet_ledger_kind_check;
alter table public.wallet_ledger add constraint wallet_ledger_kind_check
  check (kind = any (array['exp','spend','refund','convert','grant','daily','achievement','purchase','free','hunt']));

create or replace function public.wallet_balance(uid uuid default auth.uid()) returns jsonb
language sql stable security definer set search_path = public as $$
  with s as (
    select coalesce(sum(exp) filter (where kind = 'exp'), 0) exp,
           coalesce(sum(tokens) filter (where kind in ('spend','refund','grant','daily','achievement','purchase','free','hunt')), 0) other
    from public.wallet_ledger where user_id = uid
  )
  select jsonb_build_object('exp', exp, 'level', public.wallet_level(exp), 'tokens', public.wallet_level_tokens(public.wallet_level(exp)) + other)
  from s where uid = auth.uid() or public.is_admin();
$$;

-- One server-written wallet row (id prefix tells where it came from).
create or replace function public.pay_free(uid uuid, kind text, tokens int, reason text, note text default null) returns void
language sql security definer set search_path = public as $$
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, note, at)
  values ('f' || replace(gen_random_uuid()::text, '-', ''), uid, kind, 0, tokens, reason, note, now());
$$;
revoke all on function public.pay_free(uuid, text, int, text, text) from public, anon, authenticated;

-- ---------- One-time free ways (follow, visit) ----------
create or replace function public.free_amount(way text) returns int language sql immutable as $$
  select case way when 'tiktok' then 3 when 'instagram' then 3 when 'facebook' then 3 when 'youtube' then 3
                  when 'channel' then 3 when 'community' then 2 when 'listing' then 3 end
$$;

create or replace function public.free_claim(way text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n int := public.free_amount(way);
begin
  if uid is null then raise exception 'not signed in'; end if;
  if n is null then return jsonb_build_object('ok', false, 'why', 'unknown'); end if;
  perform pg_advisory_xact_lock(hashtext('free:' || uid::text));
  if exists (select 1 from public.wallet_ledger where user_id = uid and reason = 'free:' || way) then
    return jsonb_build_object('ok', false, 'why', 'done');
  end if;
  perform public.pay_free(uid, 'free', n, 'free:' || way);
  return jsonb_build_object('ok', true, 'tokens', n);
end $$;

-- ---------- Feedback (10 tokens the first time, at least 20 characters) ----------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  body text not null,
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;

create or replace function public.submit_feedback(body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); paid boolean;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if length(trim(coalesce(body, ''))) < 20 then return jsonb_build_object('ok', false, 'why', 'short'); end if;
  perform pg_advisory_xact_lock(hashtext('free:' || uid::text));
  if (select count(*) from public.feedback f where f.user_id = uid and f.created_at > now() - interval '1 day') >= 10 then
    return jsonb_build_object('ok', false, 'why', 'too many');
  end if;
  insert into public.feedback (user_id, body) values (uid, left(trim(body), 2000));
  paid := exists (select 1 from public.wallet_ledger where user_id = uid and reason = 'free:feedback');
  if not paid then perform public.pay_free(uid, 'free', 10, 'free:feedback'); end if;
  return jsonb_build_object('ok', true, 'tokens', case when paid then 0 else 10 end);
end $$;

-- ---------- Share your story (5 prompts, 5 tokens each on send) ----------
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  prompt int not null check (prompt between 0 and 4),
  body text not null,
  credit boolean not null default false,
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now(),
  unique (user_id, prompt)
);
alter table public.stories enable row level security;

create or replace function public.submit_story(prompt int, body text, credit boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  if prompt not between 0 and 4 then raise exception 'prompt'; end if;
  if length(trim(coalesce(body, ''))) < 20 then return jsonb_build_object('ok', false, 'why', 'short'); end if;
  perform pg_advisory_xact_lock(hashtext('free:' || uid::text));
  if exists (select 1 from public.stories s where s.user_id = uid and s.prompt = submit_story.prompt) then
    return jsonb_build_object('ok', false, 'why', 'done');
  end if;
  insert into public.stories (user_id, prompt, body, credit) values (uid, prompt, left(trim(body), 4000), coalesce(credit, false));
  perform public.pay_free(uid, 'free', 5, 'free:story:' || prompt);
  return jsonb_build_object('ok', true, 'tokens', 5);
end $$;

-- ---------- Ambassador video (50 tokens once Yazan approves it on Admin) ----------
create table if not exists public.ambassador_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  game_name text not null,
  video_url text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table public.ambassador_videos enable row level security;

create or replace function public.submit_ambassador(email text, game_name text, video_url text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  if position('@' in coalesce(email, '')) < 2 or length(trim(coalesce(game_name, ''))) < 2 or length(trim(coalesce(video_url, ''))) < 8 then
    return jsonb_build_object('ok', false, 'why', 'missing');
  end if;
  perform pg_advisory_xact_lock(hashtext('free:' || uid::text));
  if exists (select 1 from public.ambassador_videos a where a.user_id = uid and a.status in ('pending', 'approved')) then
    return jsonb_build_object('ok', false, 'why', 'done');
  end if;
  insert into public.ambassador_videos (user_id, email, game_name, video_url) values (uid, left(trim(email), 200), left(trim(game_name), 60), left(trim(video_url), 500));
  return jsonb_build_object('ok', true);
end $$;

-- ---------- Contact (saved here instead of opening email) ----------
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null,
  body text not null,
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;

create or replace function public.submit_contact(kind text, body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if length(trim(coalesce(body, ''))) < 2 then raise exception 'empty'; end if;
  if auth.uid() is not null and (select count(*) from public.contact_messages c where c.user_id = auth.uid() and c.created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many';
  end if;
  insert into public.contact_messages (user_id, kind, body) values (auth.uid(), left(coalesce(kind, 'General'), 40), left(trim(body), 3000)) returning id into rid;
  return rid;
end $$;

-- ---------- Custom cases (private until approved; then only the maker can play it) ----------
create table if not exists public.custom_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  diagnosis text not null,
  field text,
  gender text not null check (gender in ('Female', 'Male', 'Other')),
  age int not null check (age between 0 and 120),
  presentation text not null,
  history text not null default '',
  exam text not null default '',
  investigation text not null default '',
  findings text[] not null default '{}',
  status text not null default 'waiting' check (status in ('waiting', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table public.custom_cases enable row level security;
create policy "read own cases" on public.custom_cases for select to authenticated using (user_id = auth.uid());

create or replace function public.save_case(c jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); rid uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if length(trim(coalesce(c->>'diagnosis', ''))) < 2 or length(trim(coalesce(c->>'presentation', ''))) < 10 then raise exception 'missing'; end if;
  if (select count(*) from public.custom_cases x where x.user_id = uid and x.created_at > now() - interval '1 day') >= 20 then raise exception 'too many'; end if;
  insert into public.custom_cases (user_id, diagnosis, field, gender, age, presentation, history, exam, investigation, findings)
  values (uid, left(trim(c->>'diagnosis'), 120), nullif(left(trim(coalesce(c->>'field', '')), 40), ''), c->>'gender', (c->>'age')::int,
          left(trim(c->>'presentation'), 1500), left(trim(coalesce(c->>'history', '')), 600), left(trim(coalesce(c->>'exam', '')), 600),
          left(trim(coalesce(c->>'investigation', '')), 600),
          coalesce((select array_agg(left(trim(x), 300)) from jsonb_array_elements_text(coalesce(c->'findings', '[]'::jsonb)) x where trim(x) <> ''), '{}'))
  returning id into rid;
  return rid;
end $$;

-- ---------- Invite codes (each account redeems one code once; both get 10; inviter capped at 150) ----------
create table if not exists public.referrals (
  new_user uuid primary key references auth.users (id) on delete cascade,
  inviter uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.referrals enable row level security;

create or replace function public.redeem_code(code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); inv uuid; earned int; paid int := 0;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('ref:' || uid::text));
  if exists (select 1 from public.referrals where new_user = uid) then return jsonb_build_object('ok', false, 'why', 'done'); end if;
  select id into inv from public.profiles where friend_code = upper(trim(code));
  if inv is null then return jsonb_build_object('ok', false, 'why', 'not_found'); end if;
  if inv = uid then return jsonb_build_object('ok', false, 'why', 'self'); end if;
  if exists (select 1 from public.referrals where new_user = inv and inviter = uid) then return jsonb_build_object('ok', false, 'why', 'swap'); end if;
  insert into public.referrals (new_user, inviter) values (uid, inv);
  perform public.pay_free(uid, 'free', 10, 'ref:redeemed');
  perform pg_advisory_xact_lock(hashtext('ref:' || inv::text));
  select coalesce(sum(tokens), 0) into earned from public.wallet_ledger where user_id = inv and reason like 'ref:in:%';
  if earned < 150 then
    paid := least(10, 150 - earned);
    perform public.pay_free(inv, 'free', paid, 'ref:in:' || uid::text);
  end if;
  return jsonb_build_object('ok', true, 'tokens', 10);
end $$;

-- ---------- Player search + request by id (Friends page, game lobby) ----------
create or replace function public.find_players(q text)
returns table (id uuid, username text, display_name text, avatar text, level int, kind text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username::text, p.display_name, p.avatar,
         public.level_for_exp(coalesce((select sum(w.exp) from public.wallet_ledger w where w.user_id = p.id and w.kind = 'exp'), 0)::int),
         coalesce((select case when f.status = 'accepted' then 'friend' when f.requester = auth.uid() then 'outgoing' else 'incoming' end
                   from public.friendships f where f.user_a = least(auth.uid(), p.id) and f.user_b = greatest(auth.uid(), p.id) and f.status <> 'none'), 'none')
  from public.profiles p
  where auth.uid() is not null and length(trim(q)) >= 2 and p.id <> auth.uid()
    and (p.username::text ilike trim(both '@' from trim(q)) || '%' or p.display_name ilike '%' || trim(q) || '%')
    and not exists (select 1 from public.blocks b where b.active and ((b.blocker = auth.uid() and b.blocked = p.id) or (b.blocker = p.id and b.blocked = auth.uid())))
  order by (p.username::text ilike trim(both '@' from trim(q)) || '%') desc, p.last_seen desc nulls last
  limit 20;
$$;

create or replace function public.request_friend_id(other uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  select friend_code into c from public.profiles where id = other;
  if c is null then return 'not_found'; end if;
  return public.request_friend(c);
end $$;

-- ---------- Global mission (100k downloads on both stores = 200 tokens to everyone signed up before) ----------
create table if not exists public.app_stats (
  key text primary key,
  value bigint not null default 0,
  reached_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.app_stats enable row level security;
create policy "anyone reads stats" on public.app_stats for select to anon, authenticated using (true);
insert into public.app_stats (key, value) values ('downloads', 0) on conflict do nothing;

create or replace function public.admin_set_downloads(n bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  update public.app_stats set value = n, updated_at = now(),
    reached_at = coalesce(reached_at, case when n >= 100000 then now() end) where key = 'downloads';
end $$;

create or replace function public.global_claim() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r timestamptz;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select reached_at into r from public.app_stats where key = 'downloads';
  if r is null then return jsonb_build_object('ok', false, 'why', 'not yet'); end if;
  if (select created_at from public.profiles where id = uid) > r then return jsonb_build_object('ok', false, 'why', 'late'); end if;
  perform pg_advisory_xact_lock(hashtext('free:' || uid::text));
  if exists (select 1 from public.wallet_ledger where user_id = uid and reason = 'free:global') then return jsonb_build_object('ok', false, 'why', 'done'); end if;
  perform public.pay_free(uid, 'free', 200, 'free:global');
  return jsonb_build_object('ok', true, 'tokens', 200);
end $$;

-- Which free ways (and stories) this player already collected.
create or replace function public.free_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'done', coalesce((select jsonb_agg(distinct reason) from public.wallet_ledger where user_id = auth.uid() and kind = 'free'), '[]'::jsonb),
    'ambassador', (select status from public.ambassador_videos where user_id = auth.uid() order by created_at desc limit 1),
    'invites', (select count(*) from public.referrals where inviter = auth.uid()),
    'invite_tokens', coalesce((select sum(tokens) from public.wallet_ledger where user_id = auth.uid() and reason like 'ref:in:%'), 0),
    'redeemed', exists (select 1 from public.referrals where new_user = auth.uid()),
    'downloads', (select value from public.app_stats where key = 'downloads'),
    'goal', 100000
  );
$$;

-- ---------- The card hunt (9 cards, any order; the server checks each mission) ----------
create table if not exists public.hunt_cards (
  user_id uuid not null references auth.users (id) on delete cascade,
  card text not null check (card in ('bolt','iris','atlas','nova','pip','yara','yazan','layla','omar')),
  found_at timestamptz not null default now(),
  primary key (user_id, card)
);
alter table public.hunt_cards enable row level security;
create policy "read own cards" on public.hunt_cards for select to authenticated using (user_id = auth.uid());

-- How far each mission is (have / need), for one player.
create or replace function public.hunt_progress(uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with fin as (select game, mode, standings from public.plays where user_id = uid and status = 'finished'),
  days as (select (substr(reason, 5))::date d from public.wallet_ledger where user_id = uid and kind = 'daily' and reason like 'day:%'),
  runs as (select count(*) n from (select d, d - (row_number() over (order by d))::int g from (select distinct d from days) x) y group by g),
  multi as (select g, m from (values
      ('case-files-unsolved'),('nova-crossword'),('the-diagnostic-pursuit'),('nova-medicordle'),('the-riddler'),('the-silent-artist'),('the-streak-master'),('the-wheels-of-chaos')) a(g)
      cross join (values ('offline'),('online')) b(m)
    union all values ('the-conqueror','online'), ('trust-me-not','online')),
  solo as (select g from (values ('case-files-unsolved'),('nova-crossword'),('the-diagnostic-pursuit'),('nova-medicordle'),('the-riddler'),('the-silent-artist'),('the-streak-master'),('the-wheels-of-chaos')) a(g))
  select jsonb_build_object(
    'bolt', jsonb_build_array(1, 1),
    'iris', jsonb_build_array((select count(distinct game) from fin), 10),
    'atlas', jsonb_build_array(coalesce((select max(n) from runs), 0), 7),
    'nova', jsonb_build_array((select count(distinct reason) from public.wallet_ledger where user_id = uid and reason in
       ('free:tiktok','free:instagram','free:facebook','free:youtube','free:channel','free:community','free:listing','free:feedback',
        'free:story:0','free:story:1','free:story:2','free:story:3','free:story:4')), 13),
    'pip', jsonb_build_array((select count(*) from fin where mode = 'online'), 50),
    'yara', jsonb_build_array(coalesce((select count(*) from public.player_progress pp, jsonb_object_keys(coalesce(pp.value->'done', '{}'::jsonb))
       where pp.user_id = uid and pp.key = 'learn:review'), 0), 100),
    'yazan', jsonb_build_array((select count(*) from public.friendships where status = 'accepted' and uid in (user_a, user_b)), 10),
    'layla', jsonb_build_array(
       (select count(*) from multi where exists (select 1 from fin where fin.game = multi.g and fin.mode = multi.m
          and jsonb_array_length(fin.standings) > 1 and fin.standings @> '[{"seat":0,"rank":1}]'::jsonb))
     + (select count(*) from solo where exists (select 1 from fin where fin.game = solo.g and fin.mode = 'solo')), 26),
    'omar', jsonb_build_array((select count(*) from fin), 300)
  );
$$;
revoke all on function public.hunt_progress(uuid) from public, anon, authenticated;

-- Cards found, mission progress, and whether the prize is paid.
create or replace function public.hunt_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'found', coalesce((select jsonb_agg(card order by found_at) from public.hunt_cards where user_id = auth.uid()), '[]'::jsonb),
    'progress', public.hunt_progress(auth.uid()),
    'prize', exists (select 1 from public.wallet_ledger where user_id = auth.uid() and reason = 'hunt:prize')
  ) where auth.uid() is not null;
$$;

-- Adds every card whose mission is now met; returns the new ones.
create or replace function public.hunt_check() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p jsonb; k text; got jsonb := '[]'::jsonb;
begin
  if uid is null then raise exception 'not signed in'; end if;
  p := public.hunt_progress(uid);
  for k in select jsonb_object_keys(p) loop
    if (p->k->>0)::int >= (p->k->>1)::int and not exists (select 1 from public.hunt_cards where user_id = uid and card = k) then
      insert into public.hunt_cards (user_id, card) values (uid, k) on conflict do nothing;
      got := got || to_jsonb(k);
    end if;
  end loop;
  return jsonb_build_object('new', got);
end $$;

-- Omar's prize: 200 tokens, only once all nine cards are found.
create or replace function public.hunt_prize() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('hunt:' || uid::text));
  if (select count(*) from public.hunt_cards where user_id = uid) < 9 then return jsonb_build_object('ok', false, 'why', 'not yet'); end if;
  if exists (select 1 from public.wallet_ledger where user_id = uid and reason = 'hunt:prize') then return jsonb_build_object('ok', false, 'why', 'done'); end if;
  perform public.pay_free(uid, 'hunt', 200, 'hunt:prize');
  return jsonb_build_object('ok', true, 'tokens', 200);
end $$;

-- ---------- Admin: everything sent in, with Approve / Done ----------
create or replace function public.admin_inbox(what text, show text default 'open') returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if what = 'contact' then
    select coalesce(jsonb_agg(x order by x.created_at desc), '[]') into r from (
      select c.id, c.kind, c.body, c.status, c.created_at, p.username::text username from public.contact_messages c left join public.profiles p on p.id = c.user_id
      where show = 'all' or c.status = 'new' order by c.created_at desc limit 200) x;
  elsif what = 'feedback' then
    select coalesce(jsonb_agg(x order by x.created_at desc), '[]') into r from (
      select f.id, f.body, f.status, f.created_at, p.username::text username from public.feedback f left join public.profiles p on p.id = f.user_id
      where show = 'all' or f.status = 'new' order by f.created_at desc limit 200) x;
  elsif what = 'stories' then
    select coalesce(jsonb_agg(x order by x.created_at desc), '[]') into r from (
      select s.id, s.prompt, s.body, s.credit, s.status, s.created_at, p.username::text username, p.display_name from public.stories s left join public.profiles p on p.id = s.user_id
      where show = 'all' or s.status = 'new' order by s.created_at desc limit 200) x;
  elsif what = 'ambassador' then
    select coalesce(jsonb_agg(x order by x.created_at desc), '[]') into r from (
      select a.id, a.email, a.game_name, a.video_url, a.status, a.created_at, p.username::text username from public.ambassador_videos a left join public.profiles p on p.id = a.user_id
      where show = 'all' or a.status = 'pending' order by a.created_at desc limit 200) x;
  elsif what = 'cases' then
    select coalesce(jsonb_agg(x order by x.created_at desc), '[]') into r from (
      select c.*, p.username::text username from public.custom_cases c left join public.profiles p on p.id = c.user_id
      where show = 'all' or c.status = 'waiting' order by c.created_at desc limit 200) x;
  else raise exception 'what';
  end if;
  return r;
end $$;

-- Marks an item done, or approves / declines it. Approving an Ambassador video pays 50 once.
create or replace function public.admin_decide(what text, item uuid, ok boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v public.ambassador_videos;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if what = 'contact' then update public.contact_messages set status = case when ok then 'done' else 'new' end where id = item;
  elsif what = 'feedback' then update public.feedback set status = case when ok then 'done' else 'new' end where id = item;
  elsif what = 'stories' then update public.stories set status = case when ok then 'done' else 'new' end where id = item;
  elsif what = 'cases' then update public.custom_cases set status = case when ok then 'approved' else 'declined' end, decided_at = now() where id = item;
  elsif what = 'ambassador' then
    update public.ambassador_videos set status = case when ok then 'approved' else 'rejected' end, decided_at = now() where id = item returning * into v;
    if ok and v.user_id is not null and not exists (select 1 from public.wallet_ledger where user_id = v.user_id and reason = 'free:ambassador') then
      perform public.pay_free(v.user_id, 'free', 50, 'free:ambassador', 'Ambassador video approved');
    end if;
  else raise exception 'what';
  end if;
end $$;

-- ---------- New achievements (AC9): invites 3/10/30, custom cases 5/10/20 (pays 3/4/5), challenges 10/20/30 ----------
create or replace function public.achievement_goal(key text, tier int) returns int
language sql immutable as $$
  select (case key
    when 'first_rounds' then array[1,50,250]
    when 'full_rotation' then array[1,5,20]
    when 'night_shift' then array[1,10,50]
    when 'clean_diagnosis' then array[1,10,50]
    when 'hot_streak' then array[10,20,35]
    when 'two_guess' then array[1,5,20]
    when 'riddle_me_this' then array[25,150,500]
    when 'cold_case' then array[10,50,150]
    when 'full_marks' then array[10,20,31]
    when 'conqueror' then array[1,10,50]
    when 'most_trusted' then array[1,10,50]
    when 'team_player' then array[1,10,50]
    when 'house_call' then array[1,20,100]
    when 'pass_stethoscope' then array[10,50,200]
    when 'back_to_basics' then array[20,200,1000]
    when 'dossier_reader' then array[50,200,511]
    when 'week_on_call' then array[7,30,100]
    when 'residency' then array[180,365,730]
    when 'career' then array[10,25,50]
    when 'recruiter' then array[3,10,30]
    when 'case_writer' then array[5,10,20]
    when 'challenger' then array[10,20,30]
  end)[tier]
$$;

create or replace function public.achievement_claim(key text, tier int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  goal int := public.achievement_goal(key, tier);
  have bigint;
  tok int := case when key = 'case_writer' then (array[3,4,5])[tier] else (array[1,3,5])[tier] end;
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
    when 'first_rounds' then (select count(*) from public.plays where user_id = uid and status = 'finished')
    when 'pass_stethoscope' then (select count(*) from public.plays where user_id = uid and status = 'finished' and mode = 'offline')
    when 'full_rotation' then (select case when count(*) < 10 then 0 else min(c) end from
      (select count(*) c from public.plays where user_id = uid and status = 'finished' group by game) g)
    when 'week_on_call' then (select count(*) from public.wallet_ledger where user_id = uid and kind = 'daily')
    when 'residency' then (select count(*) from public.wallet_ledger where user_id = uid and kind = 'daily')
    when 'career' then (public.wallet_balance(uid)->>'level')::int
    when 'recruiter' then (select count(*) from public.referrals where inviter = uid)
    when 'case_writer' then (select count(*) from public.custom_cases where user_id = uid)
    when 'challenger' then (select count(*) from public.invites where from_user = uid)
    else goal
  end;
  if have < goal then return jsonb_build_object('ok', false, 'why', 'not yet'); end if;
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, at)
  values ('a' || replace(gen_random_uuid()::text, '-', ''), uid, 'achievement', 0, tok, 'ach:' || key || ':' || tier, now());
  return jsonb_build_object('ok', true, 'tokens', tok);
end $$;

-- Counts for the three new achievements (the phone can't count them itself).
create or replace function public.social_counts() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'recruiter', (select count(*) from public.referrals where inviter = auth.uid()),
    'case_writer', (select count(*) from public.custom_cases where user_id = auth.uid()),
    'challenger', (select count(*) from public.invites where from_user = auth.uid())
  ) where auth.uid() is not null;
$$;

-- ---------- Grants ----------
revoke all on function
  public.free_claim(text), public.free_status(), public.submit_feedback(text), public.submit_story(int, text, boolean),
  public.submit_ambassador(text, text, text), public.save_case(jsonb), public.redeem_code(text), public.find_players(text),
  public.request_friend_id(uuid), public.global_claim(), public.hunt_status(), public.hunt_check(), public.hunt_prize(),
  public.social_counts(), public.admin_inbox(text, text), public.admin_decide(text, uuid, boolean), public.admin_set_downloads(bigint),
  public.submit_contact(text, text)
from public, anon;
grant execute on function
  public.free_claim(text), public.free_status(), public.submit_feedback(text), public.submit_story(int, text, boolean),
  public.submit_ambassador(text, text, text), public.save_case(jsonb), public.redeem_code(text), public.find_players(text),
  public.request_friend_id(uuid), public.global_claim(), public.hunt_status(), public.hunt_check(), public.hunt_prize(),
  public.social_counts(), public.admin_inbox(text, text), public.admin_decide(text, uuid, boolean), public.admin_set_downloads(bigint),
  public.submit_contact(text, text)
to authenticated;
grant execute on function public.submit_contact(text, text) to anon;
