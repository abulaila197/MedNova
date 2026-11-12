// Trace the Treatment (Yazan's cards 2026-11-12): read a short patient story and name the treatment behind it, from 4
// believable choices. "Treatment" is anything done for the patient: a drug, an operation, a device, a therapy, a diet,
// a vaccine or first aid. Story types (14): it worked, side effect, overdose, antidote, stopped suddenly, interaction,
// given despite a no-go, after the procedure, years later, in pregnancy, what prevented it, didn't work, what comes
// next, first aid at the scene. One try a case; the answer card shows after it.
// Points: easy 2, medium 3, hard 4, wrong 0. EXP = points, at most 60 a day from this game.
// Help, paid in tokens, once a case (Solo and vs rivals): 50/50 (2 tokens).

export type Level = 1 | 2 | 3;
/** One choice and why it is (or isn't) the treatment. */
export type Opt = { o: string; w: string };
/**
 * One case in the bank. `a[0]` is the treatment; `a[1..3]` are believable ones the story rules out. `k` the story type,
 * `p` the setting (pad header), `q` the question, `s` the story, `t` the answer's title, `c` the key clue, `lq`/`la` the
 * Learn card (a short direct question, and the treatment).
 */
export type Case = { id: string; f: string; lv: Level; k: string; p: string; q: string; s: string; t: string; c: string; a: Opt[]; lq: string; la: string };

export const TTT = {
  /** Cases a game in setup. */
  cases: [1, 3, 5],
  /** Clock a case in minutes (0 = no clock). */
  clocks: [0, 1, 2, 3],
  /** Points by level (Yazan 2026-11-12); a wrong answer scores 0. */
  points: { 1: 2, 2: 3, 3: 4 } as Record<Level, number>,
  expDay: 60,
  fiftyCost: 2,
};

export const LEVEL_NAME: Record<Level, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

type Rand = () => number;
export function shuffle<T>(xs: readonly T[], r: Rand): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** One player's go at one case. `pick` is an option index (0 is right); -1 = no answer (time up). */
export type CaseRun = {
  /** The shown order of the choices. */
  order: number[];
  done: boolean;
  pick: number | null;
  /** 50/50: the 2 choices it took away. */
  fifty: number[] | null;
  timeUp: boolean;
};

export const startCase = (r: Rand): CaseRun => ({ order: shuffle([0, 1, 2, 3], r), done: false, pick: null, fifty: null, timeUp: false });

/** Locks a choice (an option index, 0..3). */
export function lock(run: CaseRun, pick: number): CaseRun {
  if (run.done || pick < 0 || pick > 3 || run.fifty?.includes(pick)) return run;
  return { ...run, pick, done: true };
}

/** Time up: no answer counts as wrong. */
export const timeUp = (run: CaseRun): CaseRun => (run.done ? run : { ...run, pick: -1, done: true, timeUp: true });

/** 50/50: takes away 2 wrong choices, once a case. */
export function takeFifty(run: CaseRun, r: Rand): CaseRun {
  if (run.done || run.fifty) return run;
  return { ...run, fifty: shuffle([1, 2, 3], r).slice(0, 2).sort() };
}

/** The choices still shown (50/50 takes 2 away). */
export const shownOf = (run: CaseRun) => run.order.filter((i) => !run.fifty?.includes(i));

export const isRight = (run: CaseRun) => run.done && run.pick === 0;

/** A case's points: its level's points when right, else 0. */
export const casePoints = (lv: Level, run: CaseRun) => (isRight(run) ? TTT.points[lv] : 0);
/** A game's score: the cases' points added up. */
export const gameScore = (points: number[]) => points.reduce((a, p) => a + p, 0);

/** Ranking for ties (Yazan, like Spot the Flaw): more points, then faster; equal on both shares the place. */
export function rankRows<T extends { points: number; ms: number }>(rows: T[]): (T & { rank: number })[] {
  const cmp = (a: T, b: T) => b.points - a.points || a.ms - b.ms;
  const sorted = [...rows].sort(cmp);
  const out: (T & { rank: number })[] = [];
  sorted.forEach((r, i) => out.push({ ...r, rank: i > 0 && cmp(sorted[i - 1], r) === 0 ? out[i - 1].rank : i + 1 }));
  return out;
}

/** The letter shown beside a choice. */
export const letterOf = (run: CaseRun, opt: number) => 'ABCD'[run.order.indexOf(opt)] ?? '';
