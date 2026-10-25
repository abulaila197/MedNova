// What the Store sells (MN3, MN4). Prices are set in the App Store and Google Play; these are the ones shown until
// the stores report the local price.

// `was`: the old amount, shown crossed out in red as an offer (Yazan 2026-10-21). Doubled 2026-10-25: each pack
// now gives twice what it did, with the old amount crossed out.
export type Pack = { id: string; tokens: number; was: number; price: string };

export const PACKS: Pack[] = [
  { id: 'tokens_100', tokens: 100, was: 50, price: '$0.99' },
  { id: 'tokens_400', tokens: 400, was: 200, price: '$2.99' },
  { id: 'tokens_1000', tokens: 1000, was: 500, price: '$5.99' },
  { id: 'tokens_2000', tokens: 2000, was: 1000, price: '$9.99' },
];

/** `bonus`: tokens paid once per account on the first subscription (Yazan 2026-10-21; the revenuecat webhook pays it). */
export const SUBSCRIPTION = { id: 'unlimited_monthly', price: '$2.99', period: 'month', bonus: 500, perks: ['Unlimited plays', 'No ads', 'No token cost'] };
