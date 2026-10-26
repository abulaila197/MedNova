-- Monthly leaderboard prizes (#73, Yazan 2026-10-25). When a month ends, its Everyone boards are frozen once into
-- lb_awards: the All games board pays 500 / 300 / 150 to places 1-3 and 50 to places 4-10, and every game's own
-- board pays 100 to each of its top 3. Ties go to whoever reached the EXP first (#79), as on the live board.
-- Nothing runs on a timer: the first lb_claim of the new month freezes it, and each player's lb_claim pays their own.

create table if not exists public.lb_awards (
  month date not null,
  board text not null, -- 'all' or a game key
  rank int not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  exp int not null,
  tokens int not null,
  primary key (month, board, rank)
);
alter table public.lb_awards enable row level security;
drop policy if exists "own awards" on public.lb_awards;
create policy "own awards" on public.lb_awards for select to authenticated using (user_id = auth.uid());

-- Freezes month `m` (its first day) once; later calls do nothing.
create or replace function public.lb_settle(m date)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare t0 timestamptz := m::timestamp at time zone 'UTC'; t1 timestamptz := (m + interval '1 month')::timestamp at time zone 'UTC';
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

-- Freezes last month if needed and pays the caller's unpaid awards. Returns what was paid now.
create or replace function public.lb_claim()
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare uid uuid := auth.uid(); a record; got jsonb := '[]'::jsonb;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform public.lb_settle((date_trunc('month', now() at time zone 'UTC') - interval '1 month')::date);
  perform pg_advisory_xact_lock(hashtext('lb_claim:' || uid::text));
  for a in select * from public.lb_awards l where l.user_id = uid
      and not exists (select 1 from public.wallet_ledger w where w.user_id = uid and w.reason = 'lb:' || l.month || ':' || l.board)
      order by l.month, l.board loop
    perform public.pay_free(uid, 'grant', a.tokens, 'lb:' || a.month || ':' || a.board, 'Leaderboard prize');
    got := got || jsonb_build_object('month', a.month, 'board', a.board, 'rank', a.rank, 'tokens', a.tokens);
  end loop;
  return jsonb_build_object('ok', true, 'paid', got);
end $function$;

revoke all on function public.lb_settle(date), public.lb_claim() from public, anon, authenticated;
grant execute on function public.lb_claim() to authenticated;
