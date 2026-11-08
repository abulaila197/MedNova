-- Backend clean-up before publish (Yazan picked fixes 1-5, 2026-10-14).

-- 1. Read the signed-in player once per query, not once per row.
alter policy "read own progress" on public.player_progress using (user_id = (select auth.uid()));
alter policy "add own progress" on public.player_progress with check (user_id = (select auth.uid()));
alter policy "update own progress" on public.player_progress using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "read own subscription" on public.subscriptions using (user_id = (select auth.uid()));
alter policy "read own cases" on public.custom_cases using (user_id = (select auth.uid()));
alter policy "read own cards" on public.hunt_cards using (user_id = (select auth.uid()));

-- 2. Index every foreign key so joins and account deletes stay fast.
create index if not exists ambassador_videos_user_id_idx on public.ambassador_videos (user_id);
create index if not exists contact_messages_user_id_idx on public.contact_messages (user_id);
create index if not exists cq_views_user_id_idx on public.cq_views (user_id);
create index if not exists custom_cases_user_id_idx on public.custom_cases (user_id);
create index if not exists cw_claims_user_id_idx on public.cw_claims (user_id);
create index if not exists dp_case_results_user_id_idx on public.dp_case_results (user_id);
create index if not exists feedback_user_id_idx on public.feedback (user_id);
create index if not exists friendships_requester_idx on public.friendships (requester);
create index if not exists invites_from_user_idx on public.invites (from_user);
create index if not exists invites_room_id_idx on public.invites (room_id);
create index if not exists match_players_user_id_idx on public.match_players (user_id);
create index if not exists matches_room_id_idx on public.matches (room_id);
create index if not exists race_results_user_id_idx on public.race_results (user_id);
create index if not exists referrals_inviter_idx on public.referrals (inviter);
create index if not exists reports_user_id_idx on public.reports (user_id);
create index if not exists rooms_host_idx on public.rooms (host);
create index if not exists sa_turns_drawer_idx on public.sa_turns (drawer);
create index if not exists style_owned_from_user_idx on public.style_owned (from_user);
create index if not exists tmn_views_user_id_idx on public.tmn_views (user_id);

-- 4. Signed-out guests share a cap of 50 Contact and 50 Report messages a day.
create or replace function public.submit_contact(kind text, body text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare rid uuid;
begin
  if length(trim(coalesce(body, ''))) < 2 then raise exception 'empty'; end if;
  if auth.uid() is not null and (select count(*) from public.contact_messages c where c.user_id = auth.uid() and c.created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many';
  end if;
  if auth.uid() is null and (select count(*) from public.contact_messages c where c.user_id is null and c.created_at > now() - interval '1 day') >= 50 then
    raise exception 'too many';
  end if;
  insert into public.contact_messages (user_id, kind, body) values (auth.uid(), left(coalesce(kind, 'General'), 40), left(trim(body), 3000)) returning id into rid;
  return rid;
end $function$;

create or replace function public.submit_report(kind text, body text, context jsonb)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare rid uuid;
begin
  if kind not in ('Medical content', 'Game', 'Technical', 'Other') then raise exception 'kind'; end if;
  -- A signed-in player can send up to 30 a day; keeps a stuck button from flooding the list.
  if auth.uid() is not null and (select count(*) from public.reports r where r.user_id = auth.uid() and r.created_at > now() - interval '1 day') >= 30 then
    raise exception 'too many';
  end if;
  if auth.uid() is null and (select count(*) from public.reports r where r.user_id is null and r.created_at > now() - interval '1 day') >= 50 then
    raise exception 'too many';
  end if;
  insert into public.reports (user_id, kind, body, context)
  values (auth.uid(), kind, left(coalesce(body, ''), 1000), coalesce(context, '{}'::jsonb))
  returning id into rid;
  return rid;
end $function$;

-- 5. At most 60 EXP-paying games per player per day. A row's time is kept within the last
-- 7 days (offline play still syncs), so back-dating can't open up endless empty days.
create or replace function public.wallet_sync(entries jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  e jsonb;
  p public.plays;
  sp public.wallet_ledger;
  refused text[] := '{}';
  ok boolean;
  at_ timestamptz;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('wallet:' || uid::text));
  for e in select * from jsonb_array_elements(coalesce(entries, '[]'::jsonb)) loop
    ok := false;
    if exists (select 1 from public.wallet_ledger where id = e->>'id') then
      continue;
    end if;
    at_ := least(now(), greatest(now() - interval '7 days', coalesce((e->>'at')::timestamptz, now())));
    if e->>'kind' = 'exp' then
      select * into p from public.plays where id = e->>'play_id' and user_id = uid and status = 'finished';
      ok := found
        and (e->>'exp')::int between 0 and public.wallet_exp_cap(p.game, p.mode, p.settings)
        and (e->>'exp')::int <= p.exp_earned
        and coalesce((e->>'tokens')::int, 0) = 0
        and not exists (select 1 from public.wallet_ledger where user_id = uid and kind = 'exp' and play_id = p.id)
        and (select count(*) from public.wallet_ledger w where w.user_id = uid and w.kind = 'exp'
               and w.at >= date_trunc('day', at_) and w.at < date_trunc('day', at_) + interval '1 day') < 60;
    elsif e->>'kind' = 'spend' then
      ok := (e->>'tokens')::int between -10 and -1 and coalesce((e->>'exp')::int, 0) = 0;
    elsif e->>'kind' = 'refund' then
      select * into sp from public.wallet_ledger where id = e->>'reason' and user_id = uid and kind = 'spend';
      ok := found and (e->>'tokens')::int = -sp.tokens
        and not exists (select 1 from public.wallet_ledger where user_id = uid and kind = 'refund' and reason = sp.id);
    end if;
    if ok then
      insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, play_id, at)
      values (e->>'id', uid, e->>'kind', coalesce((e->>'exp')::int, 0), coalesce((e->>'tokens')::int, 0),
              coalesce(e->>'reason', ''), e->>'play_id', at_);
    else
      refused := refused || (e->>'id');
    end if;
  end loop;
  return jsonb_build_object('refused', to_jsonb(refused));
end $function$;
