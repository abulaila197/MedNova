// Spot the Flaw, Pass the phone (Yazan 2026-11-12): everyone gets the same case. In turn, each player answers both
// stages in secret, then the phone passes. When everyone has answered, all the answers show together with the
// explanation, and then the next case (1, 3 or 5). Same points as Solo; no help, no clock, no EXP, nothing to Learn.
// Each case's order is random (teams alternate); ties go to fewer double-wrongs.
import type { Row } from '../engine/standings';
import { nextLap } from '../medicordle/core';
import { casePoints, doubleWrong, gameScore, lock, startCase, type CaseRun } from './core';
import { caseById } from './data';

export type Seat = { points: number[]; doubles: number };
export type OfflinePhase = 'handoff' | 'playing' | 'reveal' | 'done';

export type OfflineRun = {
  cases: string[];
  index: number;
  /** Each player's run on the open case (filled in as they answer). */
  runs: Record<number, CaseRun>;
  seats: number[];
  players: Record<number, Seat>;
  /** Who still has to answer this case, in order (the first is answering now). */
  lap: number[];
  last: number | null;
  teamOrder: number[] | null;
  removed: number[];
  phase: OfflinePhase;
};

export type OfflineEvent = { type: 'READY' } | { type: 'LOCK'; pick: number } | { type: 'NEXT' } | { type: 'REMOVE'; seat: number } | { type: 'FINISH' };

/** Every player sees the choices in the same order, so the reveal can compare letters. */
const freshRuns = (seats: number[], r: () => number): Record<number, CaseRun> => {
  const base = startCase(r);
  return Object.fromEntries(seats.map((s) => [s, { ...base }]));
};

export function startOffline(cases: string[], seats: number[], rng: () => number = Math.random, teamOrder: number[] | null = null): OfflineRun {
  const players: Record<number, Seat> = {};
  for (const s of seats) players[s] = { points: [], doubles: 0 };
  return { cases, index: 0, runs: freshRuns(seats, rng), seats, players, lap: teamOrder ? [...teamOrder] : nextLap(seats, null, rng), last: null, teamOrder, removed: [], phase: 'handoff' };
}

export const currentSeat = (r: OfflineRun) => r.lap[0];
const live = (r: OfflineRun) => r.seats.filter((s) => !r.removed.includes(s));
export const scoreOf = (r: OfflineRun, seat: number) => gameScore(r.players[seat].points);

/** The player is done with this case: the next one answers, or everyone has and the answers show. */
function passOn(r: OfflineRun): OfflineRun {
  const lap = r.lap.slice(1).filter((s) => live(r).includes(s));
  if (lap.length) return { ...r, lap, phase: 'handoff' };
  // Everyone answered: score the case for each player.
  const lv = caseById.get(r.cases[r.index])!.lv;
  const players = { ...r.players };
  for (const s of live(r)) {
    const run = r.runs[s];
    players[s] = { points: [...players[s].points, casePoints(lv, run)], doubles: players[s].doubles + (doubleWrong(run) ? 1 : 0) };
  }
  return { ...r, lap: [], players, phase: 'reveal' };
}

export function stepOffline(r: OfflineRun, e: OfflineEvent, rng: () => number = Math.random): OfflineRun {
  const seat = currentSeat(r);
  switch (e.type) {
    case 'READY':
      return r.phase === 'handoff' ? { ...r, phase: 'playing' } : r;
    case 'LOCK': {
      if (r.phase !== 'playing') return r;
      const run = lock(r.runs[seat], e.pick);
      if (run === r.runs[seat]) return r;
      const next = { ...r, runs: { ...r.runs, [seat]: run }, last: seat };
      return run.stage === 'done' ? passOn(next) : next;
    }
    case 'NEXT': {
      if (r.phase !== 'reveal') return r;
      if (r.index + 1 >= r.cases.length) return { ...r, phase: 'done' };
      const seats = live(r);
      const lap = r.teamOrder ? r.teamOrder.filter((s) => seats.includes(s)) : nextLap(seats, r.last, rng);
      return { ...r, index: r.index + 1, runs: freshRuns(r.seats, rng), lap, phase: 'handoff' };
    }
    case 'REMOVE': {
      // A removed player's turns are skipped; at least 2 players stay.
      if (r.removed.includes(e.seat) || live(r).length <= 2 || r.phase === 'done') return r;
      const next = { ...r, removed: [...r.removed, e.seat] };
      if (seat !== e.seat || r.phase === 'reveal') return { ...next, lap: next.lap.filter((s) => s !== e.seat) };
      return passOn(next);
    }
    case 'FINISH':
      return r.phase === 'done' ? r : { ...r, phase: 'done' };
  }
}

/** Standings: points, then fewer double-wrongs; equal on both shares the place. */
export function offlineStandings(r: OfflineRun, names: Record<number, string>): Row[] {
  return r.seats.map((seat) => ({ seat, name: names[seat] ?? `Player ${seat + 1}`, score: scoreOf(r, seat), timeMs: r.players[seat].doubles }));
}
