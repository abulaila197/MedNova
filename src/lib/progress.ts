// Progress kept on the account (player_progress): Crossword stars, Riddler bests, Case Files stamps, Streak bests and
// Learn review. Two phones may each hold some of it, so syncing merges them and the better result always wins.

export const PROGRESS_KEYS = [
  'crossword:best', 'riddler:best', 'casefiles:played', 'streak:best', 'learn:review', 'learn:opened',
  // GA5: needs migration 20261019000200 (player_progress_key_check) applied first.
  'medicordle:endless:paid', 'medicordle:streak:classic', 'medicordle:streak:custom',
] as const;
export type ProgressKey = (typeof PROGRESS_KEYS)[number];
type Map = Record<string, unknown>;

const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}) as Map;
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Best per level or per Streak style and length: the higher number wins. */
function maxMerge(a: Map, b: Map) {
  const out: Record<string, number> = {};
  for (const [k, v] of [...Object.entries(a), ...Object.entries(b)]) if (typeof v === 'number') out[k] = Math.max(out[k] ?? v, v);
  return out;
}

/** Case Files stamps: a case solved on either phone stays SOLVED; otherwise CLOSED. */
function stampMerge(a: Map, b: Map) {
  const out: Record<string, string> = {};
  for (const [k, v] of [...Object.entries(a), ...Object.entries(b)])
    if (v === 'SOLVED' || v === 'CLOSED') out[k] = out[k] === 'SOLVED' || v === 'SOLVED' ? 'SOLVED' : 'CLOSED';
  return out;
}

/** Today's review: the latest Got it per card wins; cards sent back with Again stay at the end (this phone's order first). */
function reviewMerge(a: Map, b: Map) {
  const later = strs(a.later);
  for (const k of strs(b.later)) if (!later.includes(k)) later.push(k);
  return { done: maxMerge(obj(a.done), obj(b.done)), later };
}

/** Medicordle Daily streak: the side that played the later day keeps its current run (the same day: the longer
 *  run); the best is the higher of both. */
function streakMerge(a: Map, b: Map) {
  const day = (m: Map) => (typeof m.lastDay === 'number' ? m.lastDay : -1);
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);
  if (!Object.keys(a).length || !Object.keys(b).length) return Object.keys(a).length ? a : b;
  const pick = day(a) !== day(b) ? (day(a) > day(b) ? a : b) : num(a.current) >= num(b.current) ? a : b;
  return { current: num(pick.current), best: Math.max(num(a.best), num(b.best), num(pick.current)), lastDay: day(pick) < 0 ? null : day(pick) };
}

export function mergeProgress(key: ProgressKey, local: unknown, remote: unknown): unknown {
  // Opened Learn cards and Endless words that already paid EXP: either phone's list counts.
  if (key === 'learn:opened' || key === 'medicordle:endless:paid') return [...new Set([...strs(local), ...strs(remote)])].sort();
  const a = obj(local);
  const b = obj(remote);
  if (key === 'medicordle:streak:classic' || key === 'medicordle:streak:custom') return streakMerge(a, b);
  if (key === 'casefiles:played') return stampMerge(a, b);
  if (key === 'learn:review') return reviewMerge(a, b);
  return maxMerge(a, b);
}

/** Nothing worth saving yet. */
export function emptyProgress(v: unknown) {
  if (Array.isArray(v)) return !v.length;
  const m = obj(v);
  return 'done' in m ? !Object.keys(obj(m.done)).length && !strs(m.later).length : !Object.keys(m).length;
}

/** Same content regardless of object key order (array order counts). */
export function sameProgress(a: unknown, b: unknown) {
  const norm = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(norm) : v && typeof v === 'object' ? Object.entries(v).sort(([x], [y]) => x.localeCompare(y)).map(([k, x]) => [k, norm(x)]) : v ?? null;
  return JSON.stringify(norm(a ?? {})) === JSON.stringify(norm(b ?? {}));
}
