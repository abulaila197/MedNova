// What a play costs in Sparks (Yazan's table, 2026-10-25; every price x1.5 rounded up to 5, Yazan 2026-11-06): about
// 3.75 Sparks a minute, so a full bar is about 3 online games. Difficulty and question type never change the cost; in Pass the phone only the phone owner pays.
import type { GameKey, Mode } from '@/games/engine/types';

type Settings = Record<string, unknown>;
type Price = (s: Settings) => number;

/** Cost by one setup choice; `none` when the choice is missing (an older play or a game without that setup). */
const by = (key: string, table: Record<string, number>, none: number): Price => (s) => table[String(s[key])] ?? none;
const flat = (n: number): Price => () => n;

const CASES = by('cases', { 3: 15, 5: 25, 10: 40 }, 25);
const WORDS = by('words', { 3: 25, 5: 30, 10: 60 }, 30);
const PHOTOS = by('photos', { 3: 15, 5: 25, 10: 40 }, 25);
const DRAWS = by('performs', { 1: 15, 2: 30, 3: 45 }, 15);
const TARGET = by('target', { 25: 30, 50: 45, 100: 60 }, 45);
const PARADE = by('questions', { 5: 15, 10: 25, 15: 30 }, 25);
const BOARDS = by('boards', { 1: 15, 3: 25, 5: 40 }, 25);
const ROUNDS = by('rounds', { 1: 15, 2: 25, 3: 40, 4: 45, 5: 60 }, 25);
const STREAK_TIME = by('length', { 60: 10, 90: 15, 120: 25 }, 10);
// Password: 5 or 10 words a team, 1 or 2 rounds (Yazan: 15 / 30 / 45 / 60).
const PASSWORD_TABLE: Record<string, number> = { '5:1': 15, '10:1': 30, '5:2': 45, '10:2': 60 };
const PASSWORD: Price = (s) => PASSWORD_TABLE[`${s.words}:${s.rounds}`] ?? 30;

const COSTS: Partial<Record<GameKey, Partial<Record<Mode, Price>>>> = {
  'the-diagnostic-pursuit': { solo: CASES, offline: CASES, bots: CASES },
  // Daily is free (TR3); Endless costs 10 a word, charged word by word.
  'nova-medicordle': { solo: (s) => (s.word === 'endless' ? 10 : 0), offline: WORDS, bots: WORDS },
  'the-streak-master': { solo: STREAK_TIME, offline: STREAK_TIME, bots: by('questions', { 5: 10, 10: 15, 15: 25, 20: 30 }, 15) },
  // Riddler Solo: 10 a level (#64), charged level by level.
  'the-riddler': { solo: flat(10), offline: PHOTOS, bots: PHOTOS },
  'the-silent-artist': { solo: flat(10), offline: DRAWS },
  // Case Files and Crossword vs bots: 1, 2 or 3 cases (puzzles) in a row, each with its own time limit.
  'case-files-unsolved': { solo: flat(10), offline: flat(10), bots: by('count', { 1: 10, 2: 15, 3: 25 }, 10) },
  // Vs rivals: one puzzle costs the same as Solo (Yazan 2026-11-10).
  'nova-crossword': { solo: flat(30), offline: flat(15), bots: by('count', { 1: 30, 2: 45, 3: 60 }, 30) },
  'the-wheels-of-chaos': { solo: TARGET, offline: TARGET, bots: TARGET },
  'the-conqueror': {},
  'the-quiz-parade': { solo: PARADE, offline: PARADE, bots: PARADE },
  imposter: { offline: ROUNDS },
  // Same as the other Pass the phone game by rounds (Yazan 2026-11-12).
  'tilt-and-tell': { offline: ROUNDS },
  // By boards, like the other games by rounds (1, 3 or 5).
  'four-of-a-kind': { solo: BOARDS, offline: BOARDS, bots: BOARDS },
  'code-clinic': { offline: flat(30) },
  'nova-password': { offline: PASSWORD },
};

/** Games paid level by level or word by word (#64, #69): Riddler Solo and Medicordle Endless. */
export const perUnit = (game: GameKey, mode: Mode, settings: Settings) =>
  mode === 'solo' && (game === 'the-riddler' || (game === 'nova-medicordle' && settings.word === 'endless'));

/** Sparks one play (or one level / word, for the games charged that way) costs with these settings. */
export function sparksCost(game: GameKey, mode: Mode, settings: Settings) {
  if (settings.custom) return 0; // your own custom case is practice
  return COSTS[game]?.[mode]?.(settings) ?? 0;
}

/** Cheapest and dearest play of a mode over every mix of its setup choices (for the mode cards). */
export function costRange(game: GameKey, mode: Mode, opts: { key: string; choices: { value: string | number }[] }[]) {
  let mixes: Settings[] = [{}];
  for (const o of opts) mixes = mixes.flatMap((m) => o.choices.map((c) => ({ ...m, [o.key]: c.value })));
  const all = mixes.map((m) => sparksCost(game, mode, m));
  return { min: Math.min(...all), max: Math.max(...all) };
}

/**
 * Prices for a setup page: the play's cost with the chosen settings, and for each option whose choices change the
 * cost, every choice's cost (with the other choices as they are).
 */
export function setupPrices(game: GameKey, mode: Mode, vals: Settings, opts: { key: string; choices: { value: string | number }[] }[]) {
  const cost = sparksCost(game, mode, vals);
  const per: Record<string, (v: string | number) => number> = {};
  for (const o of opts) {
    const each = o.choices.map((c) => sparksCost(game, mode, { ...vals, [o.key]: c.value }));
    if (new Set(each).size > 1) per[o.key] = (v) => sparksCost(game, mode, { ...vals, [o.key]: v });
  }
  return { cost, per };
}
