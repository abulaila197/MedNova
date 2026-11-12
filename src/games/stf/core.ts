// Spot the Flaw (Yazan's cards 2026-11-12): read a hospital story with one real mistake hidden among details that only
// look suspicious. Stage 1 asks what went wrong (4 choices). Once locked, it is replaced by stage 2, what should have
// happened (4 choices: the real fix, and the matching "fix" for each of the 3 wrong stage-1 choices). Stage 2 comes
// even after a wrong stage 1. One try a stage; the answers show only after stage 2.
// Points: +3 a right stage, -3 when both are wrong, +2 more for a hard case with both right (0 to 8 a case). A game
// never ends below 0. EXP = points, at most 6 a case (the hard bonus is score only) and 60 a day from this game.
// Solo help, paid in tokens, once each a case: 50/50 (2 tokens) and Highlight the part of the story (3 tokens).

export type Level = 1 | 2 | 3;
/** One choice: what went wrong (stage 1), its matching "what should have happened" (stage 2), and why. */
export type Opt = { o: string; x: string; w: string };
/**
 * One case in the bank. `a[0]` is the real flaw and `a[0].x` the real fix; `a[1..3]` are traps the story shows were
 * fine. `p` is the paper's kind (sheet header), `t` the flaw's short name, `s` the story, `h` the words the Highlight
 * help circles (always in `s`).
 */
export type Case = { id: string; f: string; lv: Level; p: string; t: string; s: string; h: string; a: Opt[] };

export const STF = {
  /** Cases a game in setup. */
  cases: [1, 3, 5],
  /** Clock a case in minutes (0 = no clock). */
  clocks: [0, 1, 2, 3],
  right: 3,
  bothWrong: -3,
  hardBonus: 2,
  maxPoints: 8,
  /** EXP caps (Yazan 2026-11-12): a case (no hard bonus), and a day from this game. */
  expCase: 6,
  expDay: 60,
  fiftyCost: 2,
  highlightCost: 3,
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

export type Stage = 1 | 2 | 'done';
/** One player's go at one case. Picks are option indexes in the case (0 is right); -1 = no answer (time up). */
export type CaseRun = {
  /** The shown order of the choices in each stage. */
  order1: number[];
  order2: number[];
  stage: Stage;
  pick1: number | null;
  pick2: number | null;
  /** 50/50: the stage it was used in and the 2 choices it took away. */
  fifty: { stage: 1 | 2; hide: number[] } | null;
  highlight: boolean;
  /** The clock ran out before both stages were locked. */
  timeUp: boolean;
};

export const startCase = (r: Rand): CaseRun => ({ order1: shuffle([0, 1, 2, 3], r), order2: shuffle([0, 1, 2, 3], r), stage: 1, pick1: null, pick2: null, fifty: null, highlight: false, timeUp: false });

/** Locks the open stage's choice (an option index, 0..3). */
export function lock(run: CaseRun, pick: number): CaseRun {
  if (run.stage === 'done' || pick < 0 || pick > 3) return run;
  if (run.fifty?.stage === run.stage && run.fifty.hide.includes(pick)) return run;
  return run.stage === 1 ? { ...run, pick1: pick, stage: 2 } : { ...run, pick2: pick, stage: 'done' };
}

/** Time up: what is not locked counts as wrong. */
export const timeUp = (run: CaseRun): CaseRun => (run.stage === 'done' ? run : { ...run, pick1: run.pick1 ?? -1, pick2: run.pick2 ?? -1, stage: 'done', timeUp: true });

/** 50/50: takes away 2 wrong choices in the open stage, once a case. */
export function takeFifty(run: CaseRun, r: Rand): CaseRun {
  if (run.stage === 'done' || run.fifty) return run;
  return { ...run, fifty: { stage: run.stage, hide: shuffle([1, 2, 3], r).slice(0, 2).sort() } };
}
/** Highlight: circles the part of the story where the flaw is, once a case. */
export const takeHighlight = (run: CaseRun): CaseRun => (run.stage === 'done' || run.highlight ? run : { ...run, highlight: true });

/** The choices still shown in a stage (50/50 takes 2 away). */
export const shownOf = (run: CaseRun, stage: 1 | 2) => (stage === 1 ? run.order1 : run.order2).filter((i) => !(run.fifty?.stage === stage && run.fifty.hide.includes(i)));

export const right1 = (run: CaseRun) => run.pick1 === 0;
export const right2 = (run: CaseRun) => run.pick2 === 0;
export const doubleWrong = (run: CaseRun) => run.stage === 'done' && !right1(run) && !right2(run);

/** A case's points: +3 a right stage, -3 both wrong, +2 more for a hard case with both right. */
export function casePoints(lv: Level, run: CaseRun): number {
  if (run.stage !== 'done') return 0;
  const a = right1(run);
  const b = right2(run);
  if (!a && !b) return STF.bothWrong;
  return (a ? STF.right : 0) + (b ? STF.right : 0) + (a && b && lv === 3 ? STF.hardBonus : 0);
}
/** A case's EXP: its points without the hard bonus, never below 0. */
export const caseExp = (points: number) => Math.max(0, Math.min(STF.expCase, points));
/** A game's score: the cases' points added up, never below 0. */
export const gameScore = (points: number[]) => Math.max(0, points.reduce((a, p) => a + p, 0));

/** Ranking for ties (Yazan): more points, then fewer double-wrongs, then faster; equal on all three shares the place. */
export function rankRows<T extends { points: number; doubles: number; ms: number }>(rows: T[]): (T & { rank: number })[] {
  const cmp = (a: T, b: T) => b.points - a.points || a.doubles - b.doubles || a.ms - b.ms;
  const sorted = [...rows].sort(cmp);
  const out: (T & { rank: number })[] = [];
  sorted.forEach((r, i) => out.push({ ...r, rank: i > 0 && cmp(sorted[i - 1], r) === 0 ? out[i - 1].rank : i + 1 }));
  return out;
}

/** The letter shown beside a choice in its stage. */
export const letterOf = (run: CaseRun, stage: 1 | 2, opt: number) => 'ABCD'[(stage === 1 ? run.order1 : run.order2).indexOf(opt)] ?? '';
