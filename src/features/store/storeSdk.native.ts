import { Platform } from 'react-native';
import Purchases, { PRODUCT_CATEGORY, type PurchasesStoreProduct } from 'react-native-purchases';

import type { BillingProvider } from './billing';
import { RC_KEYS } from './storeKeys';

// RevenueCat on the phone (Group 3): it takes the payment through Apple or Google, then tells our server
// (supabase/functions/revenuecat), which adds the tokens or turns on Unlimited. The app user id is the Supabase id.
const SUBS = new Set(['unlimited_monthly']);

export function makeStoreProvider(): BillingProvider | null {
  const apiKey = Platform.OS === 'ios' ? RC_KEYS.ios : RC_KEYS.android;
  if (!apiKey) return null;
  let ready = false;
  const start = (appUserID?: string) => {
    if (ready) return;
    Purchases.configure({ apiKey, appUserID: appUserID ?? null });
    ready = true;
  };
  const cache = new Map<string, PurchasesStoreProduct>();
  const product = async (id: string) => {
    const hit = cache.get(id);
    if (hit) return hit;
    const [p] = await Purchases.getProducts([id], SUBS.has(id) ? PRODUCT_CATEGORY.SUBSCRIPTION : PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    if (!p) throw new Error(`No store product ${id}`);
    cache.set(id, p);
    return p;
  };
  return {
    async logIn(userId) {
      start(userId);
      await Purchases.logIn(userId);
    },
    async buy(productId) {
      try {
        await Purchases.purchaseStoreProduct(await product(productId));
        return true;
      } catch (e) {
        if ((e as { userCancelled?: boolean | null }).userCancelled) return false;
        throw e;
      }
    },
    async restore() {
      await Purchases.restorePurchases();
    },
    async prices(ids) {
      start();
      const out: Record<string, string> = {};
      const subs = ids.filter((i) => SUBS.has(i));
      const rest = ids.filter((i) => !SUBS.has(i));
      const lists = await Promise.all([
        subs.length ? Purchases.getProducts(subs, PRODUCT_CATEGORY.SUBSCRIPTION) : [],
        rest.length ? Purchases.getProducts(rest, PRODUCT_CATEGORY.NON_SUBSCRIPTION) : [],
      ]);
      for (const p of lists.flat()) {
        const id = p.identifier.split(':')[0];
        cache.set(id, p);
        out[id] = p.priceString;
      }
      return out;
    },
  };
}
