-- 2026-11-22 (Yazan): achievements pay Sparks, newer games earn EXP, monthly boards on Cairo months.

-- 1) Achievements pay Sparks too: 10 / 20 / 30 / 60 by tier, the same for every achievement ("Get to Know MedNova": 10).
alter table public.sparks_log drop constraint sparks_log_kind_check;
alter table public.sparks_log add constraint sparks_log_kind_check check (kind = any (array['spend', 'ad', 'buy', 'grant', 'daily', 'achievement']));

create or replace function public.achievement_sparks(key text, tier integer)
 returns integer language sql immutable set search_path to '' as $function$
  select case when key = 'app_tour' then 10 else (array[10, 20, 30, 60])[tier] end
$function$;

create or replace function public.achievement_collect(key text, tier integer, steps text[] default null::text[])
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  uid uuid := auth.uid();
  goal int := public.achievement_goal(key, tier);
  have bigint;
  tok int := public.achievement_tokens(key, tier);
  spk int := coalesce(public.achievement_sparks(key, tier), 0);
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
    when 'full_rotation' then (select min(coalesce(c, 0)) from unnest(public.rotation_games()) g(game)
      left join (select p.game, count(*) c from public.plays p where p.user_id = uid and p.status = 'finished'
                   and not coalesce(p.settings ? 'custom', false) group by p.game) x on x.game = g.game)
    when 'week_on_call' then (select count(*) from public.wallet_ledger where user_id = uid and kind = 'daily')
    when 'residency' then (select count(*) from public.wallet_ledger where user_id = uid and kind = 'daily')
    when 'career' then (public.wallet_balance(uid)->>'level')::int
    when 'recruiter' then (select count(*) from public.referrals where inviter = uid)
    when 'case_writer' then (select count(*) from public.custom_cases where user_id = uid)
    when 'challenger' then (select count(*) from public.friend_challenges where from_user = uid)
    when 'ad_watcher' then (select count(*) from public.ad_views where user_id = uid)
    when 'grand_rounds' then (select count(*) from public.wallet_ledger where user_id = uid and kind = 'rounds')
    when 'frame_collector' then (select count(*) from public.style_owned where user_id = uid and item like 'frame:%')
    when 'title_collector' then (select count(*) from public.style_owned where user_id = uid and item like 'title:%')
    when 'app_tour' then case when steps @> public.tour_steps() then 1 else 0 end
    else goal
  end;
  if have < goal then return jsonb_build_object('ok', false, 'why', 'not yet'); end if;
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, at)
  values ('a' || replace(gen_random_uuid()::text, '-', ''), uid, 'achievement', 0, tok, 'ach:' || key || ':' || tier, now());
  if spk > 0 then perform public.sparks_add(uid, spk, 'achievement', 'ach:' || key || ':' || tier); end if;
  return jsonb_build_object('ok', true, 'tokens', tok, 'sparks', spk);
end $function$;

-- 2) Newer games earn EXP on the server (they had none, so they never reached the boards). Same caps as the app.
--    From now on only: past plays are not counted again (Yazan 2026-11-22).
create or replace function public.wallet_exp_cap(game text, mode text, settings jsonb)
 returns integer language sql immutable set search_path to '' as $function$
  select case
    when mode = 'offline' then 0
    when game = 'case-files-unsolved' then case when mode = 'bots' then 100 * public.race_count(settings) when mode = 'online' then 60 * public.race_count(settings) else 60 end
    when game = 'the-conqueror' then case when mode = 'online' then 400 else 0 end
    when game = 'nova-crossword' then case when mode in ('online', 'bots') then 12 * public.race_count(settings) else 31 * 12 end
    when game = 'the-diagnostic-pursuit' then 12 * least(10, greatest(1, coalesce((settings->>'cases')::int, 5)))
    when game = 'nova-medicordle' then case
      when mode in ('online', 'bots') then 12 * least(10, greatest(1, coalesce((settings->>'words')::int, 5)))
      when settings->>'word' = 'daily' then 24
      when settings->>'word' = 'endless' then 1800
      else 0 end
    when game = 'the-riddler' then case when mode in ('online', 'bots') then 12 * least(10, greatest(1, coalesce((settings->>'photos')::int, 5))) else 86 * 12 end
    when game = 'the-silent-artist' then case when mode = 'online' then 60 else 0 end
    when game = 'the-streak-master' then 60
    when game = 'the-quiz-parade' then 60
    when game = 'imposter' then 60
    when game = 'code-clinic' then 60
    when game = 'nova-password' then 60
    when game = 'trust-me-not' then 250
    when game = 'the-wheels-of-chaos' then (least(100, greatest(25, coalesce((settings->>'target')::int, 50))) + case when mode in ('online', 'bots') then 38 else 9 end) / 2
    -- Four of a Kind: up to 8 a board. Spot the Flaw: 6 a case. Trace the Treatment: 4 a case.
    -- Who am I?: 12 a case (120 points / 10). Put it in order: 12 a question (120 points / 10).
    when game = 'four-of-a-kind' then 8 * least(5, greatest(1, coalesce((settings->>'boards')::int, 3)))
    when game = 'spot-the-flaw' then 6 * least(5, greatest(1, coalesce((settings->>'cases')::int, 3)))
    when game = 'trace-the-treatment' then 4 * least(5, greatest(1, coalesce((settings->>'cases')::int, 3)))
    when game = 'who-am-i' then 12 * least(10, greatest(1, coalesce((settings->>'cases')::int, 5)))
    when game = 'put-in-order' then 12 * least(10, greatest(1, coalesce((settings->>'cases')::int, 5)))
    else 0 end;
$function$;

-- 3) Monthly boards and prizes run on whole calendar months in Cairo time (they started at 2 AM Cairo, UTC).
--    The week board is unchanged. Months already given out stay as they were.
create or replace function public.leaderboard(period text default 'week'::text, scope text default 'everyone'::text, game text default null::text)
 returns jsonb language sql stable security definer set search_path to '' as $function$
  with me as (select auth.uid() as uid),
  since as (
    select case leaderboard.period
      when 'week' then date_trunc('week', now() + interval '2 days') - interval '2 days'
      when 'month' then date_trunc('month', now() at time zone 'Africa/Cairo') at time zone 'Africa/Cairo'
      else '-infinity'::timestamptz end as t
  ),
  pool as (
    select p.id from public.profiles p, me
    where leaderboard.scope <> 'friends' or p.id = me.uid or exists (
      select 1 from public.friendships f
      where f.status = 'accepted' and ((f.user_a = me.uid and f.user_b = p.id) or (f.user_b = me.uid and f.user_a = p.id)))
  ),
  earned as (
    select w.user_id, sum(w.exp)::int as exp, max(w.at) as reached
    from public.wallet_ledger w
    join pool on pool.id = w.user_id and not exists (select 1 from public.bans bn where bn.user_id = w.user_id)
    left join public.plays pl on pl.id = w.play_id
    where w.kind = 'exp' and w.at >= (select t from since)
      and (leaderboard.game is null or pl.game = leaderboard.game)
    group by w.user_id
    having sum(w.exp) > 0
  ),
  ranked as (
    select e.user_id, e.exp, row_number() over (order by e.exp desc, e.reached asc) as rank
    from earned e
  ),
  rows as (
    select r.rank, r.user_id, r.exp, coalesce(nullif(pr.display_name, ''), pr.username::text, 'Player') as name, pr.avatar,
           public.wallet_level(coalesce((select sum(w.exp) from public.wallet_ledger w where w.user_id = r.user_id and w.kind = 'exp'), 0)) as level
    from ranked r join public.profiles pr on pr.id = r.user_id
  ),
  mine as (select * from rows, me where rows.user_id = me.uid)
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object('rank', rank, 'id', user_id, 'name', name, 'level', level, 'exp', exp, 'avatar', avatar) order by rank) from rows where rank <= 50), '[]'::jsonb),
    'me', (select jsonb_build_object('rank', m.rank, 'exp', m.exp,
             'above', (select jsonb_build_object('name', a.name, 'gap', a.exp - m.exp + 1) from rows a where a.rank = m.rank - 1))
           from mine m)
  );
$function$;

create or replace function public.lb_settle(m date)
 returns void language plpgsql security definer set search_path to '' as $function$
declare t0 timestamptz := m::timestamp at time zone 'Africa/Cairo'; t1 timestamptz := (m + interval '1 month')::timestamp at time zone 'Africa/Cairo';
begin
  if m < date '2026-10-01' or t1 > now() then return; end if;
  perform pg_advisory_xact_lock(hashtext('lb_settle:' || m::text));
  if exists (select 1 from public.lb_awards where month = m) then return; end if;
  insert into public.lb_awards (month, board, rank, user_id, exp, tokens)
  select m, b.board, b.rank, b.user_id, b.exp,
    case when b.board = 'all' then (array[500, 300, 150, 50, 50, 50, 50, 50, 50, 50])[b.rank] else 100 end
  from (
    select board, user_id, exp, row_number() over (partition by board order by exp desc, reached asc) as rank
    from (
      select 'all' as board, w.user_id, sum(w.exp)::int as exp, max(w.at) as reached
      from public.wallet_ledger w
      where w.kind = 'exp' and w.at >= t0 and w.at < t1
      group by w.user_id having sum(w.exp) > 0
      union all
      select pl.game, w.user_id, sum(w.exp)::int, max(w.at)
      from public.wallet_ledger w join public.plays pl on pl.id = w.play_id
      where w.kind = 'exp' and w.at >= t0 and w.at < t1
      group by pl.game, w.user_id having sum(w.exp) > 0
    ) e
  ) b
  where (b.board = 'all' and b.rank <= 10) or (b.board <> 'all' and b.rank <= 3);
end $function$;

create or replace function public.lb_claim()
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare uid uuid := auth.uid(); a record; got jsonb := '[]'::jsonb;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform public.lb_settle((date_trunc('month', now() at time zone 'Africa/Cairo') - interval '1 month')::date);
  perform pg_advisory_xact_lock(hashtext('lb_claim:' || uid::text));
  for a in select * from public.lb_awards l where l.user_id = uid
      and not exists (select 1 from public.wallet_ledger w where w.user_id = uid and w.reason = 'lb:' || l.month || ':' || l.board)
      order by l.month, l.board loop
    perform public.pay_free(uid, 'grant', a.tokens, 'lb:' || a.month || ':' || a.board, 'Leaderboard prize');
    got := got || jsonb_build_object('month', a.month, 'board', a.board, 'rank', a.rank, 'tokens', a.tokens);
  end loop;
  return jsonb_build_object('ok', true, 'paid', got);
end $function$;
