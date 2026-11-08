-- Refunds (Yazan 2026-11-08, "Take it back"): when Apple or Google refunds a purchase, RevenueCat tells the revenuecat
-- function, which calls this. Refunded tokens come off the balance (never below 0), a refunded Sovereign package loses
-- the robot and its frame (the player goes back to Bolt and the normal frame if wearing them), and a refunded
-- MedNova Unlimited ends now. One row per refunded store transaction, so a retried webhook does nothing twice.
create or replace function public.refund_purchase(uid uuid, event_id text, product text, tokens int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  rid text := 'rf' || left(regexp_replace(event_id, '[^A-Za-z0-9]', '', 'g'), 60);
  bal bigint;
  take int;
begin
  if exists (select 1 from public.wallet_ledger where id = rid) then return jsonb_build_object('ok', true, 'again', true); end if;
  select public.wallet_level_tokens(public.wallet_level(coalesce(sum(exp) filter (where kind = 'exp'), 0)))
         + coalesce(sum(l.tokens) filter (where kind not in ('exp', 'convert')), 0)
    into bal from public.wallet_ledger l where user_id = uid;
  take := least(greatest(tokens, 0), greatest(coalesce(bal, 0), 0))::int;
  insert into public.wallet_ledger (id, user_id, kind, exp, tokens, reason, at)
  values (rid, uid, 'purchase', 0, -take, 'refund:' || product, now());
  if product = 'sovereign_pack' then
    delete from public.style_owned where user_id = uid and item in ('robot:sovereign', 'frame:sovereign');
    update public.profiles set avatar = 'bolt' where id = uid and avatar = 'sovereign';
    update public.style_worn set frame = 'normal', updated_at = now() where user_id = uid and frame = 'sovereign';
  elsif product = 'unlimited_monthly' then
    update public.subscriptions set expires_at = now(), will_renew = false, updated_at = now() where user_id = uid and expires_at > now();
  end if;
  return jsonb_build_object('ok', true, 'took', take);
end $$;
revoke all on function public.refund_purchase(uuid, text, text, int) from public, anon, authenticated;
grant execute on function public.refund_purchase(uuid, text, text, int) to service_role;
