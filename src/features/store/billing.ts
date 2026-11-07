// Buying from the Store (MN2-MN4). RevenueCat takes the payment through Apple or Google and tells our server
// (supabase/functions/revenuecat), which adds the tokens or marks the subscription. The phone then syncs.
// Off until the RevenueCat keys are in (storeKeys.ts): BILLING_LIVE stays false and nothing is charged.
import { create } from 'zustand';

import { engine } from '@/games/engine';
import { useSession } from '@/games/shell/session';
import { supabase } from '@/lib/supabase';
import { syncAccount } from '@/lib/sync';

import { makeStoreProvider } from './storeSdk';

export type BillingProvider = {
  logIn(userId: string): Promise<void>;
  /** True when the store took the payment; false when the player backed out. */
  buy(productId: string): Promise<boolean>;
  restore(): Promise<void>;
  /** The store's own price text for each product, in the player's currency. */
  prices(ids: string[]): Promise<Record<string, string>>;
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
export function loadPrices(ids: string[]) {
  if (!provider || pricesAsked) return;
  pricesAsked = true;
  provider.prices(ids).then((p) => usePrices.setState(p), () => (pricesAsked = false));
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
    if (!(await provider.buy(productId))) return 'cancelled';
  } catch {
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
  } catch {
    return 'failed';
  }
  await settle(userId);
  return 'done';
}

/** The server may take a moment to hear from RevenueCat, so look a few times. */
async function settle(userId: string) {
  for (const wait of [1500, 3000, 6000]) {
    await new Promise((r) => setTimeout(r, wait));
    await Promise.all([syncAccount(userId).catch(() => {}), loadSubscription(userId)]);
  }
}
