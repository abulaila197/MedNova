// RevenueCat webhook (MN2): the store said a player paid. Token packs become 'purchase' wallet rows; the monthly
// subscription updates public.subscriptions. Deployed with verify_jwt off: RevenueCat signs in with the
// REVENUECAT_WEBHOOK_SECRET it is given as its Authorization header, and nothing else gets in.
// The phone logs in to RevenueCat with the Supabase user id, so app_user_id is that id.
import { createClient } from 'npm:@supabase/supabase-js@2';

declare const Deno: { env: { get(k: string): string | undefined }; serve(h: (req: Request) => Promise<Response>): void };

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

/** Mirrors PACKS in src/features/store/catalog.ts (MN4). */
const PACK_TOKENS: Record<string, number> = { tokens_100: 100, tokens_400: 400, tokens_1000: 1000, tokens_2000: 2000 };
const SUBSCRIPTION = 'unlimited_monthly';
const SOVEREIGN = 'sovereign_pack'; // $10: Sovereign, its frame and 500 tokens (Yazan 2026-10-25)
const SUB_BONUS = 500; // once per account, on the first subscription (Yazan 2026-10-21)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Event = {
  id: string;
  type: string;
  app_user_id: string;
  product_id?: string;
  transaction_id?: string;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number;
  cancel_reason?: string;
  original_transaction_id?: string;
  transferred_from?: string[];
  transferred_to?: string[];
};

const ok = (note = 'ok') => new Response(note, { status: 200 });

Deno.serve(async (req) => {
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('unauthorized', { status: 401 });
  const body = (await req.json().catch(() => null)) as { event?: Event } | null;
  const e = body?.event;
  if (!e?.id || !e.type) return new Response('bad request', { status: 400 });
  if (e.type === 'TEST') return ok('test');
  if (e.type === 'TRANSFER') return transfer(e);
  if (!UUID.test(e.app_user_id)) return ok('not a MedNova account'); // anonymous RevenueCat ids are never paid out

  const product = (e.product_id ?? '').split(':')[0]; // Google adds ":base-plan"
  // A refund (Apple or Google gave the money back) arrives as CANCELLATION for CUSTOMER_SUPPORT: take it back
  // (Yazan 2026-11-08). Tokens come off the balance down to 0; Sovereign and its frame go; Unlimited ends now.
  if (e.type === 'CANCELLATION' && e.cancel_reason === 'CUSTOMER_SUPPORT' && (PACK_TOKENS[product] || product === SOVEREIGN || product === SUBSCRIPTION)) {
    // The subscription's 500 bonus goes back only with a refund of the first month that paid it.
    const firstMonth = product === SUBSCRIPTION && (!e.original_transaction_id || e.original_transaction_id === e.transaction_id);
    const tokens = PACK_TOKENS[product] ?? (product === SOVEREIGN ? 500 : firstMonth ? SUB_BONUS : 0);
    const { error } = await admin.rpc('refund_purchase', { uid: e.app_user_id, event_id: e.transaction_id ?? e.id, product, tokens });
    if (error) return new Response(error.message, { status: 500 });
    return ok('refund');
  }
  if (e.type === 'NON_RENEWING_PURCHASE' && PACK_TOKENS[product]) {
    // One row per store transaction: a retried webhook hits the same id and is ignored.
    const id = `p${(e.transaction_id ?? e.id).replace(/[^A-Za-z0-9]/g, '')}`.slice(0, 64);
    const { error } = await admin.from('wallet_ledger').upsert(
      { id, user_id: e.app_user_id, kind: 'purchase', exp: 0, tokens: PACK_TOKENS[product], reason: `pack:${product}`, at: new Date(e.event_timestamp_ms ?? Date.now()).toISOString() },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (error) return new Response(error.message, { status: 500 }); // RevenueCat retries
    return ok();
  }

  if (e.type === 'NON_RENEWING_PURCHASE' && product === SOVEREIGN) {
    const { error } = await admin.rpc('grant_sovereign', { uid: e.app_user_id, event_id: (e.transaction_id ?? e.id).replace(/[^A-Za-z0-9]/g, '').slice(0, 60) });
    if (error) return new Response(error.message, { status: 500 });
    return ok();
  }

  if (product === SUBSCRIPTION) {
    const live = ['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE'];
    if (!live.includes(e.type)) return ok('ignored');
    const { error } = await admin.from('subscriptions').upsert({
      user_id: e.app_user_id,
      product,
      expires_at: e.expiration_at_ms ? new Date(e.expiration_at_ms).toISOString() : null,
      will_renew: !['CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE'].includes(e.type),
      updated_at: new Date().toISOString(),
    });
    if (error) return new Response(error.message, { status: 500 });
    if (e.type === 'INITIAL_PURCHASE') {
      // The fixed row id makes the bonus once per account, even if they subscribe again later.
      const { error: b } = await admin.from('wallet_ledger').upsert(
        { id: `subbonus${e.app_user_id.replace(/-/g, '')}`, user_id: e.app_user_id, kind: 'purchase', exp: 0, tokens: SUB_BONUS, reason: 'sub:bonus', at: new Date().toISOString() },
        { onConflict: 'id', ignoreDuplicates: true },
      );
      if (b) return new Response(b.message, { status: 500 });
    }
    return ok();
  }
  return ok('ignored');
});

/**
 * Restore on a different MedNova account (Yazan 2026-11-08): RevenueCat moves the store purchases from the old app user
 * to the new one and tells us with TRANSFER. MedNova Unlimited moves (the old account loses it, no second sign-up
 * bonus); Sovereign and its frame are added to the new account if the old one bought them, without the 500 tokens again.
 */
async function transfer(e: Event) {
  const to = (e.transferred_to ?? []).find((x) => UUID.test(x));
  const from = (e.transferred_from ?? []).filter((x) => UUID.test(x) && x !== to);
  if (!to || !from.length) return ok('transfer: nothing to move');
  const now = new Date().toISOString();
  const { data: subs, error: se } = await admin.from('subscriptions').select('user_id, product, expires_at, will_renew').in('user_id', from).gt('expires_at', now);
  if (se) return new Response(se.message, { status: 500 });
  const best = (subs ?? []).sort((a: { expires_at: string }, b: { expires_at: string }) => String(b.expires_at).localeCompare(String(a.expires_at)))[0];
  if (best) {
    const { error } = await admin.from('subscriptions').upsert({ user_id: to, product: best.product, expires_at: best.expires_at, will_renew: best.will_renew, updated_at: now });
    if (error) return new Response(error.message, { status: 500 });
    const { error: off } = await admin.from('subscriptions').update({ expires_at: now, will_renew: false, updated_at: now }).in('user_id', from).gt('expires_at', now);
    if (off) return new Response(off.message, { status: 500 });
  }
  // Only a bought (and not refunded) Sovereign travels: a store purchase row, not one an admin gave.
  const { data: rows, error: ve } = await admin.from('wallet_ledger').select('reason').in('user_id', from).in('reason', [`pack:${SOVEREIGN}`, `refund:${SOVEREIGN}`]);
  if (ve) return new Response(ve.message, { status: 500 });
  const reasons = (rows ?? []).map((r: { reason: string }) => r.reason);
  const sov = reasons.includes(`pack:${SOVEREIGN}`) && !reasons.includes(`refund:${SOVEREIGN}`);
  if (sov) {
    const { error } = await admin.from('style_owned').upsert([{ user_id: to, item: 'robot:sovereign' }, { user_id: to, item: 'frame:sovereign' }], { onConflict: 'user_id,item', ignoreDuplicates: true });
    if (error) return new Response(error.message, { status: 500 });
  }
  return ok(`transfer: ${best ? 'unlimited ' : ''}${sov ? 'sovereign' : ''}`.trim());
}
