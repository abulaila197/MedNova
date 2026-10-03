// Nova Medicordle Solo: a daily word or an endless queue (NM5-NM7), 6 tries, free definition on the last try,
// letter hints in Custom only (NM3, NM23), EXP by guesses used (NM22). The clock is for stats; it pauses and hides (rule 4).
import { MAX_ROWS, soloExp, type Style } from './core';

export type WordResult = {
  wordId: string;
  solved: boolean;
  guesses: string[];
  timeMs: number;
  hints: number;
  exp: number;
};

export type SoloPhase = 'playing' | 'paused' | 'wordOver' | 'done';

export type SoloRun = {
  kind: 'daily' | 'endless';
  style: Style;
  /** Daily: the local day number; null for endless. */
  day: number | null;
  wordIds: string[];
  index: number;
  guesses: string[];
  /** Columns shown by paid hints (NM3). */
  revealed: number[];
  hints: number;
  phase: SoloPhase;
  before: 'playing' | 'wordOver' | null;
  elapsedMs: number;
  runningSince: number | null;
  results: WordResult[];
  score: number;
  /** Bumps on each played guess so the newest row plays its reveal. */
  rowSeq: number;
};

export type SoloEvent =
  | { type: 'GUESS'; word: string; answer: string; now: number }
  | { type: 'HINT_GRANTED'; columns: number[] }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'NEXT'; now: number; more?: string[] }
  | { type: 'FINISH' };

export function startSolo(kind: SoloRun['kind'], style: Style, wordIds: string[], day: number | null, now: number): SoloRun {
  return {
    kind, style, day, wordIds, index: 0, guesses: [], revealed: [], hints: 0, phase: 'playing', before: null,
    elapsedMs: 0, runningSince: now, results: [], score: 0, rowSeq: 0,
  };
}

export const soloElapsed = (r: SoloRun, now: number) => r.elapsedMs + (r.runningSince == null ? 0 : Math.max(0, now - r.runningSince));

/** Saved for resume: always paused, with the clock stopped (rules 7, 10). */
export function snapshotSolo(r: SoloRun, now: number): SoloRun {
  if (r.phase !== 'playing') return r;
  return { ...r, phase: 'paused', before: 'playing', elapsedMs: soloElapsed(r, now), runningSince: null };
}

/** The definition shows on the last try and after the word ends (as coded, NM19 for Custom). */
export const showDefinition = (r: SoloRun) => r.guesses.length >= MAX_ROWS - 1 || r.phase === 'wordOver' || (r.phase === 'paused' && r.before === 'wordOver');

export function stepSolo(r: SoloRun, e: SoloEvent): SoloRun {
  switch (e.type) {
    case 'GUESS': {
      if (r.phase !== 'playing') return r;
      const guesses = [...r.guesses, e.word];
      const solved = e.word === e.answer;
      if (!solved && guesses.length < MAX_ROWS) return { ...r, guesses, rowSeq: r.rowSeq + 1 };
      const timeMs = soloElapsed(r, e.now);
      const exp = soloExp(solved ? guesses.length : null, r.kind === 'daily');
      const res: WordResult = { wordId: r.wordIds[r.index], solved, guesses, timeMs, hints: r.hints, exp };
      return {
        ...r, guesses, rowSeq: r.rowSeq + 1, phase: 'wordOver', elapsedMs: timeMs, runningSince: null,
        results: [...r.results, res], score: r.score + exp,
      };
    }
    case 'HINT_GRANTED':
      if (r.phase !== 'playing' && !(r.phase === 'paused' && r.before === 'playing')) return r;
      return { ...r, hints: r.hints + 1, revealed: [...r.revealed, ...e.columns.filter((c) => !r.revealed.includes(c))] };
    case 'PAUSE':
      if (r.phase === 'playing') return { ...r, phase: 'paused', before: 'playing', elapsedMs: soloElapsed(r, e.now), runningSince: null };
      if (r.phase === 'wordOver') return { ...r, phase: 'paused', before: 'wordOver' };
      return r;
    case 'RESUME':
      if (r.phase !== 'paused') return r;
      return r.before === 'wordOver' ? { ...r, phase: 'wordOver', before: null } : { ...r, phase: 'playing', before: null, runningSince: e.now };
    case 'NEXT': {
      if (r.phase !== 'wordOver') return r;
      if (r.kind === 'daily') return { ...r, phase: 'done' };
      const wordIds = e.more?.length ? [...r.wordIds, ...e.more] : r.wordIds;
      if (r.index + 1 >= wordIds.length) return { ...r, phase: 'done' };
      return { ...r, wordIds, index: r.index + 1, guesses: [], revealed: [], hints: 0, phase: 'playing', elapsedMs: 0, runningSince: e.now };
    }
    case 'FINISH':
      return r.phase === 'wordOver' || (r.phase === 'paused' && r.before === 'wordOver') ? { ...r, phase: 'done', before: null } : r;
  }
}
