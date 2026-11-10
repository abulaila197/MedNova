import { dayKey } from './boss';
import { BOT_NAMES } from './names';
import { between, pickOf, rng } from './rng';
import type { BotType } from './types';

/**
 * Rivals on the leaderboard (G6, Yazan 2026-11-10), the pure part: which passing rivals show this period, what EXP
 * each rival has (fixed per week, month and game by seed), and the merge with the real rows from the server.
 */
export type BoardRow = { rank: number; id: string; name: string; level: number; exp: number; avatar?: string | null };
export type BoardMe = { rank: number; exp: number; above: { name: string; gap: number } | null } | null;
export type BoardLike = { rows: BoardRow[]; me: BoardMe; savedAt?: number };
export type Period = 'week' | 'month' | 'all';

/** EXP a type earns in a week; months and all-time scale it up, a single game's board scales it down. */
const WEEK: Record<BotType, [number, number]> = { genius: [260, 820], scholar: [120, 480], freshman: [30, 220] };
const SCALE: Record<Period, number> = { week: 1, month: 3.3, all: 16 };
const PASSING: BotType[] = ['genius', 'genius', 'scholar', 'scholar', 'scholar', 'freshman'];
const MAX_ROWS = 50;

/** The key a period's points are fixed under: this ISO week, this month, or for ever. */
export function periodKey(period: Period, day = dayKey()): string {
  if (period === 'all') return 'all';
  if (period === 'month') return day.slice(0, 7);
  const d = new Date(`${day}T12:00:00`);
  const thu = new Date(d);
  thu.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); // the Thursday of this week sets the ISO year
  const jan4 = new Date(`${thu.getFullYear()}-01-04T12:00:00`);
  const week1 = new Date(jan4);
  week1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const week = 1 + Math.round((thu.getTime() - week1.getTime()) / (7 * 86_400_000));
  return `${thu.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** A rival's EXP on this board. */
export function rivalExp(id: string, type: BotType, level: number, period: Period, key: string, game: string | null) {
  const r = rng(`lb:${id}:${key}:${game ?? 'all'}`);
  const base = between(r, WEEK[type][0], WEEK[type][1]) * SCALE[period] * (game ? 0.35 : 1);
  return Math.round(base + (period === 'all' ? level * 40 : 0));
}

/** The passing rivals of a period (nobody has met them, they still show up): a fixed handful by its key. */
export function passingNames(key: string, game: string | null): { type: BotType; name: string }[] {
  const r = rng(`lb:passing:${key}:${game ?? 'all'}`);
  const out: { type: BotType; name: string }[] = [];
  for (const type of PASSING) {
    let name = pickOf(r, BOT_NAMES[type]);
    if (out.some((x) => x.name === name)) name = pickOf(r, BOT_NAMES[type]);
    out.push({ type, name });
  }
  return out;
}

export const isRivalRow = (id: string) => id.startsWith('bot:');

/** Real rows plus rival rows, ranked again; your pinned row keeps its place and the name just above you. */
export function mergeBoard(board: BoardLike, rivals: BoardRow[], userId: string | null): BoardLike {
  const rows = [...board.rows.filter((r) => !isRivalRow(r.id)), ...rivals]
    .sort((a, b) => b.exp - a.exp || a.name.localeCompare(b.name))
    .slice(0, MAX_ROWS)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  let me = board.me;
  if (me) {
    const i = rows.findIndex((r) => r.id === userId);
    // Off the shown rows (past 50th): the server's rank plus the rivals who sit above you.
    const rank = i >= 0 ? i + 1 : me.rank + rivals.filter((r) => r.exp > me!.exp).length;
    const above = i > 0 ? rows[i - 1] : i < 0 ? (rows[rows.length - 1] ?? null) : null;
    me = { ...me, rank, above: above ? { name: above.name, gap: Math.max(1, above.exp - me.exp) } : me.above };
  }
  return { ...board, rows, me };
}
