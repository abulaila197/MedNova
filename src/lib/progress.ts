// Game progress kept on the account (player_progress): Crossword stars, Riddler bests and Case Files stamps.
// Two phones may each hold some of it, so syncing merges them and the better result always wins.

export const PROGRESS_KEYS = ['crossword:best', 'riddler:best', 'casefiles:played'] as const;
export type ProgressKey = (typeof PROGRESS_KEYS)[number];
type Map = Record<string, unknown>;

/** Best stars per level: the higher number wins. */
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

export function mergeProgress(key: ProgressKey, local: unknown, remote: unknown) {
  const a = (local && typeof local === 'object' ? local : {}) as Map;
  const b = (remote && typeof remote === 'object' ? remote : {}) as Map;
  return key === 'casefiles:played' ? stampMerge(a, b) : maxMerge(a, b);
}

/** Same content regardless of key order. */
export function sameProgress(a: unknown, b: unknown) {
  const norm = (v: unknown) => JSON.stringify(Object.entries((v ?? {}) as Map).sort(([x], [y]) => x.localeCompare(y)));
  return norm(a) === norm(b);
}
