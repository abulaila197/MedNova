// The Riddler Offline (pass and play), RD5, RD6, RD12, TMG-RD:
// everyone plays the same picture in turn behind the hand-off; order shuffled once per match (or teams alternate).
// Unlimited guesses with a 5 s lock after each wrong one; a turn ends on a right pick or time out.
// Per picture: fastest solver 100, then 80, 65..., plus a time bonus up to 50; time out = 0. No hint, no EXP.
import type { Row } from '../engine/standings';
import type { Play } from '../engine/types';
import { event, finishRecap, lastIndexOf, leadLine, sides, type RecapLine } from '../shell/recap';

export const LOCK_MS = 5_000;
export const RANK_POINTS = [100, 80, 65, 50, 40, 30];
export const TIME_BONUS_MAX = 50;

export type Turn = { seat: number; solved: boolean; timeMs: number; wrong: string[] };
export type PhotoScore = { seat: number; solved: boolean; timeMs: number; rank: number | null; rankPoints: number; timeBonus: number; points: number; wrong: number };
export type PhotoResult = { riddleId: string; scores: PhotoScore[] };

export type OfflinePhase = 'handoff' | 'playing' | 'paused' | 'photoOver' | 'done';

export type OfflineRun = {
  order: number[];
  photos: string[];
  turnMs: number;
  index: number;
  turn: number;
  phase: OfflinePhase;
  before: 'handoff' | 'playing' | 'photoOver' | null;
  elapsedMs: number;
  runningSince: number | null;
  /** Turn clock (ms into the turn) until which guessing is locked after a wrong one. */
  lockUntil: number;
  wrong: string[];
  turns: Turn[];
  removed: number[];
  results: PhotoResult[];
  wrongSeq: number;
};

export type OfflineEvent =
  | { type: 'READY'; now: number }
  | { type: 'GUESS'; answerId: string; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'NEXT' }
  | { type: 'REMOVE'; seat: number };

export function startOffline(order: number[], photos: string[], turnMs: number): OfflineRun {
  return {
    order, photos, turnMs, index: 0, turn: 0, phase: 'handoff', before: null, elapsedMs: 0, runningSince: null,
    lockUntil: 0, wrong: [], turns: [], removed: [], results: [], wrongSeq: 0,
  };
}

export const currentSeat = (r: OfflineRun) => r.order[r.turn];
export const currentPhoto = (r: OfflineRun) => r.photos[Math.min(r.index, r.photos.length - 1)];
export const turnElapsed = (r: OfflineRun, now: number) => Math.min(r.turnMs, r.elapsedMs + (r.runningSince == null ? 0 : Math.max(0, now - r.runningSince)));
export const turnLeft = (r: OfflineRun, now: number) => r.turnMs - turnElapsed(r, now);
/** Ms of lock left after a wrong guess (0 = free to guess). */
export const lockLeft = (r: OfflineRun, now: number) => Math.max(0, r.lockUntil - turnElapsed(r, now));

/** First seat at or after `from` that is still playing, or order.length. */
function nextTurn(r: OfflineRun, from: number) {
  let t = from;
  while (t < r.order.length && r.removed.includes(r.order[t])) t++;
  return t;
}

/** Scores one picture: solvers ranked by time (equal times share a rank), plus the time bonus. */
export function scorePhoto(turns: Turn[], turnMs: number): PhotoScore[] {
  const solved = turns.filter((t) => t.solved).sort((a, b) => a.timeMs - b.timeMs);
  const rankOf = new Map<number, number>();
  solved.forEach((t, i) => rankOf.set(t.seat, i > 0 && solved[i - 1].timeMs === t.timeMs ? rankOf.get(solved[i - 1].seat)! : i + 1));
  return turns.map((t) => {
    if (!t.solved) return { seat: t.seat, solved: false, timeMs: t.timeMs, rank: null, rankPoints: 0, timeBonus: 0, points: 0, wrong: t.wrong.length };
    const rank = rankOf.get(t.seat)!;
    const rankPoints = RANK_POINTS[Math.min(rank - 1, RANK_POINTS.length - 1)];
    const timeBonus = Math.round((TIME_BONUS_MAX * Math.max(0, turnMs - t.timeMs)) / turnMs);
    return { seat: t.seat, solved: true, timeMs: t.timeMs, rank, rankPoints, timeBonus, points: rankPoints + timeBonus, wrong: t.wrong.length };
  });
}

function closeTurn(r: OfflineRun, solved: boolean, timeMs: number): OfflineRun {
  const turns = [...r.turns, { seat: currentSeat(r), solved, timeMs, wrong: r.wrong }];
  const base = { ...r, turns, elapsedMs: 0, runningSince: null, lockUntil: 0, wrong: [] as string[], before: null };
  const t = nextTurn(r, r.turn + 1);
  if (t < r.order.length) return { ...base, turn: t, phase: 'handoff' };
  return { ...base, phase: 'photoOver', results: [...r.results, { riddleId: currentPhoto(r), scores: scorePhoto(turns, r.turnMs) }] };
}

export function stepOffline(r: OfflineRun, e: OfflineEvent): OfflineRun {
  switch (e.type) {
    case 'READY':
      return r.phase === 'handoff' ? { ...r, phase: 'playing', runningSince: e.now } : r;
    case 'GUESS': {
      if (r.phase !== 'playing') return r;
      if (turnLeft(r, e.now) <= 0) return closeTurn(r, false, r.turnMs);
      if (lockLeft(r, e.now) > 0 || r.wrong.includes(e.answerId)) return r;
      const at = turnElapsed(r, e.now);
      if (e.answerId === currentPhoto(r)) return closeTurn(r, true, at);
      return { ...r, wrong: [...r.wrong, e.answerId], lockUntil: at + LOCK_MS, wrongSeq: r.wrongSeq + 1 };
    }
    case 'TICK':
      return r.phase === 'playing' && turnLeft(r, e.now) <= 0 ? closeTurn(r, false, r.turnMs) : r;
    case 'PAUSE':
      if (r.phase === 'playing') return { ...r, phase: 'paused', before: 'playing', elapsedMs: turnElapsed(r, e.now), runningSince: null };
      if (r.phase === 'handoff' || r.phase === 'photoOver') return { ...r, phase: 'paused', before: r.phase };
      return r;
    case 'RESUME':
      if (r.phase !== 'paused' || !r.before) return r;
      return r.before === 'playing' ? { ...r, phase: 'playing', before: null, runningSince: e.now } : { ...r, phase: r.before, before: null };
    case 'NEXT': {
      if (r.phase !== 'photoOver') return r;
      if (r.index + 1 >= r.photos.length) return { ...r, phase: 'done' };
      return { ...r, index: r.index + 1, turn: nextTurn(r, 0), turns: [], phase: 'handoff' };
    }
    case 'REMOVE': {
      // Rule 17: a removed player's turns are skipped; at least 2 stay. A turn they were playing is dropped.
      const left = r.order.filter((s) => !r.removed.includes(s));
      if (r.removed.includes(e.seat) || left.length <= 2 || r.phase === 'done') return r;
      const removed = [...r.removed, e.seat];
      const over = r.phase === 'photoOver' || (r.phase === 'paused' && r.before === 'photoOver');
      const next: OfflineRun = { ...r, removed, turns: r.turns.filter((t) => t.seat !== e.seat) };
      if (over || currentSeat(r) !== e.seat) return next;
      const dropped = { ...next, elapsedMs: 0, runningSince: null, lockUntil: 0, wrong: [] as string[] };
      const t = nextTurn(dropped, r.turn + 1);
      const moved: OfflineRun =
        t < r.order.length
          ? { ...dropped, turn: t, phase: 'handoff', before: null }
          : { ...dropped, phase: 'photoOver', before: null, results: [...r.results, { riddleId: currentPhoto(r), scores: scorePhoto(dropped.turns, r.turnMs) }] };
      return r.phase === 'paused' ? { ...moved, phase: 'paused', before: moved.phase as 'handoff' | 'photoOver' } : moved;
    }
  }
}

/** Saved for resume: a running turn is saved paused at the exact clock (rule 10). */
export const snapshotOffline = (r: OfflineRun, now: number) => (r.phase === 'playing' ? stepOffline(r, { type: 'PAUSE', now }) : r);

/** The hand-off line (RD5): how the previous player did on this picture. */
export function previousLine(r: OfflineRun, names: Record<number, string>, clock: (ms: number) => string) {
  const last = r.turns[r.turns.length - 1];
  if (!last) return null;
  const who = names[last.seat] ?? `Player ${last.seat + 1}`;
  return last.solved ? `${who} solved it in ${clock(last.timeMs)}` : `${who} ran out of time`;
}

export type OfflineRow = Row & { wrong: number };

/** Standings: total points, then less total time used, then fewest wrong guesses (as coded). */
export function offlineRows(r: OfflineRun, names: Record<number, string>): OfflineRow[] {
  return r.order
    .filter((seat) => !r.removed.includes(seat))
    .map((seat) => {
      const mine = r.results.flatMap((p) => p.scores.filter((x) => x.seat === seat));
      return {
        seat,
        name: names[seat] ?? `Player ${seat + 1}`,
        score: mine.reduce((a, x) => a + x.points, 0),
        timeMs: mine.reduce((a, x) => a + x.timeMs, 0),
        wrong: mine.reduce((a, x) => a + x.wrong, 0),
      };
    });
}

export const riddlerTieBreak = (a: { wrong: number }, b: { wrong: number }) => a.wrong - b.wrong;

/**
 * OF1: what happened since `seat` last played: each solve or time-out (no answers), "everyone else has
 * solved this picture" (RD8's "Only you left"), then a lead change from the pictures scored since.
 */
export function offlineRecap(r: OfflineRun, seat: number, play: Pick<Play, 'seats' | 'settings'>, clock: (ms: number) => string): RecapLine[] {
  const current = r.results.length === r.index ? r.turns : [];
  const flat = [
    ...r.results.flatMap((p, photo) => p.scores.map((x) => ({ seat: x.seat, solved: x.solved, timeMs: x.timeMs, photo }))),
    ...current.map((x) => ({ seat: x.seat, solved: x.solved, timeMs: x.timeMs, photo: r.index })),
  ];
  const last = lastIndexOf(flat, seat);
  const seatOf = new Map(play.seats.map((x) => [x.seat, x]));
  const events: RecapLine[] = flat.slice(last + 1).map((x, i) => event(`rd-${last + 1 + i}`, x.seat, seatOf.get(x.seat), x.solved ? `solved it in ${clock(x.timeMs)}` : 'ran out of time'));
  const others = r.order.filter((s) => s !== seat && !r.removed.includes(s));
  if (current.length && !current.some((x) => x.seat === seat) && others.every((s) => current.some((x) => x.seat === s && x.solved)))
    events.push({ key: `rd-left-${r.index}`, text: 'Everyone else has solved this picture' });
  if (!events.length) return [];
  // A picture counts once its last turn is played; compare the table when this player last finished with now.
  const doneAt = r.results.map((_, photo) => flat.map((x) => x.photo).lastIndexOf(photo));
  const scores = (n: number) => r.order.filter((s) => !r.removed.includes(s)).map((s) => ({ seat: s, score: r.results.slice(0, n).flatMap((p) => p.scores).filter((x) => x.seat === s).reduce((a, x) => a + x.points, 0) }));
  const before = doneAt.filter((at) => at <= last).length;
  return finishRecap(events, leadLine(sides(scores(before), play), sides(scores(r.results.length), play)));
}
