import type { BillingProvider } from './billing';

/** Web and Expo Go: no store, so buying stays "coming soon". */
export function makeStoreProvider(): BillingProvider | null {
  return null;
}
