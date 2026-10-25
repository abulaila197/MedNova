// What a play costs in Sparks (Yazan's table, 2026-10-25): about 2.5 Sparks a minute, so a full bar is 4-5 online
// games. Difficulty and question type never change the cost; in Pass the phone only the phone owner pays.
import type { GameKey, Mode } from '@/games/engine/types';

type Settings = Record<string, unknown>;
type Price = (s: Settings) => number;

/** Cost by one setup choice; `none` when the choice is missing (an older play or a game without that setup). */
const by = (key: string, table: Record<string, number>, none: number): Price => (s) => table[String(s[key])] ?? none;
const flat = (n: number): Price => () => n;

const CASES = by('cases', { 3: 10, 5: 15, 10: 25 }, 15);
const WORDS = by('words', { 3: 15, 5: 20, 10: 40 }, 20);
const PHOTOS = by('photos', { 3: 10, 5: 15, 10: 25 }, 15);
const DRAWS = by('performs', { 1: 10, 2: 20, 3: 30 }, 10);
const TARGET = by('target', { 25: 20, 50: 30, 100: 40 }, 30);
const PARADE = by('questions', { 5: 10, 10: 15, 15: 20 }, 15);
const ROUNDS = by('rounds', { 1: 10, 2: 15, 3: 25, 4: 30, 5: 40 }, 15);
const STREAK_TIME = by('length', { 60: 5, 90: 10, 120: 15 }, 5);
// Password: 5 or 10 words a team, 1 or 2 rounds (Yazan: 10 / 20 / 30 / 40).
const PASSWORD_TABLE: Record<string, number> = { '5:1': 10, '10:1': 20, '5:2': 30, '10:2': 40 };
const PASSWORD: Price = (s) => PASSWORD_TABLE[`${s.words}:${s.rounds}`] ?? 20;

const COSTS: Partial<Record<GameKey, Partial<Record<Mode, Price>>>> = {
  'the-diagnostic-pursuit': { solo: CASES, offline: CASES, online: CASES },
  // Daily is free (TR3); Endless costs 5 a word, charged word by word.
  'nova-medicordle': { solo: (s) => (s.word === 'endless' ? 5 : 0), offline: WORDS, online: WORDS },
  'the-streak-master': { solo: STREAK_TIME, offline: STREAK_TIME, online: by('questions', { 5: 5, 10: 10, 15: 15, 20: 20 }, 10) },
  // Riddler Solo: 5 a level (#64), charged level by level.
  'the-riddler': { solo: flat(5), offline: PHOTOS, online: PHOTOS },
  'the-silent-artist': { solo: flat(5), offline: DRAWS, online: DRAWS },
  // Case Files and Crossword online: 1, 2 or 3 cases (puzzles) in a row, each with its own time limit.
  'case-files-unsolved': { solo: flat(5), offline: flat(5), online: by('count', { 1: 5, 2: 10, 3: 15 }, 5) },
  'nova-crossword': { solo: flat(20), offline: flat(10), online: by('count', { 1: 10, 2: 20, 3: 30 }, 10) },
  'the-wheels-of-chaos': { solo: TARGET, offline: TARGET, online: TARGET },
  'the-conqueror': { online: flat(30) },
  'the-quiz-parade': { solo: PARADE, offline: PARADE, online: PARADE },
  imposter: { offline: ROUNDS, online: ROUNDS },
  'code-clinic': { offline: flat(20), online: flat(20) },
  'nova-password': { offline: PASSWORD, online: PASSWORD },
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
