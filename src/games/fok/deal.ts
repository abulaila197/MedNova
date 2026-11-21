import { engine } from '../engine';
import type { Play } from '../engine/types';
import { dealFirst, keepDeal } from '../shell/deal';
import { tickedFields } from '../shell/fields';
import { buildBoard, shuffle, type Board } from './core';
import { groupById, poolOf, styleOf } from './data';

const SEEN = 'fok:seen';

/**
 * Deals a game's boards (rule 15, unseen first): groups not seen yet come first, in a random order, then the seen
 * ones. A group is used once a game. When every group in the ticked fields has been seen, they all count as new again.
 */
export async function dealBoards(play: Pick<Play, 'id' | 'settings'>, rand: () => number = Math.random): Promise<Board[]> {
  const n = Math.max(1, Number(play.settings.boards) || 3);
  const pool = poolOf(styleOf(play.settings), tickedFields(play.settings)).map((g) => g.id);
  let seen = new Set((await engine.kv.get<string[]>(SEEN)) ?? []);
  if (pool.every((id) => seen.has(id))) seen = new Set([...seen].filter((id) => !pool.includes(id)));
  // A Beat my score challenge's own groups come first (shell/deal.ts).
  const order = dealFirst(play.settings, [...shuffle(pool.filter((id) => !seen.has(id)), rand), ...shuffle(pool.filter((id) => seen.has(id)), rand)]);
  const used = new Set<string>();
  const boards: Board[] = [];
  for (let i = 0; i < n; i++) {
    const b = buildBoard(groupById, order, rand, used);
    if (!b) break;
    boards.push(b);
    for (const g of b.groups) used.add(g.id);
  }
  await engine.kv.set(SEEN, [...seen, ...used]);
  await keepDeal(play.id, boards.flatMap((b) => b.groups.map((g) => g.id)));
  return boards;
}
