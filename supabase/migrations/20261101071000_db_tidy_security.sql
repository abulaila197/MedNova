-- Group 10 tidy-ups (Yazan 2026-11-01): Supabase checker's speed notes + guest access review.

-- 1. Indexes for the 8 foreign keys without one (faster deletes and lookups as tables grow).
create index if not exists inbox_claims_user_id_idx on public.inbox_claims (user_id);
create index if not exists inbox_messages_created_by_idx on public.inbox_messages (created_by);
create index if not exists inbox_messages_from_user_idx on public.inbox_messages (from_user);
create index if not exists lb_awards_user_id_idx on public.lb_awards (user_id);
create index if not exists likes_user_id_idx on public.likes (user_id);
create index if not exists watch_always_watcher_idx on public.watch_always (watcher);
create index if not exists watch_asks_room_id_idx on public.watch_asks (room_id);
create index if not exists watch_asks_watcher_idx on public.watch_asks (watcher);

-- 2. The 4 rules that worked out the signed-in user again for every row: now once per query. Same meaning.
alter policy "own sparks" on public.sparks_state using (user_id = (select auth.uid()));
alter policy "own sparks log" on public.sparks_log using (user_id = (select auth.uid()));
alter policy "own awards" on public.lb_awards using (user_id = (select auth.uid()));
alter policy "player_words_own" on public.player_words using (user_id = (select auth.uid()));

-- 3. Guest access review. Kept open on purpose (guests need them): username_available (sign-up), leaderboard,
--    like_counts, rounds_status, challenges_status, submit_contact, submit_report (guest feedback), and small
--    calculators with no data (prices, levels, odds). Closed to guests: two that only make sense signed in.
--    Both already checked the user inside; this is an extra lock.
revoke execute on function public.pq_answer(uuid, jsonb) from anon, public;
grant execute on function public.pq_answer(uuid, jsonb) to authenticated;
revoke execute on function public.name_change_cost(uuid) from anon, public;
grant execute on function public.name_change_cost(uuid) to authenticated;

select 'tidy-ups ready' as done;
