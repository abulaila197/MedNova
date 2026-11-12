// Four of a Kind (Yazan's cards, 2026-11-12): 16 boxes, find the 4 groups of 4. Pure rules, run in node tests.
//
// A board takes 4 groups from the bank (1 easy, 2 medium, 1 hard) and 4 random boxes from each. Two groups that
// share a box (or nearly the same box, see the clash list) never meet on one board. You tap up to 4 boxes and submit:
// four from one group locks the group in; three from one group says "One away". 3 hearts a board; out of hearts, one
// token buys 1 heart once, otherwise the board shows its answers. When three groups are found the last one falls
// into place. Points: easy 1, medium 2, hard 3, minus 1 a mistake and 2 for the topic hint, 0 to 8 a board.

export type Level = 1 | 2 | 3;
/** One group (connection) in the bank: name, one-line explanation, field, level, 8+ boxes with a note each, clashes. */
export type Group = { id: string; n: string; l: string; f: string; lv: Level; b: [string, string][]; x: string[] };

/** A board: 4 groups (in slot order: easy, medium, medium, hard) and the 4 boxes shown from each. */
export type Board = { groups: { id: string; boxes: number[] }[] };
/** Tile t (0..15) is box `t % 4` of group `floor(t / 4)` on the board. */
export const groupOfTile = (t: number) => Math.floor(t / 4);

export const FOK = {
  hearts: 3,
  /** The token's second chance: hearts given back, and its price in tokens. */
  tokenHearts: 1,
  tokenPrice: 1,
  revealCost: 2,
  maxPoints: 8,
  /** The slots on every board, by level. */
  slots: [1, 2, 2, 3] as Level[],
  /** Boards per game in setup. */
  boards: [1, 3, 5],
  /** Clock per board in minutes (0 = no time). */
  clocks: [0, 1, 2, 3],
};

export const levelPoints = (lv: Level) => lv;
export const LEVEL_NAME: Record<Level, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

type Rand = () => number;
export function shuffle<T>(xs: readonly T[], r: Rand): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Picks one board. `order` lists group ids best first (unseen first, from the picker); groups in `avoid` (used on an
 * earlier board of this game) come last. Each slot takes its level when it can, else the nearest level, and never a
 * group that clashes with one already on the board. Wordplay only ever fills the hard slot.
 */
export function buildBoard(bank: ReadonlyMap<string, Group>, order: readonly string[], r: Rand, avoid: ReadonlySet<string> = new Set()): Board | null {
  const ids = [...order.filter((id) => !avoid.has(id)), ...order.filter((id) => avoid.has(id))].filter((id) => bank.has(id));
  const chosen: Group[] = [];
  const fits = (g: Group, slot: Level) => (g.f === 'wordplay' ? slot === 3 : true);
  const free = (g: Group) => !chosen.some((c) => c.id === g.id || c.x.includes(g.id) || g.x.includes(c.id));
  for (const slot of FOK.slots) {
    const tries: Level[] = slot === 1 ? [1, 2, 3] : slot === 2 ? [2, 1, 3] : [3, 2, 1];
    let got: Group | undefined;
    for (const lv of tries) {
      got = ids.map((id) => bank.get(id)!).find((g) => g.lv === lv && fits(g, slot) && free(g));
      if (got) break;
    }
    // A pool of only wordplay (or too few groups): any free group will do.
    got ??= ids.map((id) => bank.get(id)!).find(free);
    if (!got) return null;
    chosen.push(got);
  }
  return { groups: chosen.map((g) => ({ id: g.id, boxes: shuffle(g.b.map((_, i) => i), r).slice(0, 4).sort((a, b) => a - b) })) };
}

/** The 16 tiles in a fresh random order. */
export const dealOrder = (r: Rand) => shuffle(Array.from({ length: 16 }, (_, i) => i), r);

export type Phase = 'play' | 'out' | 'done';
/** One player's go at one board. */
export type BoardRun = {
  /** Tiles still on the table, in their shown order. */
  order: number[];
  /** Group slots found, in the order they were found (the last one may have fallen into place: `auto`). */
  found: number[];
  auto: number | null;
  hearts: number;
  mistakes: number;
  /** Wrong picks so far (sorted tiles joined), so the same wrong four costs nothing twice. */
  tried: string[];
  /** The group whose topic the hint showed, or null. */
  revealed: number | null;
  /** The token heart was used on this board. */
  token: boolean;
  phase: Phase;
  /** Every group found. */
  solved: boolean;
};

export const startRun = (r: Rand): BoardRun => ({ order: dealOrder(r), found: [], auto: null, hearts: FOK.hearts, mistakes: 0, tried: [], revealed: null, token: false, phase: 'play', solved: false });

export type Verdict = 'right' | 'wrong' | 'oneAway' | 'repeat' | 'ignored';

/** The tiles of one group slot on the board. */
export const tilesOf = (slot: number) => [0, 1, 2, 3].map((k) => slot * 4 + k);

/** Submits 4 tiles. */
export function submit(run: BoardRun, tiles: number[]): { run: BoardRun; verdict: Verdict; group?: number } {
  if (run.phase !== 'play' || tiles.length !== 4 || new Set(tiles).size !== 4 || tiles.some((t) => !run.order.includes(t))) return { run, verdict: 'ignored' };
  const counts = [0, 0, 0, 0];
  for (const t of tiles) counts[groupOfTile(t)]++;
  const best = Math.max(...counts);
  if (best === 4) {
    const g = counts.indexOf(4);
    let next: BoardRun = { ...run, found: [...run.found, g], order: run.order.filter((t) => groupOfTile(t) !== g) };
    if (next.found.length === 3) {
      // The last four fall into place.
      const last = [0, 1, 2, 3].find((s) => !next.found.includes(s))!;
      next = { ...next, found: [...next.found, last], auto: last, order: [] };
    }
    if (next.found.length === 4) next = { ...next, phase: 'done', solved: true };
    return { run: next, verdict: 'right', group: g };
  }
  const key = [...tiles].sort((a, b) => a - b).join(',');
  if (run.tried.includes(key)) return { run, verdict: 'repeat' };
  const hearts = run.hearts - 1;
  const next: BoardRun = { ...run, hearts, mistakes: run.mistakes + 1, tried: [...run.tried, key], phase: hearts > 0 ? 'play' : run.token ? 'done' : 'out' };
  return { run: next, verdict: best === 3 ? 'oneAway' : 'wrong' };
}

/** The token's second chance: one heart back, once a board. */
export const buyHeart = (run: BoardRun): BoardRun => (run.phase === 'out' && !run.token ? { ...run, phase: 'play', hearts: FOK.tokenHearts, token: true } : run);
/** No token (or the clock ran out): the board ends and shows its answers. */
export const endRun = (run: BoardRun): BoardRun => (run.phase === 'done' ? run : { ...run, phase: 'done' });

/** The hint: shows the topic of the easiest group not found yet (once a board, 2 points). */
export function reveal(run: BoardRun): BoardRun {
  if (run.phase !== 'play' || run.revealed != null) return run;
  const slot = [0, 1, 2, 3].find((s) => !run.found.includes(s));
  return slot == null ? run : { ...run, revealed: slot };
}

/** Moves the remaining tiles around (Shuffle). */
export const reshuffle = (run: BoardRun, r: Rand): BoardRun => ({ ...run, order: shuffle(run.order, r) });

/** A board's points: found groups by level, minus mistakes and the hint, 0 to 8. */
export function boardPoints(board: Board, bank: ReadonlyMap<string, Group>, run: BoardRun): number {
  const raw = run.found.reduce((a, s) => a + levelPoints(bank.get(board.groups[s].id)!.lv), 0) - run.mistakes - (run.revealed != null ? FOK.revealCost : 0);
  return Math.max(0, Math.min(FOK.maxPoints, raw));
}

/** Stars: 3 with no heart lost, 2 with one or two lost, 1 when solved with the token heart, 0 unsolved. */
export const boardStars = (run: BoardRun) => (!run.solved ? 0 : run.token ? 1 : run.mistakes === 0 ? 3 : 2);

/** Ranking for ties (Yazan): more points, then fewer mistakes, then faster; equal on all three shares the place. */
export function rankRows<T extends { points: number; mistakes: number; ms: number }>(rows: T[]): (T & { rank: number })[] {
  const cmp = (a: T, b: T) => b.points - a.points || a.mistakes - b.mistakes || a.ms - b.ms;
  const sorted = [...rows].sort(cmp);
  const out: (T & { rank: number })[] = [];
  sorted.forEach((r, i) => out.push({ ...r, rank: i > 0 && cmp(sorted[i - 1], r) === 0 ? out[i - 1].rank : i + 1 }));
  return out;
}
