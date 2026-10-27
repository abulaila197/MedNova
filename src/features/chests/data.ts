import type { ImageSource } from 'expo-image';

/** Chests (Yazan 2026-10-18), never sold: from the 3 Grand Rounds missions, and Epic for 4 weeks in a row (2026-10-26). */
export type ChestKind = 'wooden' | 'golden' | 'diamond' | 'epic';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const RARITY: Record<Rarity, { name: string; color: string }> = {
  common: { name: 'Common', color: '#9aa0c4' },
  uncommon: { name: 'Uncommon', color: '#5fd38a' },
  rare: { name: 'Rare', color: '#4fa8ff' },
  epic: { name: 'Epic', color: '#b07cff' },
  legendary: { name: 'Legendary', color: '#ffb547' },
};
export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const CHESTS: Record<ChestKind, { name: string; art: ImageSource; items: number; from: string; odds: Partial<Record<Rarity, number>> }> = {
  wooden: { name: 'Wooden chest', art: require('../../../assets/chests/chest-wooden.webp'), items: 1, from: 'Grand Rounds mission 1', odds: { common: 70, uncommon: 24, rare: 6 } },
  golden: { name: 'Golden chest', art: require('../../../assets/chests/chest-golden.webp'), items: 1, from: 'Grand Rounds mission 2', odds: { common: 50, uncommon: 30, rare: 14, epic: 6 } },
  diamond: { name: 'Diamond chest', art: require('../../../assets/chests/chest-diamond.webp'), items: 1, from: 'Grand Rounds mission 3', odds: { common: 30, uncommon: 32, rare: 22, epic: 12, legendary: 4 } },
  epic: { name: 'Epic chest', art: require('../../../assets/chests/chest-epic.webp'), items: 1, from: 'Grand Rounds 4 weeks in a row', odds: { rare: 40, epic: 35, legendary: 25 } },
};
export const CHEST_ORDER: ChestKind[] = ['wooden', 'golden', 'diamond', 'epic'];

export type ItemKind = 'tokens' | 'sticker' | 'mech' | 'effect';
export type Item = { key: string; kind: ItemKind; name: string; rarity: Rarity; art?: ImageSource; tokens?: number; stars?: number; dupe: number };

const tok = (n: number, rarity: Rarity, art: ImageSource): Item => ({ key: `tokens:${n}`, kind: 'tokens', name: `${n} tokens`, rarity, art, tokens: n, dupe: 0 });

/** Nova Mechs: front-only cards, no clue and no mission. */
export const MECHS: { key: string; name: string; title: string; stars: 3 | 4 | 5; card: ImageSource; face: ImageSource }[] = [
  { key: 'sprocket', name: 'Sprocket', title: 'The Tiny Racer', stars: 3, card: require('../../../assets/mechs/sprocket-card.jpg'), face: require('../../../assets/mechs/sprocket-face.webp') },
  { key: 'kit', name: 'Kit', title: 'The Snack Hauler', stars: 3, card: require('../../../assets/mechs/kit-card.jpg'), face: require('../../../assets/mechs/kit-face.webp') },
  { key: 'vex', name: 'Vex', title: 'The Glass Phantom', stars: 4, card: require('../../../assets/mechs/vex-card.jpg'), face: require('../../../assets/mechs/vex-face.webp') },
  { key: 'bulwark', name: 'Bulwark', title: 'The Storm Tank', stars: 4, card: require('../../../assets/mechs/bulwark-card.jpg'), face: require('../../../assets/mechs/bulwark-face.webp') },
  { key: 'echo', name: 'Echo', title: 'The Sonar Scout', stars: 4, card: require('../../../assets/mechs/echo-card.jpg'), face: require('../../../assets/mechs/echo-face.webp') },
  { key: 'aurora', name: 'Aurora', title: 'The Dawn Sentinel', stars: 5, card: require('../../../assets/mechs/aurora-card.jpg'), face: require('../../../assets/mechs/aurora-face.webp') },
  { key: 'cortex', name: 'Cortex', title: 'The Neon Ronin', stars: 5, card: require('../../../assets/mechs/cortex-card.jpg'), face: require('../../../assets/mechs/cortex-face.webp') },
  { key: 'titan', name: 'Titan', title: 'The Six-Armed Forge', stars: 5, card: require('../../../assets/mechs/titan-card.jpg'), face: require('../../../assets/mechs/titan-face.webp') },
];
export const MECHS_PRIZE = 500;

const STAR_RARITY: Record<3 | 4 | 5, Rarity> = { 3: 'rare', 4: 'epic', 5: 'legendary' };
const STAR_DUPE: Record<3 | 4 | 5, number> = { 3: 25, 4: 50, 5: 80 };

/** Every item a chest can hold, by rarity. Duplicates turn into `dupe` tokens. */
export const ITEMS: Item[] = [
  tok(10, 'common', require('../../../assets/chests/token-10.jpg')),
  tok(20, 'common', require('../../../assets/chests/token-20.jpg')),
  tok(30, 'uncommon', require('../../../assets/chests/token-30.jpg')),
  // The 3 taunt text sticker packs (8 stickers each); the tile shows the pack's first sticker.
  { key: 'pack:arcade', kind: 'sticker', name: 'Arcade Trash Talk', rarity: 'uncommon', art: require('../../../assets/stickers/text/arcade-01.png'), dupe: 15 },
  { key: 'pack:comic', kind: 'sticker', name: 'Comic Knockout', rarity: 'uncommon', art: require('../../../assets/stickers/text/comic-01.png'), dupe: 15 },
  { key: 'pack:chrome', kind: 'sticker', name: 'Chrome Swagger', rarity: 'uncommon', art: require('../../../assets/stickers/text/chrome-01.png'), dupe: 15 },
  tok(50, 'rare', require('../../../assets/chests/token-50.jpg')),
  tok(100, 'epic', require('../../../assets/chests/token-100.jpg')),
  ...MECHS.map((m): Item => ({ key: `mech:${m.key}`, kind: 'mech', name: m.name, rarity: STAR_RARITY[m.stars], art: m.face, stars: m.stars, dupe: STAR_DUPE[m.stars] })),
  { key: 'effect:too_easy', kind: 'effect', name: 'Too Easy', rarity: 'legendary', dupe: 70 },
  { key: 'effect:mic_drop', kind: 'effect', name: 'Mic Drop', rarity: 'legendary', dupe: 70 },
];

/** What this chest can drop: rarities it rolls, minus 5-star robots in the wooden and golden chests (diamond gets them, list #28). */
export function chestItems(k: ChestKind): Item[] {
  const odds = CHESTS[k].odds;
  return ITEMS.filter((i) => (odds[i.rarity] ?? 0) > 0 && !((k === 'wooden' || k === 'golden') && i.kind === 'mech' && i.stars === 5));
}
