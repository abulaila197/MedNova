// The Quiz Parade (QP1-QP8, Yazan 2026-10-24): 5, 10 or 15 questions of 7 types, scored one by one with no streak.
// Each question has its own timer by type (QP2); online the next question starts as soon as everyone has answered.
// Pure: (round, event) => round; time comes from event timestamps, the bank stays outside.
import { shuffle } from '../engine/random';

export type Kind = 'clinical' | 'basic';
export type Style = Kind | 'mixed';
export type QType = 'mcq' | 'tf' | 'r2o' | 'match' | 'reverse' | 'order' | 'closest';

type Base = { id: string; field: string; kind: Kind; prompt: string; explain?: string };
export type Question = Base &
  (
    | { style: 'mcq' | 'reverse'; choices: string[]; answer: number }
    | { style: 'tf'; answer: boolean }
    /** The two items to rule out are `out` (indices into `items`). */
    | { style: 'r2o'; items: string[]; out: number[] }
    | { style: 'match'; pairs: [string, string][] }
    /** `items` are stored in the right order. */
    | { style: 'order'; items: string[] }
    | { style: 'closest'; answer: number; unit: string }
  );

/** A player's answer. Indices always point into the question's own lists, never the shuffled display. */
export type Response =
  | { style: 'mcq' | 'reverse'; pick: number }
  | { style: 'tf'; value: boolean }
  | { style: 'r2o'; picks: number[] }
  /** map[i] = the right-hand index the player joined to left item i (-1 when left empty). */
  | { style: 'match'; map: number[] }
  /** The player's order, as indices into `items`. */
  | { style: 'order'; seq: number[] }
  | { style: 'closest'; value: number };

/** QP2: seconds to answer, by type. */
export const TIME_S: Record<QType, number> = { tf: 15, mcq: 25, reverse: 25, closest: 25, r2o: 30, match: 40, order: 40 };
/** QP3: points for a fully right answer, by type. Match and Order give part points per right item. */
export const POINTS: Record<QType, number> = { tf: 1, mcq: 2, reverse: 2, closest: 2, r2o: 3, match: 4, order: 4 };
/** QP6: Solo counts a Closest number guess within 10% of the answer. */
export const CLOSE_SHARE = 0.1;
/** The result shows this long before the next question; a miss stays longer so the right answer can be read. */
export const FEEDBACK_MS = { right: 1200, wrong: 2600 };

/** Part points: the share of right items, rounded to the nearest whole point. */
const part = (style: QType, right: number, total: number) => (total ? Math.round((POINTS[style] * right) / total) : 0);

export const withinTen = (value: number, answer: number) => Math.abs(value - answer) <= Math.abs(answer) * CLOSE_SHARE;

export type Grade = { points: number; right: boolean };

/**
 * One answer's points. Closest number here uses the Solo rule (within 10%); in Pass the phone and Online the
 * nearest player wins instead (nearestSeats), so those modes grade Closest number after everyone has answered.
 */
export function grade(q: Question, r: Response | null): Grade {
  const miss = { points: 0, right: false };
  if (!r || r.style !== q.style) return miss;
  switch (q.style) {
    case 'mcq':
    case 'reverse':
      return r.style === q.style && r.pick === q.answer ? { points: POINTS[q.style], right: true } : miss;
    case 'tf':
      return r.style === 'tf' && r.value === q.answer ? { points: POINTS.tf, right: true } : miss;
    case 'r2o': {
      if (r.style !== 'r2o') return miss;
      const ok = r.picks.length === q.out.length && q.out.every((i) => r.picks.includes(i));
      return ok ? { points: POINTS.r2o, right: true } : miss;
    }
    case 'match': {
      if (r.style !== 'match') return miss;
      const good = q.pairs.filter((_, i) => r.map[i] === i).length;
      return { points: part('match', good, q.pairs.length), right: good === q.pairs.length };
    }
    case 'order': {
      if (r.style !== 'order') return miss;
      const good = q.items.filter((_, i) => r.seq[i] === i).length;
      return { points: part('order', good, q.items.length), right: good === q.items.length };
    }
    case 'closest':
      return r.style === 'closest' && Number.isFinite(r.value) && withinTen(r.value, q.answer) ? { points: POINTS.closest, right: true } : miss;
  }
}

/** QP6: Pass the phone and Online give Closest number's points to the nearest guess (every seat on a tie). */
export function nearestSeats(answer: number, guesses: { seat: number; value: number | null }[]): number[] {
  const valid = guesses.filter((g): g is { seat: number; value: number } => g.value != null && Number.isFinite(g.value));
  if (!valid.length) return [];
  const best = Math.min(...valid.map((g) => Math.abs(g.value - answer)));
  return valid.filter((g) => Math.abs(g.value - answer) === best).map((g) => g.seat);
}

/** How a question is laid out on screen: a shuffled order of its choices, items or right-hand column. */
export function layoutFor(q: Question, rng: () => number = Math.random): number[] {
  const n = q.style === 'mcq' || q.style === 'reverse' ? q.choices.length : q.style === 'r2o' || q.style === 'order' ? q.items.length : q.style === 'match' ? q.pairs.length : 0;
  const idx = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return idx;
  // Order and Match must never start already solved.
  for (let k = 0; k < 6; k++) {
    const s = shuffle(idx, rng);
    if ((q.style !== 'order' && q.style !== 'match') || s.some((v, i) => v !== i)) return s;
  }
  return [...idx.slice(1), idx[0]];
}

export type HelperKind = 'remove' | 'skip' | 'time';
export const HELPER_PRICE: Record<HelperKind, number> = { remove: 1, skip: 3, time: 1 };
export const ADD_MS = 10_000;
/** QP9 (Yazan 2026-10-25): no Remove 2 in The Quiz Parade. */
export const REMOVE_ON = false;

export type Answer = { qId: string; response: Response | null; outcome: 'right' | 'wrong' | 'skipped'; points: number; timeMs: number };

export type RoundPhase = 'playing' | 'feedback' | 'paused' | 'over';

/** One player's game (Solo, and each turn in Pass the phone). */
export type Round = {
  queue: string[];
  index: number;
  layout: number[];
  /** Choices taken away by "Remove 2" (indices into the question's choices). */
  removed: number[];
  /** Time left for the current question, and when the clock last started. */
  remainingMs: number;
  runningSince: number | null;
  /** The current question's full time, for answer times. */
  limitMs: number;
  phase: RoundPhase;
  before: 'playing' | 'feedback' | null;
  score: number;
  feedback: { points: number; right: boolean; untilMs: number } | null;
  answers: Answer[];
  helpers: Record<HelperKind, number>;
};

export type RoundEvent =
  | { type: 'ANSWER'; response: Response; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'HELPER'; kind: HelperKind; now: number };

type Bank = (id: string) => Question | undefined;

const fresh = (r: Round, index: number, now: number, bank: Bank, rng: () => number): Round => {
  const q = bank(r.queue[index]);
  const limitMs = q ? TIME_S[q.style] * 1000 : 0;
  return { ...r, index, layout: q ? layoutFor(q, rng) : [], removed: [], remainingMs: limitMs, limitMs, runningSince: now, phase: 'playing', feedback: null };
};

export function startRound(queue: string[], now: number, bank: Bank, rng: () => number = Math.random): Round {
  const r: Round = {
    queue, index: 0, layout: [], removed: [], remainingMs: 0, runningSince: null, limitMs: 0, phase: 'over', before: null,
    score: 0, feedback: null, answers: [], helpers: { remove: 0, skip: 0, time: 0 },
  };
  return queue.length ? fresh(r, 0, now, bank, rng) : r;
}

export const timeLeft = (r: Round, now: number) => Math.max(0, r.remainingMs - (r.runningSince == null ? 0 : Math.max(0, now - r.runningSince)));
export const currentId = (r: Round) => r.queue[r.index];

function settle(r: Round, response: Response | null, outcome: Answer['outcome'] | null, now: number, bank: Bank): Round {
  const q = bank(currentId(r));
  const g = q && outcome !== 'skipped' ? grade(q, response) : { points: 0, right: false };
  const answer: Answer = { qId: currentId(r), response, outcome: outcome ?? (g.right ? 'right' : 'wrong'), points: g.points, timeMs: r.limitMs - timeLeft(r, now) };
  return {
    ...r, phase: 'feedback', remainingMs: timeLeft(r, now), runningSince: null, score: r.score + g.points, answers: [...r.answers, answer],
    feedback: { points: g.points, right: g.right, untilMs: now + (g.right ? FEEDBACK_MS.right : FEEDBACK_MS.wrong) },
  };
}

export function stepRound(r: Round, e: RoundEvent, bank: Bank, rng: () => number = Math.random): Round {
  switch (e.type) {
    case 'ANSWER':
      if (r.phase !== 'playing') return r;
      if (e.response.style === 'mcq' || e.response.style === 'reverse') if (r.removed.includes(e.response.pick)) return r;
      return settle(r, e.response, null, e.now, bank);
    case 'TICK': {
      if (r.phase === 'feedback' && r.feedback && e.now >= r.feedback.untilMs) {
        return r.index + 1 >= r.queue.length ? { ...r, phase: 'over', feedback: null } : fresh(r, r.index + 1, e.now, bank, rng);
      }
      // Time up counts as no answer.
      if (r.phase === 'playing' && timeLeft(r, e.now) <= 0) return settle(r, null, null, e.now, bank);
      return r;
    }
    case 'PAUSE':
      if (r.phase === 'playing') return { ...r, phase: 'paused', before: 'playing', remainingMs: timeLeft(r, e.now), runningSince: null };
      if (r.phase === 'feedback' && r.feedback) return { ...r, phase: 'paused', before: 'feedback', feedback: { ...r.feedback, untilMs: r.feedback.untilMs - e.now } };
      return r;
    case 'RESUME':
      if (r.phase !== 'paused') return r;
      if (r.before === 'feedback' && r.feedback) return { ...r, phase: 'feedback', before: null, feedback: { ...r.feedback, untilMs: e.now + Math.max(0, r.feedback.untilMs) } };
      return { ...r, phase: 'playing', before: null, runningSince: e.now };
    case 'HELPER': {
      // Paid before this event arrives (the screen spends the tokens first, then refunds if this does nothing).
      if (!helperUsable(r, e.kind, bank)) return r;
      const helpers = { ...r.helpers, [e.kind]: r.helpers[e.kind] + 1 };
      if (e.kind === 'time') return { ...r, helpers, remainingMs: timeLeft(r, e.now) + ADD_MS, limitMs: r.limitMs + ADD_MS, runningSince: e.now };
      if (e.kind === 'skip') return settle({ ...r, helpers }, null, 'skipped', e.now, bank);
      const q = bank(currentId(r));
      if (!q || (q.style !== 'mcq' && q.style !== 'reverse')) return r;
      const right = q.answer;
      const removed = shuffle(q.choices.map((_, i) => i).filter((i) => i !== right), rng).slice(0, Math.min(2, q.choices.length - 2));
      return { ...r, helpers, removed };
    }
  }
}

/** Whether a helper would do anything right now, so the screen doesn't charge for nothing. QP9: Solo offers only Skip and +10 s; Remove 2 stays switched off. */
export function helperUsable(r: Round, kind: HelperKind, bank: Bank) {
  if (r.phase !== 'playing') return false;
  if (kind !== 'remove') return true;
  if (!REMOVE_ON) return false;
  const q = bank(currentId(r));
  return !!q && (q.style === 'mcq' || q.style === 'reverse') && q.choices.length > 2 && r.removed.length === 0;
}

/** Saved for resume: a running round is saved paused at the exact clock. */
export function snapshotRound(r: Round, now: number, bank: Bank): Round {
  return r.phase === 'playing' || r.phase === 'feedback' ? stepRound(r, { type: 'PAUSE', now }, bank) : r;
}

/** Questions for a style: Mixed takes about half clinical, half basic. Each list should already be unseen-first. */
export function mixQueue(clinical: string[], basic: string[], n: number, rng: () => number = Math.random): string[] {
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (out.length < n && (i < clinical.length || j < basic.length)) {
    const takeClinical = j >= basic.length || (i < clinical.length && rng() < 0.5);
    out.push(takeClinical ? clinical[i++] : basic[j++]);
  }
  return out;
}

/** The right answer written out, for results, feedback and Today's review. */
export function answerText(q: Question): string {
  switch (q.style) {
    case 'mcq':
    case 'reverse':
      return q.choices[q.answer];
    case 'tf':
      return q.answer ? 'True' : 'False';
    case 'r2o':
      return q.out.map((i) => q.items[i]).join(' and ');
    case 'match':
      return q.pairs.map(([a, b]) => `${a}: ${b}`).join('; ');
    case 'order':
      return q.items.join(' > ');
    case 'closest':
      return `${q.answer}${q.unit ? ` ${q.unit}` : ''}`;
  }
}

export const TYPE_NAME: Record<QType, string> = {
  mcq: 'Multiple choice', tf: 'True or false', r2o: 'Rule out 2', match: 'Match the pairs', reverse: 'Reverse', order: 'Put in order', closest: 'Closest number',
};
