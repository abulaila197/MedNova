// Four of a Kind, Pass the phone (Yazan 2026-11-12): one shared board, one group per turn. A right group scores its
// level's points (easy 1, medium 2, hard 3) for whoever found it; a wrong pick loses nothing and passes the phone.
// When three groups are found the last one falls into place for nobody. Then the next board (1, 3 or 5). No hearts,
// hints or tokens here; ties go to fewer mistakes. Laps are random and nobody plays twice in a row; teams alternate.
import type { Play } from '../engine/types';
import type { Row } from '../engine/standings';
import { nextLap } from '../medicordle/core';
import { event, finishRecap, lastIndexOf, leadLine, sides, type RecapLine } from '../shell/recap';
import { levelPoints, shuffle, startRun, submit, type Board, type BoardRun, type Verdict } from './core';
import { groupById } from './data';
import { say } from '../../i18n/say';

export type Seat = { score: number; mistakes: number };
export type Turn = { seat: number; board: number; slot: number | null; verdict: Verdict; gained: number };
export type OfflinePhase = 'handoff' | 'playing' | 'boardEnd' | 'done';

export type OfflineRun = {
  boards: Board[];
  index: number;
  run: BoardRun;
  /** Who found each group slot on this board (the last one, fallen into place, has nobody). */
  foundBy: Record<number, number>;
  seats: number[];
  players: Record<number, Seat>;
  lap: number[];
  last: number | null;
  teamOrder: number[] | null;
  removed: number[];
  phase: OfflinePhase;
  turns: Turn[];
};

export type OfflineEvent = { type: 'READY' } | { type: 'SUBMIT'; tiles: number[] } | { type: 'SHUFFLE'; rand: () => number } | { type: 'NEXT' } | { type: 'REMOVE'; seat: number } | { type: 'FINISH' };

/** A board with no hearts to lose (the run's hearts never run out here). */
const freshRun = (r: () => number): BoardRun => ({ ...startRun(r), hearts: 999 });

export function startOffline(boards: Board[], seats: number[], rng: () => number = Math.random, teamOrder: number[] | null = null): OfflineRun {
  const players: Record<number, Seat> = {};
  for (const s of seats) players[s] = { score: 0, mistakes: 0 };
  return { boards, index: 0, run: freshRun(rng), foundBy: {}, seats, players, lap: teamOrder ? [...teamOrder] : nextLap(seats, null, rng), last: null, teamOrder, removed: [], phase: 'handoff', turns: [] };
}

export const currentSeat = (r: OfflineRun) => r.lap[0];
const live = (r: OfflineRun) => r.seats.filter((s) => !r.removed.includes(s));

function nextTurn(r: OfflineRun, rng: () => number): OfflineRun {
  if (r.run.phase === 'done') return { ...r, phase: 'boardEnd' };
  const seats = live(r);
  let lap = r.lap.slice(1).filter((s) => seats.includes(s));
  if (!lap.length) lap = r.teamOrder ? r.teamOrder.filter((s) => seats.includes(s)) : nextLap(seats, r.last, rng);
  return { ...r, lap, phase: 'handoff' };
}

/** What a pick would do, without changing anything (the screen shows it, then the phone passes). */
export const judgeTurn = (r: OfflineRun, tiles: number[]) => submit(r.run, tiles).verdict;

export function stepOffline(r: OfflineRun, e: OfflineEvent, rng: () => number = Math.random): OfflineRun {
  const seat = currentSeat(r);
  switch (e.type) {
    case 'READY':
      return r.phase === 'handoff' ? { ...r, phase: 'playing' } : r;
    case 'SHUFFLE':
      return r.phase === 'playing' ? { ...r, run: { ...r.run, order: shuffle(r.run.order, e.rand) } } : r;
    case 'SUBMIT': {
      if (r.phase !== 'playing') return r;
      const { run, verdict, group } = submit(r.run, e.tiles);
      if (verdict === 'ignored' || verdict === 'repeat') return r;
      const me = r.players[seat];
      if (verdict === 'right' && group != null) {
        const gained = levelPoints(groupById.get(r.boards[r.index].groups[group].id)!.lv);
        const players = { ...r.players, [seat]: { ...me, score: me.score + gained } };
        return nextTurn({ ...r, run, players, foundBy: { ...r.foundBy, [group]: seat }, last: seat, turns: [...r.turns, { seat, board: r.index, slot: group, verdict, gained }] }, rng);
      }
      const players = { ...r.players, [seat]: { ...me, mistakes: me.mistakes + 1 } };
      return nextTurn({ ...r, run: { ...run, hearts: 999 }, players, last: seat, turns: [...r.turns, { seat, board: r.index, slot: null, verdict, gained: 0 }] }, rng);
    }
    case 'NEXT': {
      if (r.phase !== 'boardEnd') return r;
      if (r.index + 1 >= r.boards.length) return { ...r, phase: 'done' };
      return nextTurn({ ...r, index: r.index + 1, run: freshRun(rng), foundBy: {}, phase: 'handoff' }, rng);
    }
    case 'REMOVE': {
      // Rule 17: a removed player's turns are skipped; at least 2 players stay.
      if (r.removed.includes(e.seat) || live(r).length <= 2 || r.phase === 'done') return r;
      const next = { ...r, removed: [...r.removed, e.seat] };
      if (seat !== e.seat || r.phase === 'boardEnd') return { ...next, lap: next.lap.filter((s) => s !== e.seat) };
      return nextTurn(next, rng);
    }
    case 'FINISH':
      return r.phase === 'done' ? r : { ...r, phase: 'done' };
  }
}

/** Standings: points, then fewer mistakes; equal on both shares the place. */
export function offlineStandings(r: OfflineRun, names: Record<number, string>): Row[] {
  return r.seats.map((seat) => ({ seat, name: names[seat] ?? say('Player {v}', { v: seat + 1 }), score: r.players[seat].score, timeMs: r.players[seat].mistakes }));
}

/** What happened since `seat` last played: "Sara found Beta blockers · +1", then a lead change. */
export function offlineRecap(r: OfflineRun, seat: number, play: Pick<Play, 'seats' | 'settings'>): RecapLine[] {
  const last = lastIndexOf(r.turns, seat);
  const seatOf = new Map(play.seats.map((x) => [x.seat, x]));
  const events: RecapLine[] = [];
  r.turns.forEach((t, i) => {
    if (i <= last || t.slot == null) return;
    const g = groupById.get(r.boards[t.board].groups[t.slot].id);
    events.push(event(`fok-${i}`, t.seat, seatOf.get(t.seat), `found ${g?.n ?? 'a group'} · +${t.gained}`));
  });
  if (!events.length) return [];
  const scoreAt = (n: number) => live(r).map((s) => ({ seat: s, score: r.turns.slice(0, n).filter((t) => t.seat === s).reduce((a, t) => a + t.gained, 0) }));
  return finishRecap(events, leadLine(sides(scoreAt(last + 1), play), sides(scoreAt(r.turns.length), play)));
}
