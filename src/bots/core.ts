import { starsOf } from '@/features/shop/robots';
import { CHARACTERS, MECH_CHARACTERS, SHOP_CHARACTERS } from '@/games/shell/characters';

import { BOT_NAMES } from './names';
import type { Bot, BotLevel, BotType } from './types';

/** Every character a bot may wear: all of them except Admin (Yazan 2026-11-09). */
const WEARABLE = [...CHARACTERS, ...MECH_CHARACTERS, ...SHOP_CHARACTERS].filter((c) => c.slug !== 'admin').map((c) => c.slug);

/** More stars = more smart (Yazan 2026-11-09): which star counts each type wears. */
const STARS_FOR: Record<BotType, number[]> = { freshman: [1, 2, 3], scholar: [3, 4], genius: [5, 6] };
const facesFor = (t: BotType) => WEARABLE.filter((slug) => STARS_FOR[t].includes(starsOf(slug)));

/** The mix of types each level deals (Yazan 2026-11-09: the level sets the mix, always with some variety). */
const MIX: Record<BotLevel, Record<BotType, number>> = {
  easy: { freshman: 0.6, scholar: 0.3, genius: 0.1 },
  medium: { freshman: 0.25, scholar: 0.5, genius: 0.25 },
  hard: { freshman: 0.1, scholar: 0.3, genius: 0.6 },
};

/** The player levels shown on each type's badge, so the badge also hints how strong a bot is. */
const LEVELS: Record<BotType, [number, number]> = { freshman: [1, 9], scholar: [8, 22], genius: [20, 45] };

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const between = ([a, b]: [number, number]) => a + Math.floor(Math.random() * (b - a + 1));

function typeFor(level: BotLevel): BotType {
  const m = MIX[level];
  let r = Math.random();
  for (const t of ['freshman', 'scholar', 'genius'] as BotType[]) {
    if ((r -= m[t]) <= 0) return t;
  }
  return 'scholar';
}

/** A new bot of a type, whose name is not one of `taken` (names never repeat at one table). */
export function makeBot(type: BotType, taken: string[] = []): Bot {
  const names = BOT_NAMES[type].filter((n) => !taken.includes(n));
  const name = pick(names.length ? names : BOT_NAMES[type]);
  return { id: `bot:${type}:${name}`, type, name, character: pick(facesFor(type)), level: between(LEVELS[type]) };
}

/**
 * The table for a level: n bots in the level's mix. Two or more bots always show some variety:
 * if the dice dealt only one type, one seat changes to the next most likely type.
 */
export function dealBots(level: BotLevel, n: number, taken: string[] = []): Bot[] {
  const types = Array.from({ length: n }, () => typeFor(level));
  if (n >= 2 && types.every((t) => t === types[0])) {
    const order = (Object.entries(MIX[level]) as [BotType, number][]).sort((a, b) => b[1] - a[1]).map(([t]) => t);
    types[n - 1] = order.find((t) => t !== types[0])!;
  }
  const out: Bot[] = [];
  for (const t of types) out.push(makeBot(t, [...taken, ...out.map((b) => b.name)]));
  return out;
}

/** One more bot for an empty seat (Add bot), in the level's mix. */
export const addBot = (level: BotLevel, taken: string[]) => makeBot(typeFor(level), taken);

/** Swap: a new random bot of the same type (Yazan 2026-11-09: same level). */
export const swapBot = (old: Bot, taken: string[]) => makeBot(old.type, [...taken, old.name]);

export const isBotId = (id?: string | null) => !!id && id.startsWith('bot:');
