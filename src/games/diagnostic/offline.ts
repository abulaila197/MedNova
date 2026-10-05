// Diagnostic Pursuit Offline Multiplayer (pass and play), decisions DPO1-DPO7:
// 2-6 players, each gets their own case every round, 90 s per turn, Solo's scoring and guess rules, no hint.
import type { Play } from '../engine/types';
import { event, finishRecap, lastIndexOf, leadLine, sides, type RecapLine } from '../shell/recap';
import { cluePoints, guess, newAttempt, reveal, speedBonus, type Attempt } from './core';
import type { Row } from '../engine/standings';

export const TURN_MS = 90_000;

export type TurnResult = {
  seat: number;
  round: number;
  caseId: string;
  outcome: 'right' | 'wrong' | 'skipped' | 'timed_out';
  cluesShown: number;
  timeMs: number;
  wrong: string[];
  reveals: number;
  cluePoints: number;
  speedBonus: number;
  points: number;
};

export type OfflinePhase = 'handoff' | 'playing' | 'paused' | 'turnOver' | 'done';

export type OfflineRun = {
  /** Seat numbers in play order, shuffled once at the start (as coded). */
  order: number[];
  rounds: number;
  /** `${round}:${seat}` -> case id: every player has their own case each round (DPO2). */
  cases: Record<string, string>;
  round: number;
  turn: number;
  phase: OfflinePhase;
  before: 'playing' | 'turnOver' | null;
  attempt: Attempt;
  elapsedMs: number;
  runningSince: number | null;
  removed: number[];
  results: TurnResult[];
  wrongSeq: number;
  clueSeq: number;
};

export type OfflineEvent =
  | { type: 'READY'; now: number }
  | { type: 'GUESS'; answerId: string; accepted: boolean; now: number }
  | { type: 'REVEAL' }
  | { type: 'SKIP'; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'NEXT'; now: number }
  | { type: 'REMOVE'; seat: number; now: number };

/** `caseIds` holds rounds x players ids; `order` is the shuffled seat order. */
export function startOffline(order: number[], rounds: number, caseIds: string[]): OfflineRun {
  const cases: Record<string, string> = {};
  for (let r = 0; r < rounds; r++) order.forEach((seat, i) => (cases[`${r}:${seat}`] = caseIds[(r * order.length + i) % caseIds.length]));
  return {
    order, rounds, cases, round: 0, turn: 0, phase: 'handoff', before: null, attempt: newAttempt(),
    elapsedMs: 0, runningSince: null, removed: [], results: [], wrongSeq: 0, clueSeq: 0,
  };
}

export const currentSeat = (r: OfflineRun) => r.order[r.turn];
export const currentCase = (r: OfflineRun) => r.cases[`${r.round}:${currentSeat(r)}`];
export const turnElapsed = (r: OfflineRun, now: number) => Math.min(TURN_MS, r.elapsedMs + (r.runningSince == null ? 0 : Math.max(0, now - r.runningSince)));
export const timeLeft = (r: OfflineRun, now: number) => TURN_MS - turnElapsed(r, now);

/** What to save for resume: a running turn is saved paused at the exact clock (rule 10). */
export function snapshotOffline(r: OfflineRun, now: number): OfflineRun {
  if (r.phase !== 'playing') return r;
  return { ...r, phase: 'paused', before: 'playing', elapsedMs: turnElapsed(r, now), runningSince: null };
}

function close(r: OfflineRun, attempt: Attempt, now: number, outcome: TurnResult['outcome']): OfflineRun {
  const timeMs = outcome === 'timed_out' ? TURN_MS : turnElapsed(r, now);
  const cp = outcome === 'right' ? cluePoints(attempt.cluesShown) : 0;
  const sb = outcome === 'right' ? speedBonus(timeMs) : 0;
  const res: TurnResult = {
    seat: currentSeat(r), round: r.round, caseId: currentCase(r), outcome, cluesShown: attempt.cluesShown, timeMs,
    wrong: attempt.wrong, reveals: attempt.reveals, cluePoints: cp, speedBonus: sb, points: cp + sb,
  };
  return { ...r, attempt, phase: 'turnOver', elapsedMs: timeMs, runningSince: null, results: [...r.results, res] };
}

/** Moves to the next active player's hand-off, the next round, or the end. */
function advance(r: OfflineRun, removed = r.removed): OfflineRun {
  let { round, turn } = r;
  do {
    turn++;
    if (turn >= r.order.length) {
      turn = 0;
      round++;
    }
    if (round >= r.rounds) return { ...r, removed, phase: 'done', before: null, runningSince: null };
  } while (removed.includes(r.order[turn]));
  return { ...r, removed, round, turn, phase: 'handoff', before: null, attempt: newAttempt(), elapsedMs: 0, runningSince: null };
}

export function stepOffline(r: OfflineRun, e: OfflineEvent): OfflineRun {
  switch (e.type) {
    case 'READY':
      return r.phase === 'handoff' ? { ...r, phase: 'playing', runningSince: e.now } : r;
    case 'GUESS': {
      if (r.phase !== 'playing') return r;
      if (timeLeft(r, e.now) <= 0) return close(r, r.attempt, e.now, 'timed_out');
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
    case 'TICK':
      return r.phase === 'playing' && timeLeft(r, e.now) <= 0 ? close(r, { ...r.attempt, status: 'failed' }, e.now, 'timed_out') : r;
    case 'PAUSE':
      if (r.phase === 'playing') return { ...r, phase: 'paused', before: 'playing', elapsedMs: turnElapsed(r, e.now), runningSince: null };
      if (r.phase === 'turnOver') return { ...r, phase: 'paused', before: 'turnOver' };
      return r;
    case 'RESUME':
      if (r.phase !== 'paused') return r;
      return r.before === 'turnOver' ? { ...r, phase: 'turnOver', before: null } : { ...r, phase: 'playing', before: null, runningSince: e.now };
    case 'NEXT':
      return r.phase === 'turnOver' ? advance(r) : r;
    case 'REMOVE': {
      // Rule 17: a removed player's turns are skipped; their finished turns stay on the board.
      if (r.removed.includes(e.seat) || r.order.filter((s) => !r.removed.includes(s)).length <= 2) return r;
      const removed = [...r.removed, e.seat];
      const onTurn = currentSeat(r) === e.seat && r.phase !== 'done';
      const turnFinished = r.phase === 'turnOver' || (r.phase === 'paused' && r.before === 'turnOver');
      if (onTurn && !turnFinished) return advance(r, removed);
      return { ...r, removed };
    }
  }
}

/** One standings row per seat: total points and total turn time (rule 13), plus DP's own tie-breakers. */
export function offlineRows(r: OfflineRun, names: Record<number, string>): (Row & { speed: number; wrong: number })[] {
  return r.order.map((seat) => {
    const mine = r.results.filter((x) => x.seat === seat);
    return {
      seat,
      name: names[seat] ?? `Player ${seat + 1}`,
      score: mine.reduce((a, x) => a + x.points, 0),
      timeMs: mine.reduce((a, x) => a + x.timeMs, 0),
      speed: mine.reduce((a, x) => a + x.speedBonus, 0),
      wrong: mine.reduce((a, x) => a + x.wrong.length, 0),
    };
  });
}

/** Ties as coded: more speed bonus, then fewer wrong guesses. */
export const dpTieBreak = (a: { speed: number; wrong: number }, b: { speed: number; wrong: number }) => b.speed - a.speed || a.wrong - b.wrong;

/** OF1: what happened since `seat` last played: each solved or missed case with its points, then a lead change. */
export function offlineRecap(r: OfflineRun, seat: number, play: Pick<Play, 'seats' | 'settings'>): RecapLine[] {
  const last = lastIndexOf(r.results, seat);
  const since = r.results.slice(last + 1);
  if (!since.length) return [];
  const seatOf = new Map(play.seats.map((x) => [x.seat, x]));
  const events = since.map((x, i) =>
    event(`dp-${last + 1 + i}`, x.seat, seatOf.get(x.seat), x.outcome === 'right' ? `solved the case · +${x.points}` : x.outcome === 'timed_out' ? 'ran out of time' : 'missed the case'),
  );
  const scores = (rs: TurnResult[]) => r.order.map((s) => ({ seat: s, score: rs.filter((x) => x.seat === s).reduce((a, x) => a + x.points, 0) }));
  return finishRecap(events, leadLine(sides(scores(r.results.slice(0, last + 1)), play), sides(scores(r.results), play)));
}
