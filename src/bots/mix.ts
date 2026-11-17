import type { BotType } from './types';

/** Random rivals (Yazan 2026-11-17): different types first (one of each for 3 rivals), then any type. */
export function randomTypes(n: number, rand: () => number = Math.random): BotType[] {
  const all: BotType[] = ['freshman', 'scholar', 'genius'];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return Array.from({ length: n }, (_, i) => (i < all.length ? all[i] : all[Math.floor(rand() * all.length)]));
}
