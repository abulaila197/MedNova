// The Streak Master Offline (pass and play, SM5, SM13): each player plays their own timed round, one
// after another, on their own questions: no one plays a question another player already played (watching doesn't help). No helpers, no EXP;
// the phone owner's misses still go to Learn. Turn order is shuffled once, or teams alternate (TM5).
import { startRound, stepRound, snapshotRound, type PlayerRound, type Rng, type Round, type RoundEvent } from './core';
import type { Row } from '../engine/standings';
import type { Play } from '../engine/types';
import { event, finishRecap, lastIndexOf, leadLine, sides, type RecapLine } from '../shell/recap';

export const POOL_SIZE = 120; // questions per player (as coded)
export const COUNTDOWN_MS = 3000; // "Get ready" before each round (as coded)

export type OfflinePhase = 'handoff' | 'countdown' | 'playing' | 'paused' | 'turnOver' | 'done';

export type Finished = PlayerRound & { answers: Round['answers'] };

export type OfflineRun = {
  order: number[];
  turn: number;
  /** Each turn's own questions, by turn index (SM5: no question is shared between players). */
  pools: string[][];
  lengthSec: number;
  round: Round | null;
  countdownUntil: number | null;
  phase: OfflinePhase;
  before: 'handoff' | 'countdown' | 'playing' | 'turnOver' | null;
  removed: number[];
  results: Finished[];
};

export type OfflineEvent =
  | { type: 'READY'; now: number }
  | { type: 'ROUND'; e: RoundEvent }
  | { type: 'TICK'; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'NEXT' }
  | { type: 'REMOVE'; seat: number };

/** Deals `pool` into one disjoint slice per turn, round-robin, so a mixed pool stays mixed in every slice. */
export function dealPools(pool: string[], players: number): string[][] {
  const size = Math.floor(pool.length / Math.max(1, players));
  return Array.from({ length: players }, (_, i) => Array.from({ length: size }, (_, k) => pool[i + k * players]));
}

export function startOffline(order: number[], pool: string[], lengthSec: number): OfflineRun {
  return { order, turn: 0, pools: dealPools(pool, order.length), lengthSec, round: null, countdownUntil: null, phase: 'handoff', before: null, removed: [], results: [] };
}

export const currentSeat = (r: OfflineRun) => r.order[r.turn];

/** Next turn index for a seat still playing, or the end. */
function advance(r: OfflineRun, from: number): OfflineRun {
  let turn = from;
  while (turn < r.order.length && r.removed.includes(r.order[turn])) turn++;
  if (turn >= r.order.length) return { ...r, turn, round: null, phase: 'done', before: null };
  return { ...r, turn, round: null, countdownUntil: null, phase: 'handoff', before: null };
}

function closeTurn(r: OfflineRun, round: Round): OfflineRun {
  const res: Finished = {
    seat: currentSeat(r), score: round.score, maxStreak: round.maxStreak,
    correct: round.answers.filter((a) => a.outcome === 'right').length, answers: round.answers,
  };
  return { ...r, round, phase: 'turnOver', before: null, results: [...r.results, res] };
}

export function stepOffline(r: OfflineRun, e: OfflineEvent, answerOf: (id: string) => number, rng: Rng = Math.random): OfflineRun {
  switch (e.type) {
    case 'READY':
      return r.phase === 'handoff' ? { ...r, phase: 'countdown', countdownUntil: e.now + COUNTDOWN_MS } : r;
    case 'TICK': {
      if (r.phase === 'countdown' && r.countdownUntil != null && e.now >= r.countdownUntil) {
        return { ...r, phase: 'playing', countdownUntil: null, round: startRound(r.pools[r.turn], r.lengthSec, e.now, rng) };
      }
      if (r.phase !== 'playing' || !r.round) return r;
      const round = stepRound(r.round, e, answerOf, rng);
      if (round === r.round) return r;
      return round.phase === 'over' ? closeTurn(r, round) : { ...r, round };
    }
    case 'ROUND': {
      if (r.phase !== 'playing' || !r.round || e.e.type === 'HELPER') return r; // no helpers offline (SM5)
      const round = stepRound(r.round, e.e, answerOf, rng);
      if (round === r.round) return r;
      return round.phase === 'over' ? closeTurn(r, round) : { ...r, round };
    }
    case 'PAUSE':
      if (r.phase === 'playing' && r.round) return { ...r, phase: 'paused', before: 'playing', round: snapshotRound(r.round, e.now) };
      if (r.phase === 'countdown' && r.countdownUntil != null) return { ...r, phase: 'paused', before: 'countdown', countdownUntil: r.countdownUntil - e.now };
      if (r.phase === 'handoff' || r.phase === 'turnOver') return { ...r, phase: 'paused', before: r.phase };
      return r;
    case 'RESUME': {
      if (r.phase !== 'paused' || !r.before) return r;
      if (r.before === 'playing' && r.round) return { ...r, phase: 'playing', before: null, round: stepRound(r.round, { type: 'RESUME', now: e.now }, answerOf, rng) };
      if (r.before === 'countdown') return { ...r, phase: 'countdown', before: null, countdownUntil: e.now + Math.max(0, r.countdownUntil ?? 0) };
      return { ...r, phase: r.before, before: null };
    }
    case 'NEXT':
      return r.phase === 'turnOver' ? advance(r, r.turn + 1) : r;
    case 'REMOVE': {
      // Rule 17: a removed player's turn is skipped; at least 2 players stay. A round they were playing is dropped.
      const left = r.order.filter((s) => !r.removed.includes(s));
      if (r.removed.includes(e.seat) || left.length <= 2 || r.phase === 'done') return r;
      const removed = [...r.removed, e.seat];
      const results = r.results.filter((x) => x.seat !== e.seat);
      const theirs = currentSeat(r) === e.seat && r.phase !== 'turnOver' && !(r.phase === 'paused' && r.before === 'turnOver');
      const next = { ...r, removed, results };
      if (!theirs) return next;
      const moved = advance(next, r.turn + 1);
      return r.phase === 'paused' && moved.phase !== 'done' ? { ...moved, phase: 'paused', before: 'handoff' } : moved;
    }
  }
}

/** Saved for resume (rule 10). */
export function snapshotOffline(r: OfflineRun, now: number): OfflineRun {
  return r.phase === 'playing' || r.phase === 'countdown' ? stepOffline(r, { type: 'PAUSE', now }, () => -1) : r;
}

/** Standings: score; every round is the same length, so ties go to longest streak, then most right (as coded). */
export function offlineRows(r: OfflineRun, names: Record<number, string>): (Row & PlayerRound)[] {
  return r.order
    .filter((seat) => !r.removed.includes(seat))
    .map((seat) => {
      const x = r.results.find((y) => y.seat === seat);
      return { seat, name: names[seat] ?? `Player ${seat + 1}`, score: x?.score ?? 0, timeMs: 0, maxStreak: x?.maxStreak ?? 0, correct: x?.correct ?? 0 };
    });
}

/** OF1: what happened since `seat` last played: each finished round's score and best streak, then a lead change. */
export function offlineRecap(r: OfflineRun, seat: number, play: Pick<Play, 'seats' | 'settings'>): RecapLine[] {
  const last = lastIndexOf(r.results, seat);
  const since = r.results.slice(last + 1);
  if (!since.length) return [];
  const seatOf = new Map(play.seats.map((x) => [x.seat, x]));
  const events = since.map((x, i) => event(`sm-${last + 1 + i}`, x.seat, seatOf.get(x.seat), `scored ${x.score} · best streak ${x.maxStreak}`));
  const scores = (rs: Finished[]) => r.order.map((s) => ({ seat: s, score: rs.filter((x) => x.seat === s).reduce((a, x) => a + x.score, 0) }));
  return finishRecap(events, leadLine(sides(scores(r.results.slice(0, last + 1)), play), sides(scores(r.results), play)));
}
