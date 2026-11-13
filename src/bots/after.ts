import type { Play, Seat } from '@/games/engine/types';
import { presetTeam } from '@/games/shell/teams';
import { SEAT_COLOURS } from '@/games/shell/characters';

import { addBot } from './core';
import { rng } from './rng';
import type { Bot, BotLevel } from './types';
import { tr } from '@/i18n';

export type After = {
  /** Rivals who finished above you (they brag). */
  above: Bot[];
  /** Rivals who finished below you and stay: they ask for a rematch. */
  want: Bot[];
  /** Rivals who leave after this match (0 to 2, never a favourite). */
  leave: Bot[];
};

/**
 * After a Vs rivals match (G4, Yazan 2026-11-09): losing rivals ask for a rematch, winners brag, and sometimes 1 or
 * 2 leave and new ones take their seats. Fixed per match, so reopening the results tells the same story.
 */
export function afterMatch(play: Play, favs: string[]): After {
  const rank = new Map(play.standings.map((x) => [x.seat, x.rank]));
  const mine = rank.get(0) ?? 1;
  const rivals = play.seats.filter((x) => x.bot && !x.removed);
  const r = rng(`after:${play.id}`);
  const x = r();
  const count = Math.min(rivals.length, x < 0.45 ? 0 : x < 0.85 ? 1 : 2);
  const free = rivals.filter((s) => !favs.includes(s.bot!.id)).sort(() => r() - 0.5);
  const leave = free.slice(0, count).map((s) => s.bot!);
  const gone = new Set(leave.map((b) => b.id));
  const above = rivals.filter((s) => (rank.get(s.seat) ?? 99) < mine).map((s) => s.bot!);
  const want = rivals.filter((s) => (rank.get(s.seat) ?? 99) >= mine && !gone.has(s.bot!.id)).map((s) => s.bot!);
  return { above, want, leave };
}

/** The rematch table: the same seats, with new rivals of the same level in the seats of those who left. */
export function rematchSeats(play: Play, leave: Bot[]): Seat[] {
  const level = (play.settings.botLevel as BotLevel) ?? 'medium';
  const teams = Array.isArray(play.settings.teams) ? play.settings.teams.length : 0;
  const gone = new Set(leave.map((b) => b.id));
  const seats = play.seats.filter((x) => !x.removed);
  const taken = [...seats.map((x) => x.name), ...leave.map((b) => b.name)];
  return seats.map((x, i) => {
    if (!x.bot || !gone.has(x.bot.id)) return { ...x, seat: i };
    const b = addBot(level, taken);
    taken.push(b.name);
    const color = teams >= 2 && x.team != null ? presetTeam(x.team).color : (x.color ?? SEAT_COLOURS[i % SEAT_COLOURS.length].color);
    return { ...x, seat: i, name: b.name, character: b.character, bot: b, color };
  });
}

/** "Omar", "Omar and Sara", "Omar, Sara and Lena". */
export const namesOf = (bots: Bot[]) => {
  const n = bots.map((b) => b.name.split(' ')[0]);
  return n.length <= 1 ? (n[0] ?? '') : tr('{a} and {b}', { a: n.slice(0, -1).join(tr(', ')), b: n[n.length - 1] });
};
