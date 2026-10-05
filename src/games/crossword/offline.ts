// Nova Crossword Offline (pass the phone): CW5, OF1, TMG-CW. One shared grid; each turn is one word.
// Right = points equal to the word's length (plus any word it completes); wrong = -1 heart. Either way the
// turn passes; closing an unsolved word also ends the turn, with no penalty (as coded). At 0 hearts a player
// may take ONE token revive (1 heart, paid by the phone owner), else they are out. Laps are random and nobody
// plays twice in a row (CW5, like NM14); with teams on, teams alternate (TM5). No hints, no EXP.
import type { Play } from '../engine/types';
import type { Row } from '../engine/standings';
import { nextLap } from '../medicordle/core';
import { event, finishRecap, lastIndexOf, leadLine, sides, type RecapLine } from '../shell/recap';
import { autoSolved, CW, indexOf, judge, type PuzzleDef } from './core';

export type SeatState = { hearts: number; score: number; revived: boolean; out: boolean; tried: Record<string, string[]> };

/** One turn: `wordId` null when the player closed the word without answering. */
export type Turn = { seat: number; wordId: string | null; right: boolean; gained: number; claimed: string[]; outAfter: boolean };

export type OfflinePhase = 'handoff' | 'playing' | 'revive' | 'done';

export type OfflineRun = {
  puzzleId: string;
  seats: number[];
  players: Record<number, SeatState>;
  /** Who solved each word (the cells take that player's colour). */
  solvedBy: Record<string, number>;
  lap: number[];
  last: number | null;
  teamOrder: number[] | null;
  removed: number[];
  phase: OfflinePhase;
  turns: Turn[];
};

export type OfflineEvent =
  | { type: 'READY' }
  | { type: 'SUBMIT'; wordId: string; answer: string }
  | { type: 'CLOSE' }
  | { type: 'REVIVE' }
  | { type: 'DECLINE' }
  | { type: 'REMOVE'; seat: number };

const live = (r: Pick<OfflineRun, 'seats' | 'removed' | 'players'>) => r.seats.filter((s) => !r.removed.includes(s) && !r.players[s].out);

export function startOffline(puzzleId: string, seats: number[], rng: () => number = Math.random, teamOrder: number[] | null = null): OfflineRun {
  const players: Record<number, SeatState> = {};
  for (const s of seats) players[s] = { hearts: CW.hearts, score: 0, revived: false, out: false, tried: {} };
  return { puzzleId, seats, players, solvedBy: {}, lap: teamOrder ? [...teamOrder] : nextLap(seats, null, rng), last: null, teamOrder, removed: [], phase: 'handoff', turns: [] };
}

export const currentSeat = (r: OfflineRun) => r.lap[0];

function nextTurn(p: PuzzleDef, r: OfflineRun, rng: () => number): OfflineRun {
  const seats = live(r);
  if (Object.keys(r.solvedBy).length >= p.words.length || !seats.length) return { ...r, phase: 'done' };
  let lap = r.lap.slice(1).filter((s) => seats.includes(s));
  if (!lap.length) lap = r.teamOrder ? r.teamOrder.filter((s) => seats.includes(s)) : nextLap(seats, r.last, rng);
  return { ...r, lap, phase: 'handoff' };
}

export function stepOffline(p: PuzzleDef, r: OfflineRun, e: OfflineEvent, rng: () => number = Math.random): OfflineRun {
  const seat = currentSeat(r);
  const me = r.players[seat];
  switch (e.type) {
    case 'READY':
      return r.phase === 'handoff' ? { ...r, phase: 'playing' } : r;
    case 'SUBMIT': {
      if (r.phase !== 'playing') return r;
      const solved = Object.keys(r.solvedBy);
      const out = judge(p, solved, me.tried, e.wordId, e.answer);
      if (out === 'ignored' || out === 'repeat') return r;
      if (out === 'right') {
        const idx = indexOf(p);
        const auto = autoSolved(idx, [...solved, e.wordId]);
        const claimed = [e.wordId, ...auto];
        const gained = claimed.reduce((a, id) => a + idx.wordById.get(id)!.answer.length, 0);
        const solvedBy = { ...r.solvedBy };
        for (const id of claimed) solvedBy[id] = seat;
        const players = { ...r.players, [seat]: { ...me, score: me.score + gained } };
        return nextTurn(p, { ...r, solvedBy, players, last: seat, turns: [...r.turns, { seat, wordId: e.wordId, right: true, gained, claimed, outAfter: false }] }, rng);
      }
      const hearts = me.hearts - 1;
      const tried = { ...me.tried, [e.wordId]: [...(me.tried[e.wordId] ?? []), e.answer] };
      const players = { ...r.players, [seat]: { ...me, hearts, tried } };
      const turn: Turn = { seat, wordId: e.wordId, right: false, gained: 0, claimed: [], outAfter: false };
      const base = { ...r, players, last: seat, turns: [...r.turns, turn] };
      if (hearts > 0) return nextTurn(p, base, rng);
      // 0 hearts: one token revive per player per match (CW5), otherwise out.
      if (!me.revived) return { ...base, phase: 'revive' };
      return nextTurn(p, outSeat(base, seat), rng);
    }
    case 'CLOSE':
      return r.phase === 'playing' ? nextTurn(p, { ...r, last: seat, turns: [...r.turns, { seat, wordId: null, right: false, gained: 0, claimed: [], outAfter: false }] }, rng) : r;
    case 'REVIVE':
      return r.phase === 'revive' ? nextTurn(p, { ...r, players: { ...r.players, [seat]: { ...me, hearts: CW.reviveHearts, revived: true } } }, rng) : r;
    case 'DECLINE':
      return r.phase === 'revive' ? nextTurn(p, outSeat(r, seat), rng) : r;
    case 'REMOVE': {
      // Rule 17: a removed player's turns are skipped; at least 2 players stay.
      if (r.removed.includes(e.seat) || r.seats.filter((s) => !r.removed.includes(s)).length <= 2 || r.phase === 'done') return r;
      const next = { ...r, removed: [...r.removed, e.seat] };
      if (seat !== e.seat) return { ...next, lap: next.lap.filter((s) => s !== e.seat) };
      return nextTurn(p, next, rng);
    }
  }
}

function outSeat(r: OfflineRun, seat: number): OfflineRun {
  const turns = r.turns.slice();
  if (turns.length && turns[turns.length - 1].seat === seat) turns[turns.length - 1] = { ...turns[turns.length - 1], outAfter: true };
  return { ...r, turns, players: { ...r.players, [seat]: { ...r.players[seat], out: true, hearts: 0 } } };
}

/** Standings: score, then hearts left (as coded); equal on both shares the rank. */
export function offlineStandings(r: OfflineRun, names: Record<number, string>): Row[] {
  return r.seats.map((seat) => ({ seat, name: names[seat] ?? `Player ${seat + 1}`, score: r.players[seat].score, timeMs: -r.players[seat].hearts }));
}

/**
 * OF1 with the CW7 events: what happened since `seat` last played. "Sara claimed ANEMIA · +6" (the word is
 * already showing on the shared grid), "Lina is out of hearts", then a lead change (team average with teams on).
 */
export function offlineRecap(p: PuzzleDef, r: OfflineRun, seat: number, play: Pick<Play, 'seats' | 'settings'>): RecapLine[] {
  const last = lastIndexOf(r.turns, seat);
  const seatOf = new Map(play.seats.map((x) => [x.seat, x]));
  const idx = indexOf(p);
  const events: RecapLine[] = [];
  r.turns.forEach((t, i) => {
    if (i <= last) return;
    if (t.right) events.push(event(`cw-claim-${i}`, t.seat, seatOf.get(t.seat), `claimed ${t.claimed.map((id) => idx.wordById.get(id)!.answer).join(' and ')} · +${t.gained}`));
    if (t.outAfter) events.push(event(`cw-out-${i}`, t.seat, seatOf.get(t.seat), 'is out of hearts'));
  });
  if (!events.length) return [];
  const scoreAt = (n: number) => r.seats.filter((s) => !r.removed.includes(s)).map((s) => ({ seat: s, score: r.turns.slice(0, n).filter((t) => t.seat === s).reduce((a, t) => a + t.gained, 0) }));
  return finishRecap(events, leadLine(sides(scoreAt(last + 1), play), sides(scoreAt(r.turns.length), play)));
}
