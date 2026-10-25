// The Quiz Parade Pass the phone (QP10, Yazan 2026-10-25): each player answers the whole set in one turn, then
// passes the phone. Everyone gets the same questions in their own order. Closest number goes to the nearest guess
// once every player has answered (QP6), so it scores nothing during a turn. No helpers; no EXP, like every Pass
// the phone mode; only the phone owner's misses go to Learn. Turn order is shuffled once, or teams alternate (TM5).
import { shuffle } from '../engine/random';
import type { Row } from '../engine/standings';
import type { Play } from '../engine/types';
import { event, finishRecap, lastIndexOf, leadLine, sides, type RecapLine } from '../shell/recap';
import { nearestSeats, POINTS, snapshotRound, startRound, stepRound, type Answer, type Question, type Round, type RoundEvent } from './core';

export const COUNTDOWN_MS = 3000; // "Get ready" before each turn, as in The Streak Master

type Bank = (id: string) => Question | undefined;

export type OfflinePhase = 'handoff' | 'countdown' | 'playing' | 'paused' | 'turnOver' | 'done';

export type Finished = { seat: number; score: number; answers: Answer[] };

export type OfflineRun = {
  order: number[];
  turn: number;
  /** Each turn's order of the same questions, by turn index. */
  queues: string[][];
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

export function startOffline(order: number[], questions: string[], rng: () => number = Math.random): OfflineRun {
  return { order, turn: 0, queues: order.map(() => shuffle(questions, rng)), round: null, countdownUntil: null, phase: 'handoff', before: null, removed: [], results: [] };
}

export const currentSeat = (r: OfflineRun) => r.order[r.turn];

function advance(r: OfflineRun, from: number): OfflineRun {
  let turn = from;
  while (turn < r.order.length && r.removed.includes(r.order[turn])) turn++;
  if (turn >= r.order.length) return { ...r, turn, round: null, phase: 'done', before: null };
  return { ...r, turn, round: null, countdownUntil: null, phase: 'handoff', before: null };
}

const closeTurn = (r: OfflineRun, round: Round): OfflineRun => ({
  ...r, round, phase: 'turnOver', before: null, results: [...r.results, { seat: currentSeat(r), score: round.score, answers: round.answers }],
});

export function stepOffline(r: OfflineRun, e: OfflineEvent, bank: Bank, rng: () => number = Math.random): OfflineRun {
  switch (e.type) {
    case 'READY':
      return r.phase === 'handoff' ? { ...r, phase: 'countdown', countdownUntil: e.now + COUNTDOWN_MS } : r;
    case 'TICK': {
      if (r.phase === 'countdown' && r.countdownUntil != null && e.now >= r.countdownUntil) {
        return { ...r, phase: 'playing', countdownUntil: null, round: startRound(r.queues[r.turn], e.now, bank, rng, true) };
      }
      if (r.phase !== 'playing' || !r.round) return r;
      const round = stepRound(r.round, e, bank, rng);
      if (round === r.round) return r;
      return round.phase === 'over' ? closeTurn(r, round) : { ...r, round };
    }
    case 'ROUND': {
      if (r.phase !== 'playing' || !r.round || e.e.type === 'HELPER') return r; // no helpers in Pass the phone
      const round = stepRound(r.round, e.e, bank, rng);
      if (round === r.round) return r;
      return round.phase === 'over' ? closeTurn(r, round) : { ...r, round };
    }
    case 'PAUSE':
      if (r.phase === 'playing' && r.round) return { ...r, phase: 'paused', before: 'playing', round: snapshotRound(r.round, e.now, bank) };
      if (r.phase === 'countdown' && r.countdownUntil != null) return { ...r, phase: 'paused', before: 'countdown', countdownUntil: r.countdownUntil - e.now };
      if (r.phase === 'handoff' || r.phase === 'turnOver') return { ...r, phase: 'paused', before: r.phase };
      return r;
    case 'RESUME': {
      if (r.phase !== 'paused' || !r.before) return r;
      if (r.before === 'playing' && r.round) return { ...r, phase: 'playing', before: null, round: stepRound(r.round, { type: 'RESUME', now: e.now }, bank, rng) };
      if (r.before === 'countdown') return { ...r, phase: 'countdown', before: null, countdownUntil: e.now + Math.max(0, r.countdownUntil ?? 0) };
      return { ...r, phase: r.before, before: null };
    }
    case 'NEXT':
      return r.phase === 'turnOver' ? advance(r, r.turn + 1) : r;
    case 'REMOVE': {
      // Rule 17: a removed player's turn is skipped; at least 2 players stay. A finished turn keeps its score (GA9).
      const left = r.order.filter((s) => !r.removed.includes(s));
      if (r.removed.includes(e.seat) || left.length <= 2 || r.phase === 'done') return r;
      const next = { ...r, removed: [...r.removed, e.seat] };
      const theirs = currentSeat(r) === e.seat && r.phase !== 'turnOver' && !(r.phase === 'paused' && r.before === 'turnOver');
      if (!theirs) return next;
      const moved = advance(next, r.turn + 1);
      return r.phase === 'paused' && moved.phase !== 'done' ? { ...moved, phase: 'paused', before: 'handoff' } : moved;
    }
  }
}

export function snapshotOffline(r: OfflineRun, now: number, bank: Bank): OfflineRun {
  return r.phase === 'playing' || r.phase === 'countdown' ? stepOffline(r, { type: 'PAUSE', now }, bank) : r;
}

/**
 * QP6: after every turn, each Closest number question gives its points to the nearest guess (every seat on a tie).
 * Returns each finished turn with its held guesses settled as right (with points) or wrong.
 */
export function settleClosest(results: Finished[], bank: Bank): Finished[] {
  const winners = new Map<string, number[]>();
  for (const id of new Set(results.flatMap((x) => x.answers.filter((a) => a.held).map((a) => a.qId)))) {
    const q = bank(id);
    if (q?.style !== 'closest') continue;
    const guesses = results.map((x) => {
      const a = x.answers.find((y) => y.qId === id);
      return { seat: x.seat, value: a?.held && a.response?.style === 'closest' ? a.response.value : null };
    });
    winners.set(id, nearestSeats(q.answer, guesses));
  }
  return results.map((x) => {
    const answers = x.answers.map((a): Answer => {
      if (!a.held) return a;
      const won = winners.get(a.qId)?.includes(x.seat) ?? false;
      return { ...a, outcome: won ? 'right' : 'wrong', points: won ? POINTS.closest : 0 };
    });
    return { ...x, answers, score: answers.reduce((n, a) => n + a.points, 0) };
  });
}

export type ParadeRow = Row & { right: number };

/** Standings; Closest number counts only once the game is done. Ties go to the most fully right answers (as coded). */
export function offlineRows(r: OfflineRun, names: Record<number, string>, bank: Bank): ParadeRow[] {
  const results = r.phase === 'done' ? settleClosest(r.results, bank) : r.results;
  return r.order
    .filter((seat) => !r.removed.includes(seat) || results.some((y) => y.seat === seat))
    .map((seat) => {
      const x = results.find((y) => y.seat === seat);
      return { seat, name: names[seat] ?? `Player ${seat + 1}`, score: x?.score ?? 0, timeMs: 0, right: x?.answers.filter((a) => a.outcome === 'right').length ?? 0 };
    });
}

export const paradeTieBreak = (a: ParadeRow, b: ParadeRow) => b.right - a.right;

/** OF1: what happened since `seat` last played: each finished turn's points (before Closest number), then a lead change. */
export function offlineRecap(r: OfflineRun, seat: number, play: Pick<Play, 'seats' | 'settings'>): RecapLine[] {
  const last = lastIndexOf(r.results, seat);
  const since = r.results.slice(last + 1);
  if (!since.length) return [];
  const seatOf = new Map(play.seats.map((x) => [x.seat, x]));
  const events = since.map((x, i) => event(`qp-${last + 1 + i}`, x.seat, seatOf.get(x.seat), `scored ${x.score}`));
  const scores = (rs: Finished[]) => r.order.map((s) => ({ seat: s, score: rs.filter((x) => x.seat === s).reduce((a, x) => a + x.score, 0) }));
  return finishRecap(events, leadLine(sides(scores(r.results.slice(0, last + 1)), play), sides(scores(r.results), play)));
}
