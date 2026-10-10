// Case Files Offline (pass the phone), CF8, CF10, TMG-CF: every player plays the whole same case alone, in the
// order they were added. Results stay sealed (no stamp, no score, no discharge) until everyone has finished.
import { scoreRun, snapshot, startRun, stepRun, type CaseDef, type Run, type RunEvent, type Score } from './core';
import { clock } from '../engine/clock';

export type OfflinePhase = 'handoff' | 'playing' | 'done';

export type OfflineRun = {
  caseId: string;
  /** Seats in the order they were added (as coded). */
  order: number[];
  turn: number;
  phase: OfflinePhase;
  /** The current player's case; null on the hand-off screen. */
  run: Run | null;
  /** Finished players, in finishing order. */
  done: { seat: number; run: Run }[];
};

export function startOffline(caseId: string, order: number[]): OfflineRun {
  return { caseId, order, turn: 0, phase: 'handoff', run: null, done: [] };
}

export const currentSeat = (o: OfflineRun) => o.order[o.turn];

/** The player taps Start on the hand-off screen: their case and clock start now. */
export function ready(o: OfflineRun, now: number): OfflineRun {
  return o.phase === 'handoff' ? { ...o, phase: 'playing', run: startRun(o.caseId, now) } : o;
}

/** One step of the current player's case, always sealed (CF8). */
export function stepOffline(def: CaseDef, o: OfflineRun, e: RunEvent): OfflineRun {
  if (o.phase !== 'playing' || !o.run) return o;
  const run = stepRun(def, o.run, e, true);
  if (run === o.run) return o;
  if (run.phase !== 'done') return { ...o, run };
  // CLOSE: this player is through; hand over, or end once the last one finishes.
  const done = [...o.done, { seat: currentSeat(o), run }];
  const turn = o.turn + 1;
  return turn >= o.order.length ? { ...o, done, run: null, phase: 'done' } : { ...o, done, run: null, turn, phase: 'handoff' };
}

/** A player removed from the pause menu: skipped if still waiting, and the current one hands over at once. */
export function removeSeat(o: OfflineRun, seat: number): OfflineRun {
  if (o.phase === 'done' || o.done.some((d) => d.seat === seat)) return o;
  const i = o.order.indexOf(seat);
  if (i < 0) return o;
  const order = o.order.filter((x) => x !== seat);
  const cur = i === o.turn;
  const turn = i < o.turn ? o.turn - 1 : o.turn;
  if (turn >= order.length) return { ...o, order, turn, run: null, phase: 'done' };
  return cur ? { ...o, order, turn, run: null, phase: 'handoff' } : { ...o, order, turn };
}

/** Saved for resume: a running case is saved paused (rule 10). */
export const snapshotOffline = (def: CaseDef, o: OfflineRun, now: number): OfflineRun => (o.run ? { ...o, run: snapshot(def, o.run, now) } : o);

/** CF10: the hand-off shows only who finished and how long they took, nothing that would unseal the results. */
export function finishedLines(o: OfflineRun, names: (seat: number) => string) {
  return o.done.map((d) => `${names(d.seat)} finished the case in ${clock(d.run.finalMs ?? d.run.elapsedMs)}`);
}

export type Ranked = { seat: number; score: Score; timeMs: number; rank: number };

/** Points (time bonus included); tie -> shorter time at the last submission; equal on both shares the rank (as coded). */
export function rankOffline(def: CaseDef, o: OfflineRun): Ranked[] {
  const rows = o.done.map((d) => ({ seat: d.seat, score: scoreRun(def, d.run), timeMs: d.run.finalMs ?? d.run.elapsedMs, rank: 0 }));
  rows.sort((a, b) => b.score.total - a.score.total || a.timeMs - b.timeMs);
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    r.rank = prev && prev.score.total === r.score.total && prev.timeMs === r.timeMs ? prev.rank : i + 1;
  });
  return rows;
}
