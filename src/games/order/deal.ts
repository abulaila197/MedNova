import { engine } from '../engine';
import type { Play } from '../engine/types';
import { tickedFields } from '../shell/fields';
import { shuffle } from './core';
import { poolOf } from './data';

const SEEN = 'order:seen';

/**
 * Deals `n` questions, unseen first: questions not seen yet come first in a random order, then the seen ones. Only when
 * every question in the ticked categories has been seen do they all count as new again.
 */
export async function dealQuestions(play: Pick<Play, 'settings'>, n: number, rand: () => number = Math.random): Promise<string[]> {
  const pool = poolOf(tickedFields(play.settings));
  let seen = new Set((await engine.kv.get<string[]>(SEEN)) ?? []);
  if (pool.every((id) => seen.has(id))) seen = new Set([...seen].filter((id) => !pool.includes(id)));
  const order = [...shuffle(pool.filter((id) => !seen.has(id)), rand), ...shuffle(pool.filter((id) => seen.has(id)), rand)];
  const picked = order.slice(0, Math.max(1, n));
  await engine.kv.set(SEEN, [...seen, ...picked]);
  return picked;
}

/** Questions (Solo, Vs rivals) or rounds (Pass the phone) chosen in setup. */
export const countOf = (settings: Record<string, unknown>) => Number(settings.cases) || 5;
