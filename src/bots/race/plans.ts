import { solveClue, type Mind } from '../brain';
import { between, rng } from '../rng';
import type { BotType } from '../types';
import type { Plan } from './engine';

/** How quickly each type answers once it has the clue it needs (ms into that clue's 10 s). */
const CLUE_SPEED: Record<BotType, [number, number]> = { genius: [1200, 5000], scholar: [2000, 7500], freshman: [3000, 9200] };

/**
 * Clue games (The Diagnostic Pursuit vs rivals, G4): a clue every `clueMs`, unlimited guesses with a lock after a
 * wrong one. The brain says which clue a rival solves on and where it guesses wrong first; this turns that into
 * moments on the clock, keeping each wrong guess's lock (Yazan 2026-11-09: visible wrong guesses with the 5 s lock).
 */
export function cluePlan(mind: Mind, a: { seed: string; gap: number; progress: number; limitMs: number; clueMs: number; lockMs: number; clues: number }): Plan {
  const { at, wrong } = solveClue(mind, { seed: a.seed, gap: a.gap, progress: a.progress }, a.clues);
  const r = rng(`${a.seed}:${mind.bot.id}:times`);
  const wrongAt: number[] = [];
  let free = 0;
  for (const c of wrong) {
    const start = (c - 1) * a.clueMs;
    const ms = Math.round(Math.max(free, start + between(r, 1500, a.clueMs - 1500)));
    if (ms >= a.limitMs - 500) break;
    wrongAt.push(ms);
    free = ms + a.lockMs + 300;
  }
  if (at == null) return { doneAt: null, solved: false, wrongAt };
  const [lo, hi] = CLUE_SPEED[mind.bot.type];
  const doneAt = Math.round(Math.max(free, (at - 1) * a.clueMs + between(r, lo, hi)));
  return doneAt < a.limitMs ? { doneAt, solved: true, wrongAt } : { doneAt: null, solved: false, wrongAt };
}

/**
 * Timed-moment games (The Riddler vs rivals): each type solves at a random moment inside its own range
 * (Yazan 2026-11-09: a range per type, never a set second), or not at all. Shares of the time the picture gives.
 */
const SOLVE_RANGE: Record<BotType, [number, number]> = { genius: [0.08, 0.35], scholar: [0.2, 0.6], freshman: [0.4, 0.92] };
export function rangePlan(mind: Mind, a: { seed: string; limitMs: number; right: boolean; pace?: number }): Plan {
  if (!a.right) return { doneAt: null, solved: false, wrongAt: [] };
  const r = rng(`${a.seed}:${mind.bot.id}:range`);
  const [lo, hi] = SOLVE_RANGE[mind.bot.type];
  const share = Math.min(0.97, between(r, lo, hi) * (a.pace ?? 1));
  return { doneAt: Math.round(share * a.limitMs), solved: true, wrongAt: [] };
}
