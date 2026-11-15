// Buying from the Store (MN2-MN4). RevenueCat takes the payment through Apple or Google and tells our server
// (supabase/functions/revenuecat), which adds the tokens or marks the subscription. The phone then syncs.
// Off until the RevenueCat keys are in (storeKeys.ts): BILLING_LIVE stays false and nothing is charged.
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { engine } from '@/games/engine';
import { useSession } from '@/games/shell/session';
import { supabase } from '@/lib/supabase';
import { refreshWallet, syncAccount } from '@/lib/sync';

import { makeStoreProvider } from './storeSdk';

export type BillingProvider = {
  logIn(userId: string): Promise<void>;
  /** True when the store took the payment; false when the player backed out. */
  buy(productId: string): Promise<boolean>;
  restore(): Promise<void>;
  /** The store's own price text for each product, in the player's currency. */
  prices(ids: string[]): Promise<Record<string, string>>;
  /** The store account's country ("GBR"), or null when the store won't say. */
  storefront(): Promise<string | null>;
};

// RevenueCat on phones (storeSdk.native.ts); nothing on web. Live once its key is filled in (storeKeys.ts).
const provider: BillingProvider | null = makeStoreProvider();

/** On once the store keys are in: until then nothing is charged and the shop says "coming soon". */
export const BILLING_LIVE = provider != null;

/** Local prices from the store ("EGP 49.99"), shown instead of the dollar defaults once they arrive. */
export const usePrices = create<Record<string, string>>(() => ({}));
/** The store's price for one product, or the default until the store answers. */
export const usePrice = (id: string, fallback: string) => usePrices((p) => p[id] ?? fallback);
let pricesAsked = false;
/**
 * Asks the store for the products when the shop opens. A product the store doesn't return is logged (with what the
 * store said) and asked again on the next open, so a slow first answer doesn't leave the default prices for good.
 */
export function loadPrices(ids: string[]) {
  if (!provider || pricesAsked) return;
  pricesAsked = true;
  provider.prices(ids).then(
    (p) => {
      usePrices.setState(p);
      const missing = ids.filter((i) => !p[i]);
      if (missing.length) {
        pricesAsked = false;
        void logStoreError('products', missing.join(','), null, Object.keys(p).length);
      }
    },
    (e) => {
      pricesAsked = false;
      void logStoreError('products', ids.join(','), e, 0);
    },
  );
}

type StoreError = { code?: unknown; message?: unknown; underlyingErrorMessage?: unknown; userInfo?: { readableErrorCode?: unknown } };
const cut = (v: unknown, n: number) => (v == null || v === '' ? null : String(v).slice(0, n));
/**
 * Keeps what the store answered when a purchase, a restore or loading the products went wrong (store_errors, read
 * on the Admin page), so a failed buy is read exactly instead of guessed (App Review, Nov 2026). Never throws.
 */
async function logStoreError(stage: 'products' | 'login' | 'buy' | 'restore', product: string | null, e: unknown, found?: number) {
  const userId = useSession.getState().userId;
  if (!userId) return;
  try {
    const err = (e ?? {}) as StoreError;
    const front = await provider?.storefront().catch(() => null);
    await supabase.from('store_errors').insert({
      user_id: userId,
      stage,
      product: cut(product, 80),
      platform: cut(`${Platform.OS} ${Platform.Version}`, 40),
      app: cut(`${Application.nativeApplicationVersion ?? '?'} (${Application.nativeBuildVersion ?? '?'})`, 40),
      device: cut(Device.modelName, 80),
      storefront: cut(front, 10),
      found: found ?? null,
      code: cut(err.userInfo?.readableErrorCode ?? err.code, 80),
      message: cut(e == null ? 'The store returned no product' : (err.message ?? e), 600),
      underlying: cut(err.underlyingErrorMessage, 600),
    });
  } catch {
    // the log is a help, never a new problem
  }
}

const SUB_KEY = 'subscription';

/** When the player's subscription runs out (ms), kept on the phone so offline plays stay unlimited. */
export const useSubscription = create<{ until: number | null }>(() => ({ until: null }));
export const isSubscribed = () => (useSubscription.getState().until ?? 0) > Date.now();
export const useIsSubscribed = () => useSubscription((s) => (s.until ?? 0) > Date.now());

/** Reads the subscription the server holds (cached copy first). */
export async function loadSubscription(userId: string | null) {
  if (!userId) return useSubscription.setState({ until: null });
  const cached = await engine.kv.get<number>(SUB_KEY);
  if (cached != null) useSubscription.setState({ until: cached });
  const { data, error } = await supabase.from('subscriptions').select('expires_at').eq('user_id', userId).maybeSingle();
  if (error) return;
  const until = data?.expires_at ? Date.parse(data.expires_at) : null;
  useSubscription.setState({ until });
  if (until == null) await engine.kv.remove(SUB_KEY);
  else await engine.kv.set(SUB_KEY, until);
}

export type BuyResult = 'done' | 'cancelled' | 'soon' | 'signin' | 'failed';

/** Buys a pack or the subscription; afterwards the wallet and subscription come back from the server. */
export async function buy(productId: string): Promise<BuyResult> {
  const userId = useSession.getState().userId;
  if (!userId) return 'signin';
  if (!BILLING_LIVE || !provider) return 'soon';
  try {
    await provider.logIn(userId);
  } catch (e) {
    void logStoreError('login', productId, e);
    return 'failed';
  }
  try {
    if (!(await provider.buy(productId))) return 'cancelled';
  } catch (e) {
    void logStoreError('buy', productId, e);
    return 'failed';
  }
  await settle(userId);
  return 'done';
}

/** Apple requires a way to bring back purchases on a new phone. */
export async function restore(): Promise<BuyResult> {
  const userId = useSession.getState().userId;
  if (!userId) return 'signin';
  if (!BILLING_LIVE || !provider) return 'soon';
  try {
    await provider.logIn(userId);
    await provider.restore();
  } catch (e) {
    void logStoreError('restore', null, e);
    return 'failed';
  }
  await settle(userId);
  return 'done';
}

/**
 * The server may take a moment to hear from RevenueCat, so look a few times, and stop as soon as the purchase is
 * there (fix A1, 2026-11-16: it used to wait about 10 s and run 3 full syncs whatever happened).
 */
async function settle(userId: string) {
  const rows = async () => (await engine.wallet.ledger()).length;
  const before = await rows();
  const subBefore = useSubscription.getState().until;
  for (const wait of [600, 900, 1200, 1800, 2500, 3500]) {
    await new Promise((r) => setTimeout(r, wait));
    await Promise.all([refreshWallet(userId, { full: false }).catch(() => {}), loadSubscription(userId).catch(() => {})]);
    if ((await rows()) > before || useSubscription.getState().until !== subBefore) break;
  }
  void syncAccount(userId).catch(() => {});
}
