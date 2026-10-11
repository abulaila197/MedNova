// What the Store sells (MN3, MN4). Prices are set in the App Store and Google Play; these are the ones shown until
// the stores report the local price.

export type Pack = { id: string; tokens: number; price: string };

export const PACKS: Pack[] = [
  { id: 'tokens_30', tokens: 30, price: '$0.99' },
  { id: 'tokens_100', tokens: 100, price: '$2.99' },
  { id: 'tokens_250', tokens: 250, price: '$5.99' },
  { id: 'tokens_500', tokens: 500, price: '$9.99' },
];

export const SUBSCRIPTION = { id: 'unlimited_monthly', price: '$2.99', period: 'month', perks: ['Unlimited plays', 'No ads', 'No token cost'] };
