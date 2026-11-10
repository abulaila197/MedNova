import { botNamed } from './core';
import { rivalOfDay } from './daily';
import { grownLevel, rivalOf } from './memory';
import { type BoardLike, type BoardRow, mergeBoard, passingNames, type Period, periodKey, rivalExp } from './boardMath';
import type { Bot } from './types';

export { isRivalRow } from './boardMath';

/**
 * Rivals on the leaderboard (G6): your regulars and favourites, the rival of the day and a few passing rivals sit among
 * the real players with EXP of their own, fixed per week, month and game, so the board reads the same each time.
 */
export function withRivals(board: BoardLike, o: { period: Period; game: string | null; userId: string | null; met: Record<string, number>; known: string[]; day?: string }): BoardLike {
  const key = periodKey(o.period, o.day);
  const seen = new Set<string>();
  const bots: Bot[] = [];
  const add = (b: Bot | null) => {
    if (b && !seen.has(b.id)) {
      seen.add(b.id);
      bots.push(b);
    }
  };
  for (const id of o.known) add(rivalOf(id));
  add(rivalOfDay(o.day).bot);
  for (const p of passingNames(key, o.game)) add(botNamed(p.type, p.name));
  const rows: BoardRow[] = bots.map((b) => {
    const level = grownLevel(b, o.met);
    return { rank: 0, id: b.id, name: b.name, level, exp: rivalExp(b.id, b.type, level, o.period, key, o.game), avatar: b.character };
  });
  return mergeBoard(board, rows, o.userId);
}
