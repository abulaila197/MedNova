// The Riddler: pure rules for one Solo level (RD3, RD4, RD9-RD11) and the answer search.
// A level is one rebus picture with 3 lives, a stopwatch and an optional paid hint (the definition).

import { indexNames, searchNames, type NameIndex, type Named } from '../shell/names';

export type Kind = 'condition' | 'sign' | 'symptom';

export type Riddle = {
  id: string;
  kind: Kind;
  /** Main name; `aliases` holds at most 2 other names (NL1). */
  answer: string;
  aliases: string[];
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
  /** A retry after a miss in the same session pays as already failed: at most 1 star (missing = 3). */
  maxStars?: number;
};

export type LevelEvent =
  | { type: 'GUESS'; answerId: string; now: number }
  | { type: 'HINT' }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number };

export function startLevel(riddleId: string, now: number, maxStars = 3): Level {
  return { riddleId, phase: 'playing', elapsedMs: 0, runningSince: now, wrong: [], hintUsed: false, timeMs: 0, stars: 0, maxStars };
}

/** The star cap for a level opened now: 1 when this session already missed it (its answer was shown), else 3. */
export const retryCap = (session: readonly { riddleId: string; solved: boolean }[], riddleId: string) =>
  session.some((d) => d.riddleId === riddleId && !d.solved) ? 1 : 3;

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
        return { ...l, phase: 'solved', elapsedMs: t, runningSince: null, timeMs: t, stars: Math.min(l.maxStars ?? 3, starsFor(t, l.wrong.length, l.hintUsed)) };
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

// ---- answer search (NL1: the main name and up to 2 other names; a missing 's doesn't count) ----

export type Answer = Named & { id: string };

const indexes = new WeakMap<readonly Answer[], NameIndex<Answer>>();

/** Nothing until 2 letters; then up to 5: main name prefix, other name prefix, word prefix, then all words. */
export function search(list: readonly Answer[], raw: string, skip: readonly string[] = []): Answer[] {
  let index = indexes.get(list);
  if (!index) indexes.set(list, (index = indexNames(list)));
  return searchNames(index, raw, { min: RD.minQuery, max: RD.maxSuggestions, skip: (a) => skip.includes(a.id) });
}

