// The Quiz Parade vs rivals (G5): how a rival answers each question type, and how a question is scored for the table.
import { decide, type Mind } from '../../bots/brain';
import type { Plan } from '../../bots/race/engine';
import { pickOf, rng } from '../../bots/rng';
import type { BotType } from '../../bots/types';
import { grade, nearestSeats, POINTS, type Question, type Response } from './core';

/** How far off a wrong Closest number lands, as a share of the answer, by type (a right one lands inside). */
const CLOSE_RIGHT: Record<BotType, number> = { genius: 0.04, scholar: 0.08, freshman: 0.1 };
const CLOSE_WRONG: Record<BotType, [number, number]> = { genius: [0.12, 0.3], scholar: [0.15, 0.5], freshman: [0.25, 0.9] };

const shuffled = <T,>(r: () => number, xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const round = (v: number, answer: number) => (Number.isInteger(answer) && Math.abs(answer) >= 10 ? Math.round(v) : Math.round(v * 10) / 10);

/** A rival's answer: the right one, or a near miss (never a random one): one swap, one wrong item, the other value. */
export function responseFor(q: Question, right: boolean, seed: string, type: BotType, wrongPick: number): Response {
  const r = rng(`${seed}:resp`);
  switch (q.style) {
    case 'mcq':
    case 'reverse': {
      if (right) return { style: q.style, pick: q.answer };
      const wrongs = shuffled(r, q.choices.map((_, i) => i).filter((i) => i !== q.answer));
      return { style: q.style, pick: wrongs[Math.min(wrongPick, wrongs.length - 1)] ?? q.answer };
    }
    case 'tf':
      return { style: 'tf', value: right ? q.answer : !q.answer };
    case 'r2o': {
      if (right) return { style: 'r2o', picks: [...q.out] };
      const keep = pickOf(r, q.out);
      const other = pickOf(r, q.items.map((_, i) => i).filter((i) => !q.out.includes(i)));
      return { style: 'r2o', picks: [keep, other] };
    }
    case 'match': {
      const map = q.pairs.map((_, i) => i);
      if (!right && map.length >= 2) {
        // One or two pairs crossed (part right, as a real player would be).
        const swaps = wrongPick === 0 || map.length < 4 ? 1 : 2;
        const idx = shuffled(r, map).slice(0, swaps * 2);
        for (let k = 0; k + 1 < idx.length; k += 2) [map[idx[k]], map[idx[k + 1]]] = [map[idx[k + 1]], map[idx[k]]];
      }
      return { style: 'match', map };
    }
    case 'order': {
      const seq = q.items.map((_, i) => i);
      if (!right && seq.length >= 2) {
        const k = Math.floor(r() * (seq.length - 1));
        [seq[k], seq[k + 1]] = [seq[k + 1], seq[k]];
        if (wrongPick > 0 && seq.length >= 4) {
          const m = (k + 2) % (seq.length - 1);
          [seq[m], seq[m + 1]] = [seq[m + 1], seq[m]];
        }
      }
      return { style: 'order', seq };
    }
    case 'closest': {
      const sign = r() < 0.5 ? -1 : 1;
      const share = right ? r() * CLOSE_RIGHT[type] : CLOSE_WRONG[type][0] + r() * (CLOSE_WRONG[type][1] - CLOSE_WRONG[type][0]);
      const base = Math.abs(q.answer) || 1;
      return { style: 'closest', value: round(q.answer + sign * share * base, q.answer) };
    }
  }
}

/** One rival's plan for a question: when it answers and what it says. */
export function paradePlan(mind: Mind, q: Question, a: { seed: string; limitMs: number; gap: number; progress: number }): Plan {
  const mv = decide(mind, { seed: a.seed, limitMs: a.limitMs, gap: a.gap, progress: a.progress });
  if (mv.ms == null) return { doneAt: null, solved: false, wrongAt: [], answer: null, pick: null };
  const resp = responseFor(q, mv.right, `${a.seed}:${mind.bot.id}`, mind.bot.type, mv.wrongPick);
  const g = grade(q, resp);
  // The faces sit on a tile for Multiple choice, Reverse and True or false.
  const pick = resp.style === 'mcq' || resp.style === 'reverse' ? resp.pick : resp.style === 'tf' ? (resp.value ? 1 : 0) : null;
  return { doneAt: mv.ms, solved: g.right || q.style === 'closest', wrongAt: [], answer: JSON.stringify(resp), pick };
}

export const parseResponse = (s: string | null | undefined): Response | null => {
  if (!s) return null;
  try {
    return JSON.parse(s) as Response;
  } catch {
    return null;
  }
};

/**
 * The table's points for one question: Solo's points per answer (part points for Match and Order), Closest number to
 * the nearest guess (every tie), and +1 to the first fully right answer. Returns points by player, and who was first.
 */
export function scoreParade(q: Question, rows: { id: string; doneAt: number | null; answer: string | null }[]): { points: Record<string, number>; first: string | null; nearest: string[] } {
  const points: Record<string, number> = {};
  const resp = new Map(rows.map((x) => [x.id, parseResponse(x.answer)]));
  let nearest: string[] = [];
  if (q.style === 'closest') {
    const guesses = rows.map((x, i) => ({ seat: i, value: resp.get(x.id)?.style === 'closest' ? (resp.get(x.id) as { value: number }).value : null }));
    nearest = nearestSeats(q.answer, guesses).map((i) => rows[i].id);
    for (const x of rows) points[x.id] = nearest.includes(x.id) ? POINTS.closest : 0;
  } else for (const x of rows) points[x.id] = grade(q, resp.get(x.id) ?? null).points;
  // +1 to the first fully right answer (Closest number: the nearest, earliest).
  const full = rows.filter((x) => x.doneAt != null && (q.style === 'closest' ? nearest.includes(x.id) : grade(q, resp.get(x.id) ?? null).right)).sort((a, b) => a.doneAt! - b.doneAt!);
  const first = full[0]?.id ?? null;
  if (first) points[first] += 1;
  return { points, first, nearest };
}
