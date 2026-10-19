-- A3 extra #4: a second chance (Streak KEEP, Riddler revive) is bought on the server (token_spend 'second'), so when
-- the effect no longer applies by the time the purchase returns (the Streak round timed out mid-call, the player left
-- the Riddler level), the phone could not give the tokens back: S3 made server spends final for wallet_sync.
--
-- New token_second_refund(spend_id): gives back exactly one server 'second' spend, once, and closes that run/level.
-- What keeps it from being a token source:
--   * only the caller's own row with that id, kind 'spend', server id ('s...'), reason 'second:<ref>';
--   * only within 2 minutes of the purchase, and only the latest second chance bought for that ref;
--   * never twice (a refund row with reason = spend id already exists -> refused);
--   * the refund equals the spend exactly, so the net is zero tokens;
--   * the refunded purchase still counts toward the 3-per-ref cap, and token_spend now refuses any further second
--     chance for a ref that had a refund ('max'): the round or level is over, which is why it was refunded.
-- The effect itself lives on the phone (the server can't see a Streak round or a Riddler level), so the server's
-- confirmation is these facts, not the game state. S3 is unchanged: wallet_sync still refuses phone refunds of 's'
-- rows, and glow / booster / style purchases stay final.
--
-- token_spend: the live definition, plus the closed-ref check and the spend id in the reply (the phone needs it to
-- ask for the refund). Apply before shipping the app build that calls token_second_refund.

create or replace function public.token_spend(what text, ref text default null)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare uid uuid := auth.uid(); cost int; bal int; n int; wk int := public.week_index(); r jsonb; sid text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || uid::text));
  if what = 'glow' then cost := 50;
  elsif what = 'second' then
    if coalesce(ref, '') = '' then return jsonb_build_object('ok', false, 'why', 'ref'); end if;
    select count(*) into n from public.wallet_ledger where user_id = uid and kind = 'spend' and reason = 'second:' || ref;
    if n >= 3 then return jsonb_build_object('ok', false, 'why', 'max'); end if;
    -- A refunded second chance means that run or level is over: no more for this ref.
    if exists (select 1 from public.wallet_ledger s join public.wallet_ledger f
                 on f.user_id = uid and f.kind = 'refund' and f.reason = s.id
               where s.user_id = uid and s.kind = 'spend' and s.reason = 'second:' || ref) then
      return jsonb_build_object('ok', false, 'why', 'max');
    end if;
    cost := (array[5, 10, 20])[n + 1];
  elsif what = 'booster' then
    r := public.rounds_week(wk);
    if r->>'kind' <> 'game' or r->>'game' <> ref then return jsonb_build_object('ok', false, 'why', 'not this week'); end if;
    cost := 24;
  else return jsonb_build_object('ok', false, 'why', 'unknown');
  end if;
  bal := (public.wallet_balance(uid)->>'tokens')::int;
  if bal < cost then return jsonb_build_object('ok', false, 'why', 'tokens', 'need', cost - bal); end if;
  sid := 's' || replace(gen_random_uuid()::text, '-', '');
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, at)
  values (sid, uid, 'spend', 0, -cost,
          case what when 'glow' then 'glow:' || wk when 'second' then 'second:' || ref else 'booster:' || wk || ':' || ref end, now());
  if what = 'glow' then
    insert into public.style_worn (user_id) values (uid) on conflict (user_id) do nothing;
    update public.style_worn set glow_until = greatest(coalesce(glow_until, now()), now()) + interval '7 days' where user_id = uid;
  end if;
  return jsonb_build_object('ok', true, 'cost', cost, 'week', wk, 'id', sid);
end $function$;

create or replace function public.token_second_refund(spend_id text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare uid uuid := auth.uid(); sp public.wallet_ledger;
begin
  if uid is null then raise exception 'not signed in'; end if;
  -- The same lock as token_spend, so a refund and a purchase for this player never interleave.
  perform pg_advisory_xact_lock(hashtext('shop:' || uid::text));
  select * into sp from public.wallet_ledger
   where id = spend_id and user_id = uid and kind = 'spend' and id like 's%' and reason like 'second:%';
  if not found then return jsonb_build_object('ok', false, 'why', 'not found'); end if;
  if sp.at < now() - interval '2 minutes' then return jsonb_build_object('ok', false, 'why', 'late'); end if;
  if exists (select 1 from public.wallet_ledger where user_id = uid and kind = 'refund' and reason = sp.id) then
    return jsonb_build_object('ok', false, 'why', 'done');
  end if;
  if exists (select 1 from public.wallet_ledger where user_id = uid and kind = 'spend' and reason = sp.reason
               and (at > sp.at or (at = sp.at and id > sp.id))) then
    return jsonb_build_object('ok', false, 'why', 'used');
  end if;
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, at)
  values ('s' || replace(gen_random_uuid()::text, '-', ''), uid, 'refund', 0, -sp.tokens, sp.id, now());
  return jsonb_build_object('ok', true, 'tokens', -sp.tokens);
end $function$;

revoke all on function public.token_second_refund(text) from public, anon;
grant execute on function public.token_second_refund(text) to authenticated, service_role;
