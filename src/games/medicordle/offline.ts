// Nova Medicordle Offline Multiplayer (pass and play): NM8, NM9, NM12-NM14, NM16, NM25.
// One shared board per word. Players take turns guessing; whoever guesses the word wins it; most words wins.
// Rows round up to full laps; each lap's order is random and nobody plays twice in a row. No hints, no EXP.
import { MAX_ROWS, nextLap, offlineRows, type Style } from './core';
import type { Row } from '../engine/standings';

/** One turn on the board. `word` is null when the turn timed out (the row is used, the turn passes). */
export type Turn = { seat: number; word: string | null; timeMs: number };

export type WordOutcome = { wordId: string; winner: number | null; turns: Turn[] };

export type OfflinePhase = 'ready' | 'playing' | 'paused' | 'wordOver' | 'done';

export type OfflineRun = {
  style: Style;
  wordIds: string[];
  turnMs: number;
  index: number;
  /** Rows for the current word, fixed at its start from the players still in (NM14). */
  rows: number;
  turns: Turn[];
  /** Seats still to play in the current lap. */
  lap: number[];
  /** Seat of the last turn played, so the next lap never starts with them (NM14). */
  last: number | null;
  seats: number[];
  removed: number[];
  phase: OfflinePhase;
  before: 'ready' | 'playing' | 'wordOver' | null;
  elapsedMs: number;
  runningSince: number | null;
  results: WordOutcome[];
  rowSeq: number;
};

export type OfflineEvent =
  | { type: 'READY'; now: number }
  | { type: 'GUESS'; word: string; answer: string; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'NEXT' }
  | { type: 'REMOVE'; seat: number };

const active = (r: Pick<OfflineRun, 'seats' | 'removed'>) => r.seats.filter((s) => !r.removed.includes(s));

export function startOffline(style: Style, seats: number[], wordIds: string[], turnMs: number, rng: () => number = Math.random): OfflineRun {
  return {
    style, wordIds, turnMs, index: 0, rows: offlineRows(seats.length), turns: [], lap: nextLap(seats, null, rng), last: null,
    seats, removed: [], phase: 'ready', before: null, elapsedMs: 0, runningSince: null, results: [], rowSeq: 0,
  };
}

export const currentSeat = (r: OfflineRun) => r.lap[0];
export const turnElapsed = (r: OfflineRun, now: number) => Math.min(r.turnMs, r.elapsedMs + (r.runningSince == null ? 0 : Math.max(0, now - r.runningSince)));
export const turnLeft = (r: OfflineRun, now: number) => r.turnMs - turnElapsed(r, now);
export const guessesOf = (r: Pick<OfflineRun, 'turns'>) => r.turns.filter((t) => t.word != null).map((t) => t.word as string);

/** The definition shows on the board's last row (NM8 keeps the coded last-try rule) and once the word ends. */
export const showDefinition = (r: OfflineRun) => r.turns.length >= r.rows - 1 || r.phase === 'wordOver' || (r.phase === 'paused' && r.before === 'wordOver');

/** Saved for resume: a running turn is saved paused at the exact clock (rule 10). */
export function snapshotOffline(r: OfflineRun, now: number): OfflineRun {
  if (r.phase !== 'playing') return r;
  return { ...r, phase: 'paused', before: 'playing', elapsedMs: turnElapsed(r, now), runningSince: null };
}

/** After a turn: the word ends on a solve or when the rows run out; otherwise the next seat in the lap gets ready. */
function afterTurn(r: OfflineRun, turn: Turn, answer: string | null, rng: () => number): OfflineRun {
  const turns = [...r.turns, turn];
  const solved = turn.word != null && turn.word === answer;
  let lap = r.lap.slice(1);
  if (!lap.length) lap = nextLap(active(r), turn.seat, rng);
  const base = { ...r, turns, lap, last: turn.seat, elapsedMs: 0, runningSince: null, rowSeq: r.rowSeq + (turn.word ? 1 : 0) };
  if (solved || turns.length >= r.rows) {
    const res: WordOutcome = { wordId: r.wordIds[r.index], winner: solved ? turn.seat : null, turns };
    return { ...base, phase: 'wordOver', before: null, results: [...r.results, res] };
  }
  return { ...base, phase: 'ready', before: null };
}

export function stepOffline(r: OfflineRun, e: OfflineEvent, rng: () => number = Math.random): OfflineRun {
  switch (e.type) {
    case 'READY':
      return r.phase === 'ready' ? { ...r, phase: 'playing', runningSince: e.now } : r;
    case 'GUESS':
      if (r.phase !== 'playing') return r;
      if (turnLeft(r, e.now) <= 0) return afterTurn(r, { seat: currentSeat(r), word: null, timeMs: r.turnMs }, null, rng);
      return afterTurn(r, { seat: currentSeat(r), word: e.word, timeMs: turnElapsed(r, e.now) }, e.answer, rng);
    case 'TICK':
      // NM9: time out passes the turn; the row is used so every player keeps the same number of guesses.
      return r.phase === 'playing' && turnLeft(r, e.now) <= 0 ? afterTurn(r, { seat: currentSeat(r), word: null, timeMs: r.turnMs }, null, rng) : r;
    case 'PAUSE':
      if (r.phase === 'playing') return { ...r, phase: 'paused', before: 'playing', elapsedMs: turnElapsed(r, e.now), runningSince: null };
      if (r.phase === 'ready' || r.phase === 'wordOver') return { ...r, phase: 'paused', before: r.phase };
      return r;
    case 'RESUME':
      if (r.phase !== 'paused' || !r.before) return r;
      return r.before === 'playing' ? { ...r, phase: 'playing', before: null, runningSince: e.now } : { ...r, phase: r.before, before: null };
    case 'NEXT': {
      if (r.phase !== 'wordOver') return r;
      if (r.index + 1 >= r.wordIds.length) return { ...r, phase: 'done' };
      // A new word starts a fresh full lap (equal guesses per word), still never with the last player.
      const seats = active(r);
      return { ...r, index: r.index + 1, rows: offlineRows(seats.length), turns: [], lap: nextLap(seats, r.last, rng), phase: 'ready', before: null, elapsedMs: 0, runningSince: null };
    }
    case 'REMOVE': {
      // Rule 17: a removed player's turns are skipped; at least 2 players stay.
      if (r.removed.includes(e.seat) || active(r).length <= 2 || r.phase === 'done') return r;
      const removed = [...r.removed, e.seat];
      const onTurn = currentSeat(r) === e.seat && r.phase !== 'wordOver' && !(r.phase === 'paused' && r.before === 'wordOver');
      let lap = r.lap.filter((s) => s !== e.seat);
      if (!lap.length) lap = nextLap(r.seats.filter((s) => !removed.includes(s)), r.last, rng);
      if (!onTurn) return { ...r, removed, lap };
      // Their running turn is dropped (not counted as a row) and the next player gets ready.
      return { ...r, removed, lap, phase: r.phase === 'paused' ? 'paused' : 'ready', before: r.phase === 'paused' ? 'ready' : null, elapsedMs: 0, runningSince: null };
    }
  }
}

/** Standings: words won, then less total turn time (rule 13). */
export function offlineStandings(r: OfflineRun, names: Record<number, string>): Row[] {
  return r.seats.map((seat) => ({
    seat,
    name: names[seat] ?? `Player ${seat + 1}`,
    score: r.results.filter((x) => x.winner === seat).length,
    timeMs: [...r.results.flatMap((x) => x.turns), ...r.turns].filter((t) => t.seat === seat).reduce((a, t) => a + t.timeMs, 0),
  }));
}

export const ROWS_NOTE = (players: number) => `${offlineRows(players)} rows, ${offlineRows(players) / players} each`;
export { MAX_ROWS };
