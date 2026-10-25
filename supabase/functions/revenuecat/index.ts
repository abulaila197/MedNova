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
};

const ok = (note = 'ok') => new Response(note, { status: 200 });

Deno.serve(async (req) => {
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('unauthorized', { status: 401 });
  const body = (await req.json().catch(() => null)) as { event?: Event } | null;
  const e = body?.event;
  if (!e?.id || !e.type) return new Response('bad request', { status: 400 });
  if (e.type === 'TEST') return ok('test');
  if (!UUID.test(e.app_user_id)) return ok('not a MedNova account'); // anonymous RevenueCat ids are never paid out

  const product = (e.product_id ?? '').split(':')[0]; // Google adds ":base-plan"
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
