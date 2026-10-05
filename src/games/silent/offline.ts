// The Silent Artist Offline (one phone), SA3-SA6 and TMG-SA, ported from the old engine:
// pass the phone to the performer, secret pick of 1 of 3 in 10 s (draw or act, SA4), the room guesses out
// loud while the phone shows the timer and hint ladder; the performer taps "Got it" and names the guesser.
// Teams (shared team setup): the performing team scores the guess; on time up the next team in order gets
// one 15 s steal worth a flat 10. Everyone performs 1, 2 or 3 times (SA6).
import type { Row } from '../engine/standings';
import type { Play } from '../engine/types';
import { event, finishRecap, lastIndexOf, leadLine, sides, type RecapLine } from '../shell/recap';
import { SA, guesserPoints, hashSeed, hintPlan, performerShare, pickWords, remember, type HintPlan, type Kind, type Word } from './core';

export type PlanTurn = { seat: number; team: number | null };
export type Outcome = 'guessed' | 'stolen' | 'missed' | 'skipped';
export type TurnRecord = {
  seat: number;
  team: number | null;
  wordId: string;
  kind: Kind;
  outcome: Outcome;
  /** Ms into the turn when it was guessed (or the full turn when nobody got it). */
  atMs: number;
  /** Individuals: who guessed. */
  guesser: number | null;
  /** Teams: who stole it. */
  stealTeam: number | null;
  /** Guesser points (or the team's points); performerPoints is the performer's half (individuals). */
  points: number;
  performerPoints: number;
};

export type Phase = 'handoff' | 'picking' | 'performing' | 'whoGot' | 'stealing' | 'reveal' | 'paused' | 'done';

export type OfflineRun = {
  plan: PlanTurn[];
  /** Team ids in turn order, or null without teams. */
  teams: number[] | null;
  turnMs: number;
  index: number;
  phase: Phase;
  before: Exclude<Phase, 'paused' | 'done'> | null;
  /** Clock of the timed phase (picking, performing, stealing). */
  elapsedMs: number;
  runningSince: number | null;
  options: string[];
  wordId: string | null;
  kind: Kind;
  hints: HintPlan | null;
  gotAt: number | null;
  used: string[];
  recent: string[];
  rng: number;
  seed: number;
  turns: TurnRecord[];
  removed: number[];
  scores: Record<number, number>;
  teamScores: Record<number, number>;
};

export type OfflineEvent =
  | { type: 'READY'; now: number }
  | { type: 'KIND'; kind: Kind }
  | { type: 'PICK'; wordId: string; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'GOT_IT'; now: number }
  | { type: 'UNDO_GOT'; now: number }
  | { type: 'CREDIT'; seat: number }
  | { type: 'GIVE_UP'; now: number }
  | { type: 'STEAL'; success: boolean }
  | { type: 'NEXT' }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'REMOVE'; seat: number };

/**
 * SA6 turn order. Individuals: everyone once per round, `rounds` rounds.
 * Teams: teams alternate in order and each rotates its players; every team gets
 * largest-team x rounds turns, so uneven teams still perform equally often (smaller teams repeat players).
 */
export function buildPlan(seats: { seat: number; team?: number }[], teamOrder: number[] | null, rounds: number): PlanTurn[] {
  const plan: PlanTurn[] = [];
  if (!teamOrder) {
    for (let r = 0; r < rounds; r++) for (const s of seats) plan.push({ seat: s.seat, team: null });
    return plan;
  }
  const groups = teamOrder.map((id) => ({ id, seats: seats.filter((s) => s.team === id).map((s) => s.seat) })).filter((g) => g.seats.length);
  const perTeam = Math.max(...groups.map((g) => g.seats.length)) * rounds;
  for (let i = 0; i < perTeam; i++) for (const g of groups) plan.push({ seat: g.seats[i % g.seats.length], team: g.id });
  return plan;
}

export function startOffline(p: { plan: PlanTurn[]; teams: number[] | null; turnMs: number; seed: string; recent?: string[] }): OfflineRun {
  const seats = [...new Set(p.plan.map((t) => t.seat))];
  return {
    plan: p.plan, teams: p.teams, turnMs: p.turnMs, index: 0, phase: 'handoff', before: null, elapsedMs: 0, runningSince: null,
    options: [], wordId: null, kind: 'drawing', hints: null, gotAt: null, used: [], recent: p.recent ?? [],
    rng: hashSeed(p.seed), seed: hashSeed(`${p.seed}:hints`), turns: [], removed: [],
    scores: Object.fromEntries(seats.map((s) => [s, 0])),
    teamScores: Object.fromEntries((p.teams ?? []).map((t) => [t, 0])),
  };
}

export const currentTurn = (r: OfflineRun) => r.plan[Math.min(r.index, r.plan.length - 1)];
export const elapsed = (r: OfflineRun, now: number) => r.elapsedMs + (r.runningSince == null ? 0 : Math.max(0, now - r.runningSince));
const limitOf = (r: OfflineRun, phase: Phase) => (phase === 'picking' ? SA.pickMs : phase === 'stealing' ? SA.stealMs : r.turnMs);
/** Ms left in the current timed phase. */
export const timeLeft = (r: OfflineRun, now: number) => Math.max(0, limitOf(r, r.phase === 'paused' ? (r.before ?? r.phase) : r.phase) - elapsed(r, now));
/** The next team in order after `team` that still has players: who gets the steal. */
export function stealTeamOf(r: OfflineRun, team: number | null) {
  if (!r.teams || team == null) return null;
  const live = r.teams.filter((t) => r.plan.some((p) => p.team === t && !r.removed.includes(p.seat)));
  const i = live.indexOf(team);
  return live.length > 1 ? live[(i + 1) % live.length] : null;
}

const timed = (p: Phase) => p === 'picking' || p === 'performing' || p === 'stealing';

/** First plan turn at or after `from` whose performer is still playing. */
function nextIndex(r: OfflineRun, from: number) {
  let i = from;
  while (i < r.plan.length && r.removed.includes(r.plan[i].seat)) i++;
  return i;
}

function beginPerforming(r: OfflineRun, wordId: string, now: number): OfflineRun {
  return { ...r, phase: 'performing', wordId, hints: null, gotAt: null, elapsedMs: 0, runningSince: now, used: [...r.used, wordId], recent: remember(r.recent, wordId) };
}

function record(r: OfflineRun, rec: Omit<TurnRecord, 'seat' | 'team' | 'wordId' | 'kind'>): OfflineRun {
  const t = currentTurn(r);
  const turn: TurnRecord = { seat: t.seat, team: t.team, wordId: r.wordId ?? '', kind: r.kind, ...rec };
  const scores = { ...r.scores };
  const teamScores = { ...r.teamScores };
  if (rec.outcome === 'guessed' && t.team == null && rec.guesser != null) {
    scores[rec.guesser] = (scores[rec.guesser] ?? 0) + rec.points;
    scores[t.seat] = (scores[t.seat] ?? 0) + rec.performerPoints;
  }
  if (rec.outcome === 'guessed' && t.team != null) teamScores[t.team] = (teamScores[t.team] ?? 0) + rec.points;
  if (rec.outcome === 'stolen' && rec.stealTeam != null) teamScores[rec.stealTeam] = (teamScores[rec.stealTeam] ?? 0) + rec.points;
  return { ...r, turns: [...r.turns, turn], scores, teamScores, phase: 'reveal', elapsedMs: 0, runningSince: null, before: null };
}

function timeUp(r: OfflineRun): OfflineRun {
  const t = currentTurn(r);
  const steal = stealTeamOf(r, t.team);
  if (steal != null) return { ...r, phase: 'stealing', elapsedMs: 0, runningSince: null, gotAt: r.turnMs };
  return record(r, { outcome: 'missed', atMs: r.turnMs, guesser: null, stealTeam: null, points: 0, performerPoints: 0 });
}

export function stepOffline(r: OfflineRun, e: OfflineEvent, pool: readonly Word[]): OfflineRun {
  switch (e.type) {
    case 'READY': {
      if (r.phase !== 'handoff') return r;
      const [opts, rng] = pickWords(pool, r.rng, { count: SA.options, used: r.used, recent: r.recent });
      return { ...r, phase: 'picking', options: opts.map((w) => w.id), kind: 'drawing', rng, elapsedMs: 0, runningSince: e.now };
    }
    case 'KIND':
      return r.phase === 'picking' ? { ...r, kind: e.kind } : r;
    case 'PICK': {
      if (r.phase !== 'picking' || !r.options.includes(e.wordId)) return r;
      return withPlan(beginPerforming(r, e.wordId, e.now), pool);
    }
    case 'TICK': {
      if (!timed(r.phase) || timeLeft(r, e.now) > 0) return r;
      if (r.phase === 'picking') return withPlan(beginPerforming(r, r.options[0], e.now), pool);
      if (r.phase === 'performing') return timeUp(r);
      // A steal that runs out is a miss.
      return record(r, { outcome: 'missed', atMs: r.turnMs, guesser: null, stealTeam: null, points: 0, performerPoints: 0 });
    }
    case 'GIVE_UP':
      return r.phase === 'performing' ? timeUp({ ...r, elapsedMs: elapsed(r, e.now), runningSince: null }) : r;
    case 'GOT_IT': {
      if (r.phase !== 'performing' || !r.hints) return r;
      const at = Math.min(r.turnMs, elapsed(r, e.now));
      const t = currentTurn(r);
      if (t.team != null) {
        const points = guesserPoints(at, r.turnMs, r.hints.fieldAt);
        return record({ ...r, gotAt: at }, { outcome: 'guessed', atMs: at, guesser: null, stealTeam: null, points, performerPoints: 0 });
      }
      return { ...r, phase: 'whoGot', gotAt: at, elapsedMs: at, runningSince: null };
    }
    case 'UNDO_GOT':
      return r.phase === 'whoGot' ? { ...r, phase: 'performing', gotAt: null, runningSince: e.now } : r;
    case 'CREDIT': {
      if (r.phase !== 'whoGot' || r.gotAt == null || !r.hints) return r;
      const t = currentTurn(r);
      if (e.seat === t.seat || r.removed.includes(e.seat) || !(e.seat in r.scores)) return r;
      const points = guesserPoints(r.gotAt, r.turnMs, r.hints.fieldAt);
      return record(r, { outcome: 'guessed', atMs: r.gotAt, guesser: e.seat, stealTeam: null, points, performerPoints: performerShare(points) });
    }
    case 'STEAL': {
      if (r.phase !== 'stealing') return r;
      const team = stealTeamOf(r, currentTurn(r).team);
      return e.success
        ? record(r, { outcome: 'stolen', atMs: r.turnMs, guesser: null, stealTeam: team, points: SA.score.steal, performerPoints: 0 })
        : record(r, { outcome: 'missed', atMs: r.turnMs, guesser: null, stealTeam: null, points: 0, performerPoints: 0 });
    }
    case 'NEXT': {
      if (r.phase !== 'reveal') return r;
      const i = nextIndex(r, r.index + 1);
      const base = { ...r, options: [], wordId: null, hints: null, gotAt: null, kind: 'drawing' as Kind };
      return i < r.plan.length ? { ...base, index: i, phase: 'handoff' } : { ...base, index: i, phase: 'done' };
    }
    case 'PAUSE':
      if (r.phase === 'paused' || r.phase === 'done') return r;
      return { ...r, phase: 'paused', before: r.phase, elapsedMs: timed(r.phase) ? elapsed(r, e.now) : r.elapsedMs, runningSince: null };
    case 'RESUME':
      if (r.phase !== 'paused' || !r.before) return r;
      return { ...r, phase: r.before, before: null, runningSince: timed(r.before) ? e.now : null };
    case 'REMOVE': {
      // Rule 17: a removed player's turns are skipped; at least 2 players stay. Their running turn is dropped.
      const live = [...new Set(r.plan.map((t) => t.seat))].filter((s) => !r.removed.includes(s));
      if (r.removed.includes(e.seat) || live.length <= 2 || r.phase === 'done') return r;
      const removed = [...r.removed, e.seat];
      const next = { ...r, removed };
      const cur = r.phase === 'paused' ? r.before : r.phase;
      if (currentTurn(r).seat !== e.seat || cur === 'reveal') return next;
      const skipped: OfflineRun = { ...next, turns: [...r.turns, { seat: e.seat, team: currentTurn(r).team, wordId: r.wordId ?? '', kind: r.kind, outcome: 'skipped', atMs: 0, guesser: null, stealTeam: null, points: 0, performerPoints: 0 }] };
      const i = nextIndex(skipped, r.index + 1);
      const base = { ...skipped, options: [], wordId: null, hints: null, gotAt: null, elapsedMs: 0, runningSince: null, before: null };
      return i < r.plan.length ? { ...base, index: i, phase: 'handoff' } : { ...base, index: i, phase: 'done' };
    }
  }
}

function withPlan(r: OfflineRun, pool: readonly Word[]): OfflineRun {
  const word = pool.find((w) => w.id === r.wordId);
  return word ? { ...r, hints: hintPlan(word, r.turnMs, r.seed + r.index) } : r;
}

/** Saved for resume: a running clock is saved paused (rule 10). */
export const snapshotOffline = (r: OfflineRun, now: number, pool: readonly Word[]) => (timed(r.phase) ? stepOffline(r, { type: 'PAUSE', now }, pool) : r);

/**
 * Standings. Individuals: own points. Teams: every player carries their team's total, so the shared
 * team table (average of equal numbers) shows the team's points.
 */
export function offlineRows(r: OfflineRun, names: Record<number, string>, teamOf: (seat: number) => number | undefined): Row[] {
  const seats = [...new Set(r.plan.map((t) => t.seat))].filter((s) => !r.removed.includes(s));
  return seats.map((seat) => {
    const team = teamOf(seat);
    const score = r.teams && team != null ? (r.teamScores[team] ?? 0) : (r.scores[seat] ?? 0);
    const timeMs = r.turns.filter((t) => t.outcome === 'guessed' && (t.guesser === seat || (r.teams && t.team === team))).reduce((a, t) => a + t.atMs, 0);
    return { seat, name: names[seat] ?? `Player ${seat + 1}`, score, timeMs };
  });
}

/** One line for a finished turn, as the pass-the-phone recap shows it (OF1). */
export function turnNote(t: TurnRecord, nameOf: (seat: number) => string, teamName: (id: number) => string, clock: (ms: number) => string) {
  const how = t.kind === 'acting' ? 'acting' : 'drawing';
  if (t.outcome === 'guessed') return t.guesser != null ? `'s ${how} was guessed by ${nameOf(t.guesser)} in ${clock(t.atMs)}` : `'s ${how} was guessed in ${clock(t.atMs)}`;
  if (t.outcome === 'stolen') return `'s ${how} was stolen by ${t.stealTeam != null ? teamName(t.stealTeam) : 'the next team'}`;
  if (t.outcome === 'skipped') return ' was skipped';
  return `'s ${how}: nobody got it`;
}

/** OF1: what happened since `seat` last performed, plus a lead change. */
export function offlineRecap(r: OfflineRun, seat: number, play: Pick<Play, 'seats' | 'settings'>, teamName: (id: number) => string, clock: (ms: number) => string): RecapLine[] {
  const last = lastIndexOf(r.turns, seat);
  const seatOf = new Map(play.seats.map((x) => [x.seat, x]));
  const nameOf = (s: number) => seatOf.get(s)?.name ?? `Player ${s + 1}`;
  const events = r.turns.slice(last + 1).map((t, i) => {
    const note = turnNote(t, nameOf, teamName, clock);
    const who = seatOf.get(t.seat);
    return { ...event(`sa-${last + 1 + i}`, t.seat, who, note), text: `${who?.name ?? `Player ${t.seat + 1}`}${note}` };
  });
  if (!events.length) return [];
  const scoresAt = (n: number) => {
    const sc: Record<number, number> = {};
    const tsc: Record<number, number> = {};
    for (const t of r.turns.slice(0, n)) {
      if (t.outcome === 'guessed' && t.team == null && t.guesser != null) {
        sc[t.guesser] = (sc[t.guesser] ?? 0) + t.points;
        sc[t.seat] = (sc[t.seat] ?? 0) + t.performerPoints;
      }
      if (t.outcome === 'guessed' && t.team != null) tsc[t.team] = (tsc[t.team] ?? 0) + t.points;
      if (t.outcome === 'stolen' && t.stealTeam != null) tsc[t.stealTeam] = (tsc[t.stealTeam] ?? 0) + t.points;
    }
    const seats = [...new Set(r.plan.map((t) => t.seat))].filter((s) => !r.removed.includes(s));
    return seats.map((s) => ({ seat: s, score: r.teams ? (tsc[seatOf.get(s)?.team ?? -1] ?? 0) : (sc[s] ?? 0) }));
  };
  return finishRecap(events, leadLine(sides(scoresAt(last + 1), play), sides(scoresAt(r.turns.length), play)));
}
