// Put it in order (رتّبها صح, Yazan 2026-11-18, Group 7): drag the steps of one process from the pool into numbered
// slots on a line. The pool also holds 2 or 3 decoys that belong to no slot (3 when the question has 5 steps or fewer,
// 2 when it has 6 or 7). Submit checks the whole order at once: all or nothing, 3 tries, and a wrong try says nothing
// about which steps are wrong. Points: 100 on try 1, 70 on try 2, 40 on try 3, plus up to 20 for speed.
// Paid help, once each a question: Place a step (2 tokens) puts one right step in its slot and fixes it there;
// Remove a decoy (1 token) takes one decoy away. Pure: runs in node tests.

export type Step = { t: string; n: string };
/** One question in the bank: `steps` in the right order, `decoys` that belong to no slot; `n` is each line's note. */
export type Question = { id: string; cat: string; q: string; steps: Step[]; decoys: Step[] };

export const ORDER = {
  /** Questions (Solo, Vs rivals) or rounds (Pass the phone) in setup. */
  counts: [3, 5, 10],
  tries: 3,
  /** Points for the right order on try 1, 2 and 3. */
  tryPoints: [100, 70, 40],
  speedMax: 20,
  /** The speed bonus runs down to 0 over this time; Pass the phone and Vs rivals also end a question here. */
  turnMs: 90_000,
  placeCost: 2,
  decoyCost: 1,
  /** EXP: points ÷ 10, a question counted up to its most (120 = 12 EXP). */
  maxPoints: 120,
};

type Rand = () => number;
export function shuffle<T>(xs: readonly T[], r: Rand): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * One player's go at one question. Cards are numbers: card i < steps is step i (its right slot is i); a card from
 * `steps` on is a decoy. `slots[i]` is the card in slot i (null = empty).
 */
export type QRun = {
  /** The pool's shown order (cards keep their place in the pool when they come back). */
  order: number[];
  slots: (number | null)[];
  /** Wrong tries so far. */
  wrong: number;
  solved: boolean;
  done: boolean;
  /** Decoys taken away by the helper. */
  gone: number[];
  /** Slots filled by Place a step: fixed, they can't move. */
  fixed: number[];
  placeUsed: boolean;
  decoyUsed: boolean;
  timeUp: boolean;
  /** Bumped on each wrong try, so the screen can shake once. */
  miss: number;
};

export const cardCount = (q: Question) => q.steps.length + q.decoys.length;
export const isDecoy = (q: Question, card: number) => card >= q.steps.length;
export const cardOf = (q: Question, card: number): Step => (card < q.steps.length ? q.steps[card] : q.decoys[card - q.steps.length]);

export function startRun(q: Question, r: Rand): QRun {
  const n = cardCount(q);
  // Never deal the pool already in the right order.
  let order = shuffle(Array.from({ length: n }, (_, i) => i), r);
  if (order.slice(0, q.steps.length).every((c, i) => c === i)) order = [...order.slice(1), order[0]];
  return { order, slots: q.steps.map(() => null), wrong: 0, solved: false, done: false, gone: [], fixed: [], placeUsed: false, decoyUsed: false, timeUp: false, miss: 0 };
}

/** Where a card is now: a slot index, or null when it is in the pool. */
export const slotOf = (run: QRun, card: number) => {
  const i = run.slots.indexOf(card);
  return i < 0 ? null : i;
};
/** The cards still in the pool, in the pool's order. */
export const poolOf = (run: QRun) => run.order.filter((c) => !run.slots.includes(c) && !run.gone.includes(c));
export const full = (run: QRun) => run.slots.every((c) => c != null);

export type Target = number | 'pool';

/**
 * Drops a card on a slot or back in the pool. Dropping on a filled slot swaps the two cards (the other one goes where
 * the dragged one came from: its slot, or the pool). Fixed slots never change. Returns the same run when nothing moves.
 */
export function move(run: QRun, card: number, to: Target): QRun {
  if (run.done || run.gone.includes(card)) return run;
  const from = slotOf(run, card);
  if (from != null && run.fixed.includes(from)) return run;
  if (to === 'pool') {
    if (from == null) return run;
    const slots = [...run.slots];
    slots[from] = null;
    return { ...run, slots };
  }
  if (to < 0 || to >= run.slots.length || to === from || run.fixed.includes(to)) return run;
  const slots = [...run.slots];
  const other = slots[to];
  slots[to] = card;
  if (from != null) slots[from] = other;
  return { ...run, slots };
}

export const pointsFor = (wrong: number, ms: number) => ORDER.tryPoints[wrong] + speedOf(ms);
export const speedOf = (ms: number) => Math.max(0, Math.round(ORDER.speedMax * (1 - ms / ORDER.turnMs)));
/** What a right order would score now. */
export const worthNow = (run: QRun, ms: number) => (run.done ? 0 : pointsFor(Math.min(run.wrong, ORDER.tries - 1), ms));

/** Submit: only with every slot filled. The whole order is right or it is not (all or nothing, 3 tries). */
export function submit(run: QRun): QRun {
  if (run.done || !full(run)) return run;
  if (run.slots.every((c, i) => c === i)) return { ...run, solved: true, done: true };
  const wrong = run.wrong + 1;
  return { ...run, wrong, miss: run.miss + 1, done: wrong >= ORDER.tries };
}

/** Time up: the question ends unsolved. */
export const timeUp = (run: QRun): QRun => (run.done ? run : { ...run, done: true, timeUp: true });

/** Place a step: one step not yet in its right slot goes there and is fixed (the card there moves out of the way). */
export function placeStep(run: QRun, r: Rand): QRun {
  if (run.done || run.placeUsed) return run;
  const open = run.slots.map((c, i) => (c === i ? -1 : i)).filter((i) => i >= 0);
  if (!open.length) return run;
  const i = open[Math.floor(r() * open.length)];
  const moved = move({ ...run, fixed: [] }, i, i);
  return { ...moved, fixed: [...run.fixed, i], placeUsed: true };
}

/** Remove a decoy: one decoy leaves the game (out of its slot, if it was in one). */
export function removeDecoy(q: Question, run: QRun, r: Rand): QRun {
  if (run.done || run.decoyUsed) return run;
  const left = run.order.filter((c) => isDecoy(q, c) && !run.gone.includes(c));
  if (!left.length) return run;
  const card = left[Math.floor(r() * left.length)];
  const slots = run.slots.map((c) => (c === card ? null : c));
  return { ...run, slots, gone: [...run.gone, card], decoyUsed: true };
}

/** A finished question's points: by try, plus speed; 0 when unsolved. */
export const runPoints = (run: QRun, ms: number) => (run.solved ? pointsFor(run.wrong, ms) : 0);
export const runExp = (points: number) => Math.floor(Math.min(points, ORDER.maxPoints) / 10);

/** Ties: more points, then faster. Equal on both share the place. */
export function rankRows<T extends { points: number; ms: number }>(rows: T[]): (T & { rank: number })[] {
  const cmp = (a: T, b: T) => b.points - a.points || a.ms - b.ms;
  const sorted = [...rows].sort(cmp);
  const out: (T & { rank: number })[] = [];
  sorted.forEach((x, i) => out.push({ ...x, rank: i > 0 && cmp(sorted[i - 1], x) === 0 ? out[i - 1].rank : i + 1 }));
  return out;
}
