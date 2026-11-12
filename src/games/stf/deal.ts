import { engine } from '../engine';
import type { Play } from '../engine/types';
import { tickedFields } from '../shell/fields';
import { shuffle } from './core';
import { poolOf } from './data';

const SEEN = 'stf:seen';

/**
 * Deals a game's cases (Yazan 2026-11-12, unseen first): cases not seen yet come first, in a random order, then the
 * seen ones. Only when every case in the ticked fields has been seen do they all count as new again.
 */
export async function dealCases(play: Pick<Play, 'settings'>, rand: () => number = Math.random): Promise<string[]> {
  const n = Math.max(1, Number(play.settings.cases) || 3);
  const pool = poolOf(tickedFields(play.settings)).map((c) => c.id);
  let seen = new Set((await engine.kv.get<string[]>(SEEN)) ?? []);
  if (pool.every((id) => seen.has(id))) seen = new Set([...seen].filter((id) => !pool.includes(id)));
  const order = [...shuffle(pool.filter((id) => !seen.has(id)), rand), ...shuffle(pool.filter((id) => seen.has(id)), rand)];
  const picked = order.slice(0, n);
  await engine.kv.set(SEEN, [...seen, ...picked]);
  return picked;
}
