// The Streak Master: one player's timed round (SM3-SM5, SM11-SM13), ported from the coded timedRound.
// The Nth right answer in a row scores N; a wrong answer resets the streak to 0. After each answer the
// result shows briefly with the clock stopped. Helpers (Solo only): remove 2 wrong, skip (keeps the
// streak, scores 0), +10 s. Pure: (round, event) => round; time comes from event timestamps.

export type Kind = 'clinical' | 'basic';
export type Style = Kind | 'mixed';

export type Question = {
  id: string;
  kind: Kind;
  field: string;
  stem: string;
  choices: string[];
  /** Index of the right choice in `choices`. */
  answer: number;
  explanation: string | null;
  /** Canonical dossier id when the answer is a disease with a dossier (SM1, RS1). */
  dossier: string | null;
};

export type HelperKind = 'remove' | 'skip' | 'time';
export const HELPER_PRICE: Record<HelperKind, number> = { remove: 1, skip: 3, time: 1 }; // SM11
export const REMOVE_COUNT = 2;
export const ADD_MS = 10_000;
/** Result shows this long with the clock stopped (as coded); a miss stays longer so the right answer can be read. */
export const FEEDBACK_MS = { right: 1000, wrong: 1700 };
export const LENGTHS = [60, 90, 120];

export type Answer = {
  qId: string;
  /** Picked choice (index in the question's own `choices`), null when skipped. */
  picked: number | null;
  outcome: 'right' | 'wrong' | 'skipped';
  points: number;
  streak: number;
  timeMs: number;
};

export type RoundPhase = 'playing' | 'feedback' | 'paused' | 'over';

export type Round = {
  lengthMs: number;
  queue: string[];
  index: number;
  /** Display order of the current question's choices (indices into `choices`). */
  order: number[];
  /** Choices taken away by "Remove 2" (indices into `choices`). */
  removed: number[];
  remainingMs: number;
  runningSince: number | null;
  /** When the current question appeared on the clock, for its answer time. */
  shownAtMs: number;
  phase: RoundPhase;
  before: 'playing' | 'feedback' | null;
  streak: number;
  maxStreak: number;
  score: number;
  feedback: { picked: number; right: boolean; points: number; untilMs: number } | null;
  answers: Answer[];
  helpers: Record<HelperKind, number>;
  endReason: 'time' | 'questions' | null;
};

export type RoundEvent =
  | { type: 'ANSWER'; choice: number; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'HELPER'; kind: HelperKind; now: number };

export type Rng = () => number;

export function shuffle<T>(xs: T[], rng: Rng = Math.random): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const orderFor = (rng: Rng) => shuffle([0, 1, 2, 3, 4, 5], rng);

export function startRound(queue: string[], lengthSec: number, now: number, rng: Rng = Math.random): Round {
  return {
    lengthMs: lengthSec * 1000, queue, index: 0, order: orderFor(rng), removed: [], remainingMs: lengthSec * 1000,
    runningSince: now, shownAtMs: 0, phase: queue.length ? 'playing' : 'over', before: null, streak: 0, maxStreak: 0,
    score: 0, feedback: null, answers: [], helpers: { remove: 0, skip: 0, time: 0 }, endReason: queue.length ? null : 'questions',
  };
}

/** Time left on the round clock right now. */
export const timeLeft = (r: Round, now: number) => Math.max(0, r.remainingMs - (r.runningSince == null ? 0 : Math.max(0, now - r.runningSince)));
/** Clock time used so far (for answer times). */
const usedMs = (r: Round, now: number) => r.lengthMs + r.helpers.time * ADD_MS - timeLeft(r, now);

export const currentId = (r: Round) => r.queue[r.index];

function over(r: Round, now: number, reason: 'time' | 'questions'): Round {
  return { ...r, phase: 'over', before: null, remainingMs: reason === 'time' ? 0 : timeLeft(r, now), runningSince: null, feedback: null, endReason: reason };
}

function nextQuestion(r: Round, now: number, rng: Rng): Round {
  const index = r.index + 1;
  if (index >= r.queue.length) return over(r, now, 'questions');
  return { ...r, index, order: orderFor(rng), removed: [], shownAtMs: usedMs(r, now), phase: 'playing', feedback: null };
}

/**
 * One event. `answerOf` gives the right choice for a question id, so the reducer never needs the bank.
 * `wrongOf` lists a question's wrong choices for "Remove 2".
 */
export function stepRound(r: Round, e: RoundEvent, answerOf: (id: string) => number, rng: Rng = Math.random): Round {
  switch (e.type) {
    case 'ANSWER': {
      if (r.phase !== 'playing' || r.removed.includes(e.choice) || e.choice < 0 || e.choice > 5) return r;
      if (timeLeft(r, e.now) <= 0) return over(r, e.now, 'time');
      const right = e.choice === answerOf(currentId(r));
      const streak = right ? r.streak + 1 : 0;
      const points = right ? streak : 0;
      const remainingMs = timeLeft(r, e.now);
      const answer: Answer = { qId: currentId(r), picked: e.choice, outcome: right ? 'right' : 'wrong', points, streak, timeMs: usedMs(r, e.now) - r.shownAtMs };
      return {
        ...r, phase: 'feedback', remainingMs, runningSince: null, streak, maxStreak: Math.max(r.maxStreak, streak), score: r.score + points,
        feedback: { picked: e.choice, right, points, untilMs: e.now + (right ? FEEDBACK_MS.right : FEEDBACK_MS.wrong) },
        answers: [...r.answers, answer],
      };
    }
    case 'TICK': {
      if (r.phase === 'feedback' && r.feedback && e.now >= r.feedback.untilMs) {
        const resumed = { ...r, runningSince: e.now };
        return r.remainingMs <= 0 ? over(r, e.now, 'time') : nextQuestion(resumed, e.now, rng);
      }
      if (r.phase === 'playing' && timeLeft(r, e.now) <= 0) return over(r, e.now, 'time');
      return r;
    }
    case 'PAUSE': {
      if (r.phase === 'playing') return { ...r, phase: 'paused', before: 'playing', remainingMs: timeLeft(r, e.now), runningSince: null };
      // A pause during feedback keeps the feedback's own leftover time.
      if (r.phase === 'feedback' && r.feedback) return { ...r, phase: 'paused', before: 'feedback', feedback: { ...r.feedback, untilMs: r.feedback.untilMs - e.now } };
      return r;
    }
    case 'RESUME': {
      if (r.phase !== 'paused') return r;
      if (r.before === 'feedback' && r.feedback) return { ...r, phase: 'feedback', before: null, feedback: { ...r.feedback, untilMs: e.now + Math.max(0, r.feedback.untilMs) } };
      return { ...r, phase: 'playing', before: null, runningSince: e.now };
    }
    case 'HELPER': {
      // Paid before this event arrives (the screen spends the tokens first, then refunds if this does nothing).
      if (r.phase !== 'playing') return r;
      const helpers = { ...r.helpers, [e.kind]: r.helpers[e.kind] + 1 };
      if (e.kind === 'time') return { ...r, helpers, remainingMs: timeLeft(r, e.now) + ADD_MS, runningSince: e.now };
      if (e.kind === 'skip') {
        const answer: Answer = { qId: currentId(r), picked: null, outcome: 'skipped', points: 0, streak: r.streak, timeMs: usedMs(r, e.now) - r.shownAtMs };
        return nextQuestion({ ...r, helpers, answers: [...r.answers, answer] }, e.now, rng);
      }
      if (r.removed.length) return r; // once per question (as coded)
      const right = answerOf(currentId(r));
      const removed = shuffle([0, 1, 2, 3, 4, 5].filter((i) => i !== right), rng).slice(0, REMOVE_COUNT);
      return { ...r, helpers, removed };
    }
  }
}

/** Whether a helper would do anything right now (so the screen doesn't charge for nothing). */
export function helperUsable(r: Round, kind: HelperKind) {
  if (r.phase !== 'playing') return false;
  return kind !== 'remove' || r.removed.length === 0;
}

/** Saved for resume: a running round is saved paused at the exact clock (rules 7, 10). */
export function snapshotRound(r: Round, now: number): Round {
  return r.phase === 'playing' || r.phase === 'feedback' ? stepRound(r, { type: 'PAUSE', now }, () => -1) : r;
}

/** SM12: Solo EXP is half the round's score, rounded down. */
export const soloExp = (score: number) => Math.floor(score / 2);

/** The most a round could score if every answer were right at one a second: the EXP sanity cap. */
export const maxScore = (lengthSec: number) => {
  const n = lengthSec + 60; // +10 s helpers
  return (n * (n + 1)) / 2;
};

/**
 * Questions for a style. Mixed is about half clinical, half basic per question (as coded),
 * built from two unseen-first lists so each side still avoids repeats.
 */
export function mixQueue(clinical: string[], basic: string[], rng: Rng = Math.random): string[] {
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < clinical.length || j < basic.length) {
    const takeClinical = j >= basic.length || (i < clinical.length && rng() < 0.5);
    out.push(takeClinical ? clinical[i++] : basic[j++]);
  }
  return out;
}

/** Offline standings tie-break (as coded): longest streak, then most right answers. */
export type PlayerRound = { seat: number; score: number; maxStreak: number; correct: number };
export const streakTieBreak = (a: PlayerRound, b: PlayerRound) => b.maxStreak - a.maxStreak || b.correct - a.correct;
