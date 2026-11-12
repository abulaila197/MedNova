import { pickOf, rng } from './rng';
import { BOT_NAMES } from './names';

/**
 * Rival of the day (G6, Yazan 2026-11-10): one Genius boss a day, the same for everyone (seeded by the date), in one
 * game. Pure: the app wraps it with the real Bot (daily.ts).
 */

/** The games a boss can show up in: every game with a Vs rivals mode. */
export const BOSS_GAMES = ['the-diagnostic-pursuit', 'nova-crossword', 'the-riddler', 'nova-medicordle', 'the-streak-master', 'case-files-unsolved', 'the-wheels-of-chaos'] as const;
export type BossGame = (typeof BOSS_GAMES)[number];

export type BossPick = { day: string; name: string; game: BossGame };

/** YYYY-MM-DD by the phone's clock (the same as the engine's localDay). */
export function dayKey(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** The boss name and game for a day. Two days in a row never share a game. */
export function bossOf(day = dayKey()): BossPick {
  return { day, name: pickOf(rng(`boss:${day}`), BOT_NAMES.genius), game: gameOf(day) };
}
/** The day's game by its own seed; if it repeats yesterday's, the next game in the list. */
function gameOf(day: string, depth = 0): BossGame {
  const i = Math.floor(rng(`boss:${day}:g`)() * BOSS_GAMES.length);
  const g = BOSS_GAMES[i];
  return depth === 0 && g === gameOf(yesterday(day), 1) ? BOSS_GAMES[(i + 1) % BOSS_GAMES.length] : g;
}
function yesterday(day: string) {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}
