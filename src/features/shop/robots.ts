import type { ImageSource } from 'expo-image';

import { DECK } from '@/features/cards/deck';
import { MECHS } from '@/features/chests/data';

/**
 * Style shop characters (Yazan 2026-10-25): five sold for tokens, and a special group of three that are never sold
 * for tokens. Owned ones are style items 'robot:<key>'; the server works out the earned ones (Linky, Admin).
 */
export type Robot = { key: string; name: string; title: string; stars: 3 | 4 | 5 | 6; card: ImageSource; face: ImageSource; price: number | null; group: 'shop' | 'special'; how?: string };

export const ROBOTS: Robot[] = [
  { key: 'bloop', name: 'Bloop', title: 'The Bubble Diver', stars: 3, price: 700, group: 'shop', card: require('../../../assets/shop/bloop-card.jpg'), face: require('../../../assets/shop/bloop-face.webp') },
  { key: 'pixel', name: 'Pixel', title: 'The Arcade Gremlin', stars: 3, price: 700, group: 'shop', card: require('../../../assets/shop/pixel-card.jpg'), face: require('../../../assets/shop/pixel-face.webp') },
  { key: 'nimbus', name: 'Nimbus', title: 'The Cloud Surfer', stars: 4, price: 1000, group: 'shop', card: require('../../../assets/shop/nimbus-card.jpg'), face: require('../../../assets/shop/nimbus-face.webp') },
  { key: 'ember', name: 'Ember', title: 'The Fire Dancer', stars: 4, price: 1000, group: 'shop', card: require('../../../assets/shop/ember-card.jpg'), face: require('../../../assets/shop/ember-face.webp') },
  { key: 'zenith', name: 'Zenith', title: 'The Star Pilot', stars: 5, price: 1500, group: 'shop', card: require('../../../assets/shop/zenith-card.jpg'), face: require('../../../assets/shop/zenith-face.webp') },
  { key: 'linky', name: 'Linky', title: 'The Friend Signal', stars: 4, price: null, group: 'special', how: 'Follow all our pages, or have 20 friends redeem your code', card: require('../../../assets/shop/linky-card.jpg'), face: require('../../../assets/shop/linky-face.webp') },
  { key: 'sovereign', name: 'Sovereign', title: 'The Crown Engine', stars: 6, price: null, group: 'special', how: 'Sovereign package: $10 with its frame and 500 tokens', card: require('../../../assets/shop/sovereign-card.jpg'), face: require('../../../assets/shop/sovereign-face.webp') },
  { key: 'admin', name: 'Admin', title: 'The Architect', stars: 6, price: null, group: 'special', how: 'Only on the MedNova team account', card: require('../../../assets/shop/admin-card.jpg'), face: require('../../../assets/shop/admin-face.webp') },
];

/** Tokens, once, for owning all five shop robots (Yazan 2026-10-25); paid by style_buy on the server. */
export const SHOP_ROBOTS_PRIZE = 500;
export const SHOP_ROBOT_KEYS = ROBOTS.filter((r) => r.group === 'shop').map((r) => `robot:${r.key}`);

export const robotOf = (key?: string) => ROBOTS.find((r) => r.key === key);

/** The Sovereign package's store product (paid through the stores, like the token packs). */
export const SOVEREIGN_PACK = { id: 'sovereign_pack', price: '$10', tokens: 500 };

/**
 * Star bonus of the character you wear (Yazan 2026-10-25): more EXP from every play and a faster charge refill.
 * Changing your character changes it.
 */
export const STAR_BONUS: Record<number, { exp: number; refillMin: number }> = {
  1: { exp: 0, refillMin: 10 },
  2: { exp: 3, refillMin: 10 },
  3: { exp: 6, refillMin: 9 },
  4: { exp: 10, refillMin: 8 },
  5: { exp: 15, refillMin: 7 },
  6: { exp: 30, refillMin: 5 },
};

/** Stars of any character: the Original pack (hunt cards), Nova Mechs and the shop robots. */
export function starsOf(slug?: string | null) {
  return DECK.find((c) => c.key === slug)?.stars ?? MECHS.find((m) => m.key === slug)?.stars ?? robotOf(slug ?? undefined)?.stars ?? 1;
}

export const bonusOf = (slug?: string | null) => STAR_BONUS[starsOf(slug)] ?? STAR_BONUS[1];

/** "+15% EXP · refill 7 min" (or just the refill for 1 star). */
export function bonusLine(slug?: string | null) {
  const b = bonusOf(slug);
  return `${b.exp ? `+${b.exp}% EXP · ` : ''}refill ${b.refillMin} min`;
}
