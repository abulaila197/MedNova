// Put it in order, Pass the phone (Yazan 2026-11-18): each round, every player in turn gets their own question and
// 90 seconds. Same points as Solo (by tries + speed); no helpers, no EXP, nothing to Learn. After each turn the player
// sees the right order, then passes the phone. Most points after the last round wins; ties go to the faster player.
import type { Row } from '../engine/standings';
import { nextLap } from '../medicordle/core';
import { ORDER, move, runPoints, startRun, submit, timeUp, type QRun, type Target } from './core';
import { questionById } from './data';
import { say } from '../../i18n/say';

export type Seat = { points: number[]; ms: number };
export type OfflinePhase = 'handoff' | 'playing' | 'result' | 'done';
/** The open turn: whose, which question, their run and (once over) the time it took. */
export type Turn = { seat: number; id: string; run: QRun; ms: number };

export type OfflineRun = {
  /** Every player's questions, dealt in turn order (one a turn). */
  ids: string[];
  /** The next unused question. */
  next: number;
  round: number;
  rounds: number;
  seats: number[];
  players: Record<number, Seat>;
  /** Who still plays this round, in order (the first is playing now). */
  lap: number[];
  last: number | null;
  teamOrder: number[] | null;
  removed: number[];
  phase: OfflinePhase;
  turn: Turn | null;
};

export type OfflineEvent =
  | { type: 'READY' }
  | { type: 'MOVE'; card: number; to: Target }
  | { type: 'SUBMIT'; ms: number }
  | { type: 'TIMEUP' }
  | { type: 'NEXT' }
  | { type: 'REMOVE'; seat: number }
  | { type: 'FINISH' };

export function startOffline(ids: string[], seats: number[], rounds: number, rng: () => number = Math.random, teamOrder: number[] | null = null): OfflineRun {
  const players: Record<number, Seat> = {};
  for (const s of seats) players[s] = { points: [], ms: 0 };
  return { ids, next: 0, round: 0, rounds, seats, players, lap: teamOrder ? [...teamOrder] : nextLap(seats, null, rng), last: null, teamOrder, removed: [], phase: 'handoff', turn: null };
}

export const currentSeat = (r: OfflineRun) => r.turn?.seat ?? r.lap[0];
const live = (r: OfflineRun) => r.seats.filter((s) => !r.removed.includes(s));
export const scoreOf = (r: OfflineRun, seat: number) => r.players[seat].points.reduce((a, b) => a + b, 0);

/** A turn ends: its points go to the player, and they see the right order. */
function close(r: OfflineRun, run: QRun, ms: number): OfflineRun {
  const t = r.turn!;
  const p = r.players[t.seat];
  const players = { ...r.players, [t.seat]: { points: [...p.points, runPoints(run, ms)], ms: p.ms + ms } };
  return { ...r, players, turn: { ...t, run, ms }, last: t.seat, phase: 'result' };
}

/** After a turn's result: the next player, the next round, or the end. */
function onward(r: OfflineRun, rng: () => number): OfflineRun {
  const lap = r.lap.slice(1).filter((s) => live(r).includes(s));
  if (lap.length) return { ...r, lap, turn: null, phase: 'handoff' };
  if (r.round + 1 >= r.rounds) return { ...r, lap: [], turn: null, phase: 'done' };
  const seats = live(r);
  const next = r.teamOrder ? r.teamOrder.filter((s) => seats.includes(s)) : nextLap(seats, r.last, rng);
  return { ...r, round: r.round + 1, lap: next, turn: null, phase: 'handoff' };
}

export function stepOffline(r: OfflineRun, e: OfflineEvent, rng: () => number = Math.random): OfflineRun {
  switch (e.type) {
    case 'READY': {
      if (r.phase !== 'handoff' || !r.lap.length) return r;
      const id = r.ids[r.next % r.ids.length];
      return { ...r, next: r.next + 1, phase: 'playing', turn: { seat: r.lap[0], id, run: startRun(questionById.get(id)!, rng), ms: 0 } };
    }
    case 'MOVE': {
      if (r.phase !== 'playing' || !r.turn) return r;
      const run = move(r.turn.run, e.card, e.to);
      return run === r.turn.run ? r : { ...r, turn: { ...r.turn, run } };
    }
    case 'SUBMIT': {
      if (r.phase !== 'playing' || !r.turn) return r;
      const run = submit(r.turn.run);
      if (run === r.turn.run) return r;
      return run.done ? close(r, run, Math.min(e.ms, ORDER.turnMs)) : { ...r, turn: { ...r.turn, run } };
    }
    case 'TIMEUP':
      return r.phase === 'playing' && r.turn ? close(r, timeUp(r.turn.run), ORDER.turnMs) : r;
    case 'NEXT':
      return r.phase === 'result' ? onward(r, rng) : r;
    case 'REMOVE': {
      // A removed player's turns are skipped; at least 2 players stay.
      if (r.removed.includes(e.seat) || live(r).length <= 2 || r.phase === 'done') return r;
      const next = { ...r, removed: [...r.removed, e.seat] };
      if (r.turn?.seat === e.seat && r.phase === 'playing') return onward({ ...next, phase: 'result' }, rng);
      if (r.phase === 'handoff' && r.lap[0] === e.seat) return onward({ ...next, phase: 'result' }, rng);
      return { ...next, lap: next.lap.filter((s, i) => i === 0 && r.phase === 'result' ? true : s !== e.seat) };
    }
    case 'FINISH':
      return r.phase === 'done' ? r : { ...r, phase: 'done' };
  }
}

/** Standings: points, then the faster player. */
export function offlineStandings(r: OfflineRun, names: Record<number, string>): Row[] {
  return r.seats.map((seat) => ({ seat, name: names[seat] ?? say('Player {v}', { v: seat + 1 }), score: scoreOf(r, seat), timeMs: r.players[seat].ms }));
}
