// What the Store sells (MN3, MN4). Prices are set in the App Store and Google Play; these are the ones shown until
// the stores report the local price.

// `was`: the old amount, shown crossed out in red as an offer (Yazan 2026-10-21).
export type Pack = { id: string; tokens: number; was: number; price: string };

export const PACKS: Pack[] = [
  { id: 'tokens_50', tokens: 50, was: 30, price: '$0.99' },
  { id: 'tokens_200', tokens: 200, was: 100, price: '$2.99' },
  { id: 'tokens_500', tokens: 500, was: 250, price: '$5.99' },
  { id: 'tokens_1000', tokens: 1000, was: 500, price: '$9.99' },
];

/** `bonus`: tokens paid once per account on the first subscription (Yazan 2026-10-21; the revenuecat webhook pays it). */
export const SUBSCRIPTION = { id: 'unlimited_monthly', price: '$2.99', period: 'month', bonus: 500, perks: ['Unlimited plays', 'No ads', 'No token cost'] };
