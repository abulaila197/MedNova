// The Silent Artist Solo practice (SA2): draw alone against a 60 s clock, no score. At the reveal the
// player answers "Did you know it?"; Next draws a new disease, Retry the same one on a clean board.
// The session's diseases are listed on the end results with their dossier links (RS1). Nothing feeds Learn (SA1).
import { SA, hashSeed, pickWords, remember, type Word } from './core';

export type SoloPhase = 'drawing' | 'reveal' | 'paused' | 'done';
export type SoloEntry = { wordId: string; knew: boolean | null; timeMs: number };

export type SoloRun = {
  phase: SoloPhase;
  before: 'drawing' | 'reveal' | null;
  fields: string[];
  wordId: string;
  turnMs: number;
  elapsedMs: number;
  runningSince: number | null;
  /** Bumped for every clean board, so the canvas clears. */
  board: number;
  used: string[];
  recent: string[];
  rng: number;
  done: SoloEntry[];
};

export type SoloEvent =
  | { type: 'TICK'; now: number }
  | { type: 'REVEAL'; now: number }
  | { type: 'KNEW'; knew: boolean }
  | { type: 'NEXT'; now: number }
  | { type: 'RETRY'; now: number }
  | { type: 'FINISH' }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number };

export const soloElapsed = (r: SoloRun, now: number) => r.elapsedMs + (r.runningSince == null ? 0 : Math.max(0, now - r.runningSince));
export const soloLeft = (r: SoloRun, now: number) => Math.max(0, r.turnMs - soloElapsed(r, now));

function draw(r: SoloRun, pool: readonly Word[], now: number): SoloRun {
  const [picked, rng] = pickWords(pool, r.rng, { count: 1, used: r.used, recent: r.recent, fields: r.fields });
  const w = picked[0];
  if (!w) return { ...r, rng, phase: 'done' };
  return { ...r, rng, wordId: w.id, phase: 'drawing', elapsedMs: 0, runningSince: now, board: r.board + 1, used: [...r.used, w.id], recent: remember(r.recent, w.id) };
}

export function startSolo(pool: readonly Word[], p: { seed: string; fields: string[]; recent?: string[]; now: number }): SoloRun {
  const base: SoloRun = { phase: 'drawing', before: null, fields: p.fields, wordId: '', turnMs: SA.soloMs, elapsedMs: 0, runningSince: null, board: 0, used: [], recent: p.recent ?? [], rng: hashSeed(p.seed), done: [] };
  return draw(base, pool, p.now);
}

const reveal = (r: SoloRun, now: number): SoloRun => ({ ...r, phase: 'reveal', elapsedMs: Math.min(r.turnMs, soloElapsed(r, now)), runningSince: null, done: [...r.done, { wordId: r.wordId, knew: null, timeMs: Math.min(r.turnMs, soloElapsed(r, now)) }] });

export function stepSolo(r: SoloRun, e: SoloEvent, pool: readonly Word[]): SoloRun {
  switch (e.type) {
    case 'TICK':
      return r.phase === 'drawing' && soloLeft(r, e.now) <= 0 ? reveal(r, e.now) : r;
    case 'REVEAL':
      return r.phase === 'drawing' ? reveal(r, e.now) : r;
    case 'KNEW': {
      if (r.phase !== 'reveal' || !r.done.length) return r;
      const done = r.done.slice();
      done[done.length - 1] = { ...done[done.length - 1], knew: e.knew };
      return { ...r, done };
    }
    case 'NEXT':
      return r.phase === 'reveal' ? draw(r, pool, e.now) : r;
    case 'RETRY':
      // Same disease, clean board and clock; the reveal already counted it once.
      return r.phase === 'reveal' ? { ...r, phase: 'drawing', elapsedMs: 0, runningSince: e.now, board: r.board + 1, done: r.done.slice(0, -1) } : r;
    case 'FINISH':
      return r.phase === 'reveal' || r.phase === 'drawing' ? { ...r, phase: 'done', runningSince: null } : r;
    case 'PAUSE':
      return r.phase === 'drawing' || r.phase === 'reveal' ? { ...r, phase: 'paused', before: r.phase, elapsedMs: soloElapsed(r, e.now), runningSince: null } : r;
    case 'RESUME':
      return r.phase === 'paused' && r.before ? { ...r, phase: r.before, before: null, runningSince: r.before === 'drawing' ? e.now : null } : r;
  }
}
