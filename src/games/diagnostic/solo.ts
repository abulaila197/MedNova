// Diagnostic Pursuit solo run: a set of cases (DP5), no retry (DP6), stopwatch per case that pauses and hides (rule 4).
import { cluePoints, guess, newAttempt, reveal, speedBonus, type Attempt } from './core';

export type CaseResult = {
  caseId: string;
  outcome: 'right' | 'wrong' | 'skipped';
  cluesShown: number;
  timeMs: number;
  wrong: string[];
  reveals: number;
  hint: boolean;
  cluePoints: number;
  speedBonus: number;
  points: number;
};

export type Phase = 'playing' | 'paused' | 'caseOver' | 'done';

export type SoloRun = {
  caseIds: string[];
  index: number;
  phase: Phase;
  /** The phase to go back to on resume. */
  before: 'playing' | 'caseOver' | null;
  attempt: Attempt;
  hint: boolean;
  elapsedMs: number;
  runningSince: number | null;
  results: CaseResult[];
  score: number;
  /** Bumps on each wrong guess (shake) and each new clue (flip). */
  wrongSeq: number;
  clueSeq: number;
};

export type SoloEvent =
  | { type: 'GUESS'; answerId: string; accepted: boolean; now: number }
  | { type: 'REVEAL' }
  | { type: 'SKIP'; now: number }
  | { type: 'HINT_GRANTED' }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'NEXT'; now: number };

export function startRun(caseIds: string[], now: number): SoloRun {
  return {
    caseIds, index: 0, phase: 'playing', before: null, attempt: newAttempt(), hint: false,
    elapsedMs: 0, runningSince: now, results: [], score: 0, wrongSeq: 0, clueSeq: 0,
  };
}

export const elapsed = (r: SoloRun, now: number) => r.elapsedMs + (r.runningSince == null ? 0 : Math.max(0, now - r.runningSince));

/** What to save for resume: always paused, with the clock stopped at `now` (rule 10). */
export function snapshot(r: SoloRun, now: number): SoloRun {
  if (r.phase !== 'playing') return r;
  return { ...r, phase: 'paused', before: 'playing', elapsedMs: elapsed(r, now), runningSince: null };
}

function close(r: SoloRun, attempt: Attempt, now: number, outcome: CaseResult['outcome']): SoloRun {
  const timeMs = elapsed(r, now);
  const cp = outcome === 'right' ? cluePoints(attempt.cluesShown) : 0;
  const sb = outcome === 'right' ? speedBonus(timeMs) : 0;
  const res: CaseResult = {
    caseId: r.caseIds[r.index], outcome, cluesShown: attempt.cluesShown, timeMs, wrong: attempt.wrong,
    reveals: attempt.reveals, hint: r.hint, cluePoints: cp, speedBonus: sb, points: cp + sb,
  };
  return { ...r, attempt, phase: 'caseOver', elapsedMs: timeMs, runningSince: null, results: [...r.results, res], score: r.score + res.points };
}

export function step(r: SoloRun, e: SoloEvent): SoloRun {
  switch (e.type) {
    case 'GUESS': {
      if (r.phase !== 'playing') return r;
      const { attempt, outcome } = guess(r.attempt, e.answerId, e.accepted);
      if (outcome === 'ignored') return r;
      if (outcome === 'correct') return close(r, attempt, e.now, 'right');
      if (outcome === 'wrong_out') return close({ ...r, wrongSeq: r.wrongSeq + 1 }, attempt, e.now, 'wrong');
      return { ...r, attempt, wrongSeq: r.wrongSeq + 1, clueSeq: r.clueSeq + (attempt.cluesShown > r.attempt.cluesShown ? 1 : 0) };
    }
    case 'REVEAL': {
      if (r.phase !== 'playing') return r;
      const attempt = reveal(r.attempt);
      return attempt === r.attempt ? r : { ...r, attempt, clueSeq: r.clueSeq + 1 };
    }
    case 'SKIP':
      return r.phase === 'playing' ? close(r, { ...r.attempt, status: 'skipped' }, e.now, 'skipped') : r;
    case 'HINT_GRANTED':
      return r.phase === 'playing' || r.phase === 'paused' ? (r.hint ? r : { ...r, hint: true }) : r;
    case 'PAUSE':
      if (r.phase === 'playing') return { ...r, phase: 'paused', before: 'playing', elapsedMs: elapsed(r, e.now), runningSince: null };
      if (r.phase === 'caseOver') return { ...r, phase: 'paused', before: 'caseOver' };
      return r;
    case 'RESUME':
      if (r.phase !== 'paused') return r;
      return r.before === 'caseOver' ? { ...r, phase: 'caseOver', before: null } : { ...r, phase: 'playing', before: null, runningSince: e.now };
    case 'NEXT': {
      if (r.phase !== 'caseOver') return r;
      if (r.index + 1 >= r.caseIds.length) return { ...r, phase: 'done' };
      return { ...r, index: r.index + 1, phase: 'playing', attempt: newAttempt(), hint: false, elapsedMs: 0, runningSince: e.now };
    }
  }
}
