// The Riddler: pure rules for one Solo level (RD3, RD4, RD9-RD11) and the answer search.
// A level is one rebus picture with 3 lives, a stopwatch and an optional paid hint (the definition).

export type Kind = 'condition' | 'sign' | 'symptom';

export type Riddle = {
  id: string;
  kind: Kind;
  answer: string;
  definition: string;
  /** Canonical dossier id; only condition riddles link one (RD1). */
  dossier: string | null;
  /** Picture size in pixels: the print takes this shape, never cropped (RD14). */
  w: number;
  h: number;
  file: string;
};

export const RD = {
  lives: 3,
  /** RD4: 3 stars = 30 s or less and 0 wrong; 2 stars = 60 s or less and at most 1 wrong; any other solve = 1. */
  star3Ms: 30_000,
  star2Ms: 60_000,
  /** RD9: 4 EXP per star. */
  expPerStar: 4,
  hintPrice: 1, // as coded: 1 token shows the definition
  /** Answer box (as coded): suggestions from 2 letters, up to 5. */
  minQuery: 2,
  maxSuggestions: 5,
};

export type LevelPhase = 'playing' | 'paused' | 'solved' | 'failed';

export type Level = {
  riddleId: string;
  phase: LevelPhase;
  elapsedMs: number;
  runningSince: number | null;
  /** Wrong answer ids in order; a repeated wrong pick is ignored and costs nothing (as coded). */
  wrong: string[];
  hintUsed: boolean;
  timeMs: number;
  stars: number;
};

export type LevelEvent =
  | { type: 'GUESS'; answerId: string; now: number }
  | { type: 'HINT' }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number };

export function startLevel(riddleId: string, now: number): Level {
  return { riddleId, phase: 'playing', elapsedMs: 0, runningSince: now, wrong: [], hintUsed: false, timeMs: 0, stars: 0 };
}

export const levelTime = (l: Level, now: number) => l.elapsedMs + (l.runningSince == null ? 0 : Math.max(0, now - l.runningSince));
export const livesLeft = (l: Level) => RD.lives - l.wrong.length;

/** RD4, with the hint capping the level at 2 stars. */
export function starsFor(timeMs: number, wrong: number, hintUsed: boolean) {
  const s = timeMs <= RD.star3Ms && wrong === 0 ? 3 : timeMs <= RD.star2Ms && wrong <= 1 ? 2 : 1;
  return hintUsed ? Math.min(2, s) : s;
}

/** RD9 + RD10: a first solve earns 4 per star; a replay earns only the stars above the best so far. */
export const levelExp = (stars: number, best: number) => RD.expPerStar * Math.max(0, stars - best);

export function stepLevel(l: Level, e: LevelEvent): Level {
  switch (e.type) {
    case 'GUESS': {
      if (l.phase !== 'playing' || l.wrong.includes(e.answerId)) return l;
      const t = levelTime(l, e.now);
      if (e.answerId === l.riddleId) {
        return { ...l, phase: 'solved', elapsedMs: t, runningSince: null, timeMs: t, stars: starsFor(t, l.wrong.length, l.hintUsed) };
      }
      const wrong = [...l.wrong, e.answerId];
      if (wrong.length >= RD.lives) return { ...l, wrong, phase: 'failed', elapsedMs: t, runningSince: null, timeMs: t, stars: 0 };
      return { ...l, wrong };
    }
    case 'HINT':
      return l.phase === 'playing' && !l.hintUsed ? { ...l, hintUsed: true } : l;
    case 'PAUSE':
      return l.phase === 'playing' ? { ...l, phase: 'paused', elapsedMs: levelTime(l, e.now), runningSince: null } : l;
    case 'RESUME':
      return l.phase === 'paused' ? { ...l, phase: 'playing', runningSince: e.now } : l;
  }
}

/** Saved for resume: a running level is saved paused at the exact clock (rule 10). */
export const snapshotLevel = (l: Level, now: number) => (l.phase === 'playing' ? stepLevel(l, { type: 'PAUSE', now }) : l);

// ---- answer search (as coded: a flat list, label prefix first) ----

export type Answer = { id: string; label: string };

export function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nothing until 2 letters; then up to 5: label prefix, then a word prefix (inside brackets too), then all words. */
export function search(list: readonly Answer[], raw: string, skip: readonly string[] = []): Answer[] {
  const q = normalize(raw);
  if (q.replace(/\s/g, '').length < RD.minQuery) return [];
  const tokens = q.split(' ');
  const hits: { a: Answer; n: string; s: number }[] = [];
  for (const a of list) {
    if (skip.includes(a.id)) continue;
    const n = normalize(a.label);
    const s = n.startsWith(q) ? 0 : (' ' + n).includes(' ' + q) ? 1 : tokens.every((t) => n.includes(t)) ? 2 : -1;
    if (s >= 0) hits.push({ a, n, s });
  }
  hits.sort((x, y) => x.s - y.s || x.n.length - y.n.length || x.n.localeCompare(y.n));
  return hits.slice(0, RD.maxSuggestions).map((h) => h.a);
}

export function shuffle<T>(a: readonly T[], rng: () => number = Math.random): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
