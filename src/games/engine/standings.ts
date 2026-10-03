// Rule 13: higher score first, then faster total time, then the game's own tie-breakers.
import type { Standing } from './types';

export type Row = Omit<Standing, 'rank'>;

export function rank(rows: Row[], gameTieBreak?: (a: Row, b: Row) => number): Standing[] {
  const cmp = (a: Row, b: Row) => b.score - a.score || a.timeMs - b.timeMs || (gameTieBreak?.(a, b) ?? 0);
  const sorted = [...rows].sort(cmp);
  const out: Standing[] = [];
  sorted.forEach((r, i) => {
    const prev = out[i - 1];
    const shared = prev && cmp(sorted[i - 1], r) === 0;
    out.push({ ...r, rank: shared ? prev.rank : i + 1 });
  });
  return out;
}
