// Case showdown (Case Files vs rivals, G5): how a rival works a case, and what it files at each stage.
import { decide, moodOf, type Mind } from '../../bots/brain';
import type { Plan } from '../../bots/race/engine';
import { between, pickOf, rng, type Rand } from '../../bots/rng';
import type { BotType } from '../../bots/types';
import { CF, scoreDd, timeBonus, type CaseDef } from './core';

/** How long each type takes on a case, as a share of the time limit (a Genius is thorough, not instant). */
const CASE_RANGE: Record<BotType, [number, number]> = { genius: [0.3, 0.55], scholar: [0.45, 0.75], freshman: [0.6, 0.95] };
/** Right names in the first list, by type (of the doctor's list, up to 5 names). */
const RIGHT_FIRST: Record<BotType, [number, number]> = { genius: [3, 5], scholar: [2, 4], freshman: [1, 3] };
/** The chance of a right last call after a wrong diagnosis. */
const REDEEM: Record<BotType, number> = { genius: 0.7, scholar: 0.5, freshman: 0.35 };

/** What a rival files on a case, and when (ms from the case opening). Saved as the plan's answer. */
export type CaseWork = {
  first: string[];
  dd: string[];
  prov: string | null;
  redeem: string | null;
  /** When it reaches each stage: the examination, the investigations, the diagnosis (treatment), the end. */
  at: { exam: number; inv: number; prov: number; done: number };
  /** Its points, counting only what it filed inside the time limit. */
  points: number;
};

export const parseWork = (s: string | null | undefined): CaseWork | null => {
  if (!s) return null;
  try {
    return JSON.parse(s) as CaseWork;
  } catch {
    return null;
  }
};

const take = <T,>(r: Rand, xs: readonly T[], n: number): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
};

/**
 * A rival's whole case: a first list with some of the doctor's names and some look-alikes, a narrowed list, a
 * diagnosis (right as often as its type is), and a last call after a wrong one. It works at its type's pace, slower
 * when tilted, and may run out of time. Pure and seeded.
 */
export function casePlan(mind: Mind, c: CaseDef, a: { seed: string; limitMs: number; gap: number; progress: number; pool: readonly string[] }): Plan {
  const mv = decide(mind, { seed: a.seed, limitMs: a.limitMs, gap: a.gap, progress: a.progress });
  const r = rng(`${a.seed}:${mind.bot.id}:case`);
  const type = mind.bot.type;
  const mood = moodOf(mind);
  // How long the case takes: the type's range, a little quicker on fire, slower when tilted; a timed-out rival never ends it.
  let share = between(r, ...CASE_RANGE[type]) * (mood === 'fire' ? 0.9 : mood === 'tilt' ? 1.15 : 1);
  if (mv.ms == null) share = Math.max(share, 1.05);
  const T = share * a.limitMs;
  const at = { exam: Math.round(T * between(r, 0.22, 0.3)), inv: Math.round(T * between(r, 0.48, 0.58)), prov: Math.round(T * between(r, 0.78, 0.86)), done: Math.round(T) };

  // The first list: some right names (the final one more often than not), filled up with look-alikes.
  const others = c.answers.filter((x) => x !== c.final);
  const [lo, hi] = RIGHT_FIRST[type];
  const nRight = Math.min(c.answers.length, Math.round(between(r, lo, hi + 0.99)));
  const hasFinal = r() < (type === 'genius' ? 0.85 : type === 'scholar' ? 0.65 : 0.45);
  const rights = [...(hasFinal ? [c.final] : []), ...take(r, others, hasFinal ? nRight - 1 : nRight)].slice(0, nRight);
  const size = Math.min(CF.ddMax, Math.max(rights.length, Math.round(between(r, 3, 5.99))));
  const wrongPool = a.pool.filter((x) => !c.answers.includes(x));
  const first = take(r, [...rights, ...take(r, wrongPool, Math.max(0, size - rights.length))], size);
  // The narrowed list: drops a wrong name or two, keeps the right ones (a Freshman sometimes drops a right one).
  const keepWrong = first.filter((x) => !c.answers.includes(x)).filter(() => r() < (type === 'genius' ? 0.3 : 0.55));
  const keepRight = first.filter((x) => c.answers.includes(x)).filter(() => type !== 'freshman' || r() < 0.85);
  const dd = [...keepRight, ...keepWrong].length ? [...keepRight, ...keepWrong] : [first[0]];
  // The diagnosis: right as the brain says; a wrong one is a near miss (another name from the doctor's list, or its own list).
  const near = [...others, ...first.filter((x) => x !== c.final)];
  const prov = mv.right ? c.final : (near[Math.min(mv.wrongPick, near.length - 1)] ?? pickOf(r, wrongPool) ?? null);
  const redeem = prov === c.final ? null : r() < REDEEM[type] ? c.final : (pickOf(r, near.filter((x) => x !== prov)) ?? null);
  const solved = prov === c.final || redeem === c.final;

  // Points, as Solo scores a case, counting only what was filed inside the limit.
  const L = a.limitMs;
  const ddPts = at.inv <= L ? scoreDd(c.answers, first, dd).points : at.exam <= L ? scoreDd(c.answers, first).points : 0;
  const provPts = at.prov <= L && prov === c.final ? CF.points.provisional : 0;
  const redeemPts = at.done <= L && prov !== c.final && redeem === c.final ? CF.points.redemption : 0;
  const inTime = at.done <= L;
  const time = inTime && solved ? timeBonus(prov === c.final ? at.prov : at.done) : 0;
  const work: CaseWork = { first, dd, prov: at.prov <= L ? prov : null, redeem: at.done <= L ? redeem : null, at, points: ddPts + provPts + redeemPts + time };
  return { doneAt: inTime ? at.done : null, solved: inTime && solved, wrongAt: [], answer: JSON.stringify(work), points: work.points };
}

/** The stage a rival has reached `el` ms into the case. */
export function stageAt(w: CaseWork | null, el: number, done: boolean): 'History' | 'Examination' | 'Investigations' | 'Treatment' | 'Finished' {
  if (!w) return 'History';
  if (done) return 'Finished';
  if (el >= w.at.prov) return 'Treatment';
  if (el >= w.at.inv) return 'Investigations';
  if (el >= w.at.exam) return 'Examination';
  return 'History';
}
