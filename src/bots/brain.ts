import { personaOf } from './identity';
import { pickOf, rng, type Rand } from './rng';
import type { Bot, BotType, Persona } from './types';

/**
 * The rivals' brain (G2, Yazan 2026-11-09). Pure and seeded: the same match, question and rival always give the
 * same choice, so a resumed match plays out the same way. Each game asks it one thing at a time ("does this rival
 * get it, and when?") and draws the answer its own way.
 *
 * What shapes a choice:
 *  - type: how good it is (Freshman 35%, Scholar 65%, Genius 90% to start), growing slowly with your level, capped;
 *  - hidden personality: how it plays (Show-off fast and risky, Shy careful, Sleepy slow to start, Cool head never tilts...);
 *  - form: 3 right in a row and it is on fire, 3 misses and it tilts (Hothead after 2; Cool head never tilts);
 *  - the score: a rival far ahead of you eases off a little, one far behind tries harder (hidden, keeps matches close).
 */

const BASE: Record<BotType, number> = { freshman: 0.35, scholar: 0.65, genius: 0.9 };
/** The most each type ever reaches from your level: the Genius tops out at 92%, so it stays beatable. */
const CAP: Record<BotType, number> = { freshman: 0.5, scholar: 0.78, genius: 0.92 };
/** Growth per level of yours. */
const GROW = 0.003;

/** How long each type takes, as a share of the time the question gives. */
const SPEED: Record<BotType, [number, number]> = { freshman: [0.45, 0.9], scholar: [0.3, 0.65], genius: [0.12, 0.4] };
/** How often each type runs out of time on a question. */
const TIMEOUT: Record<BotType, number> = { freshman: 0.08, scholar: 0.03, genius: 0.01 };

export type Mind = {
  bot: Pick<Bot, 'id' | 'type' | 'name'> & { persona?: Persona };
  /** Your level: rivals grow slowly with it. */
  playerLevel: number;
  /** Form: +n for n right in a row, -n for n misses in a row. */
  run: number;
};
export type Mood = 'fire' | 'tilt' | null;

export type Ask = {
  /** Unique per match and question, e.g. `${play.id}:${index}`. */
  seed: string;
  /** The time the question gives (ms). */
  limitMs: number;
  /** How hard the question is, 0 to 1 (default 0.5). */
  hard?: number;
  /** This rival's score minus yours, as a share of what the match is worth (-1 to 1). */
  gap?: number;
  /** How far through the match, 0 to 1. */
  progress?: number;
};

export type Move = {
  right: boolean;
  /** When it answers (ms from the question showing), or null when it runs out of time. */
  ms: number | null;
  /** For a wrong answer, which wrong option: 0 is the most tempting one (near misses, never random). */
  wrongPick: number;
};

export const mindFor = (bot: Mind['bot'], playerLevel = 1): Mind => ({ bot, playerLevel, run: 0 });
const persona = (m: Mind): Persona => m.bot.persona ?? personaOf(m.bot.name);

export function moodOf(m: Mind): Mood {
  const p = persona(m);
  const fireAt = p === 'hot' ? 2 : 3;
  const tiltAt = p === 'hot' ? 2 : 3;
  if (m.run >= fireAt) return 'fire';
  if (m.run <= -tiltAt && p !== 'cool') return 'tilt';
  return null;
}

/** The type's skill at your level, before anything in the match. */
export const skillOf = (type: BotType, playerLevel: number) => Math.min(CAP[type], BASE[type] + Math.max(0, playerLevel - 1) * GROW);

/** The chance this rival gets this question right. */
export function chanceOf(m: Mind, a: Ask): number {
  const p = persona(m);
  const mood = moodOf(m);
  const prog = a.progress ?? 0.5;
  let c = skillOf(m.bot.type, m.playerLevel);
  c += (0.5 - (a.hard ?? 0.5)) * 0.25;
  // Close matches: far ahead eases off, far behind tries harder (never shown).
  const gap = a.gap ?? 0;
  if (gap > 0.15) c -= Math.min(0.15, (gap - 0.15) * 0.4);
  if (gap < -0.15) c += Math.min(0.1, (-gap - 0.15) * 0.3);
  if (mood === 'fire') c += p === 'hot' ? 0.1 : 0.06;
  if (mood === 'tilt') c -= p === 'hot' ? 0.15 : 0.1;
  if (p === 'showoff') c -= 0.03;
  if (p === 'shy') c += 0.02;
  if (p === 'sleepy') c += prog < 0.35 ? -0.08 : 0.02;
  // Even a Genius on fire can be beaten.
  return Math.max(0.05, Math.min(0.95, c));
}

/** How long it takes, as a share of the time limit (before running out of time is decided). */
function paceOf(m: Mind, a: Ask, r: Rand): number {
  const p = persona(m);
  const mood = moodOf(m);
  const [lo, hi] = SPEED[m.bot.type];
  let f = lo + r() * (hi - lo);
  if (p === 'showoff') f *= 0.8;
  if (p === 'shy') f *= 1.15;
  if (p === 'sleepy' && (a.progress ?? 0.5) < 0.35) f *= 1.3;
  if (mood === 'fire') f *= p === 'hot' ? 0.8 : 0.9;
  if (mood === 'tilt') f *= p === 'hot' ? 0.85 : 1.1; // a tilted Hothead rushes, others slow down
  if (r() < 0.15) f *= 1.25; // a moment's hesitation now and then
  return f;
}

/** One question: right or wrong, when, and which wrong answer. */
export function decide(m: Mind, a: Ask): Move {
  const r = rng(`${a.seed}:${m.bot.id}`);
  const right = r() < chanceOf(m, a);
  const f = paceOf(m, a, r);
  const late = TIMEOUT[m.bot.type] + (persona(m) === 'sleepy' && (a.progress ?? 0.5) < 0.35 ? 0.06 : 0);
  const out = r() < late || f >= 0.97;
  const w = r();
  return { right: right && !out, ms: out ? null : Math.round(f * a.limitMs), wrongPick: w < 0.6 ? 0 : w < 0.85 ? 1 : 2 };
}

/** Form after an answer: streaks of right answers and misses. */
export const afterAnswer = (m: Mind, right: boolean): Mind => ({ ...m, run: right ? Math.max(1, m.run + 1) : Math.min(-1, m.run - 1) });

/**
 * Clue games (The Diagnostic Pursuit): the clue it solves on (1-based), or null if it never does, plus the clues
 * where it makes a wrong guess first. A Genius rarely solves on clue 1 or 2 (Yazan 2026-11-09): usually 3,
 * a Scholar 3 to 4, a Freshman 5 to 6 or never.
 */
export function solveClue(m: Mind, a: Pick<Ask, 'seed' | 'gap' | 'progress'>, clues = 6): { at: number | null; wrong: number[] } {
  const r = rng(`${a.seed}:${m.bot.id}:clue`);
  const p = persona(m);
  const mood = moodOf(m);
  const table: Record<BotType, [number | null, number][]> = {
    genius: [[1, 0.03], [2, 0.07], [3, 0.6], [4, 0.25], [5, 0.05]],
    scholar: [[3, 0.25], [4, 0.45], [5, 0.2], [6, 0.1]],
    freshman: [[5, 0.4], [6, 0.35], [null, 0.25]],
  };
  let x = r();
  let at: number | null = null;
  for (const [c, w] of table[m.bot.type]) {
    if ((x -= w) <= 0) {
      at = c;
      break;
    }
  }
  // Form and the score move it a clue earlier or later.
  let shift = 0;
  if (mood === 'fire') shift -= 1;
  if (mood === 'tilt') shift += 1;
  if ((a.gap ?? 0) > 0.25) shift += 1;
  if ((a.gap ?? 0) < -0.25 && r() < 0.5) shift -= 1;
  if (p === 'sleepy' && (a.progress ?? 0.5) < 0.35) shift += 1;
  if (at != null && shift) {
    // Moving earlier never goes below the type's usual first clue (a rare early solve stays as it was).
    const floor = Math.min(at, { genius: 3, scholar: 3, freshman: 4 }[m.bot.type]);
    const moved = Math.max(floor, at + shift);
    at = moved > clues ? (m.bot.type === 'freshman' ? null : clues) : moved;
  }
  const last = at ?? clues;
  const tryRate = { freshman: 0.35, scholar: 0.2, genius: 0.12 }[m.bot.type] * (p === 'showoff' ? 1.6 : p === 'shy' ? 0.5 : p === 'hot' ? 1.3 : 1);
  const wrong: number[] = [];
  for (let c = 1; c < last + (at == null ? 1 : 0); c++) if (r() < tryRate) wrong.push(c);
  return { at, wrong };
}

/** A near-miss wrong answer from the options a game offers, most tempting first. */
export const nearMiss = <T,>(wrongs: readonly T[], move: Move): T | undefined => wrongs[Math.min(move.wrongPick, wrongs.length - 1)];

/** For games that need a random-looking but fixed pick (which word, which square). */
export const fixedPick = <T,>(seed: string, xs: readonly T[]) => pickOf(rng(seed), xs);
