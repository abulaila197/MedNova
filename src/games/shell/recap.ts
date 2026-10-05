// OF1: offline (one-phone) multiplayer has no live alerts. The pass-the-phone curtain instead shows what
// happened since that player's last turn, using the same events each game's online alerts use.
// No answers are ever shown. With teams on, lead changes name the team.
import type { Play } from '../engine/types';
import { teamsOf } from './teams';

/** `seat` and `note` (the line without the name) let the scoreboard show the event under that player. */
export type RecapLine = { key: string; text: string; color?: string; lead?: boolean; seat?: number; note?: string };

/** One player's event: "Sara solved the case · +85". */
export function event(key: string, seat: number, who: { name?: string; color?: string } | undefined, note: string): RecapLine {
  const name = who?.name ?? `Player ${seat + 1}`;
  return { key, seat, note, text: `${name} ${note}`, color: who?.color };
}

export const RECAP_MAX = 5;

type Score = { seat: number; score: number };
type Side = { id: string; name: string; color?: string; score: number };

/** Players, or teams when the host turned teams on: average score (TM3) or added up (games where the team wins the item). */
export function sides(scores: Score[], play: Pick<Play, 'seats' | 'settings'>, how: 'average' | 'sum' = 'average'): Side[] {
  const teams = teamsOf(play);
  const seatOf = new Map(play.seats.map((x) => [x.seat, x]));
  if (!teams) return scores.map((r) => ({ id: `s${r.seat}`, name: seatOf.get(r.seat)?.name ?? `Player ${r.seat + 1}`, color: seatOf.get(r.seat)?.color, score: r.score }));
  return teams
    .map((t) => {
      const mine = scores.filter((r) => seatOf.get(r.seat)?.team === t.id);
      const total = mine.reduce((a, r) => a + r.score, 0);
      return { id: `t${t.id}`, name: t.name, color: t.color, score: how === 'sum' || !mine.length ? total : total / mine.length, n: mine.length };
    })
    .filter((t) => t.n > 0)
    .map(({ n: _n, ...t }) => t);
}

/** The single leader, or null when nobody has scored or the top is shared. */
export function leaderOf(rows: Side[]): Side | null {
  const top = [...rows].sort((a, b) => b.score - a.score);
  if (!top.length || top[0].score <= 0 || (top[1] && top[1].score === top[0].score)) return null;
  return top[0];
}

/** "Sara takes the lead" when the leader changed between the player's last turn and now. */
export function leadLine(before: Side[], after: Side[]): RecapLine | null {
  const a = leaderOf(before);
  const b = leaderOf(after);
  if (!b || a?.id === b.id) return null;
  const seat = b.id.startsWith('s') ? Number(b.id.slice(1)) : undefined;
  const note = b.name === 'You' ? 'take the lead' : 'takes the lead';
  return { key: `lead-${b.id}`, text: `${b.name} ${note}`, color: b.color, lead: true, seat, note };
}

/** Newest events last; keeps the latest few, then the lead change. */
export function finishRecap(events: RecapLine[], lead: RecapLine | null): RecapLine[] {
  const shown = events.slice(-RECAP_MAX);
  return lead ? [...shown, lead] : shown;
}

/** Index of the player's last entry in a time-ordered list, or -1 if they haven't played yet. */
export function lastIndexOf<T extends { seat: number }>(xs: T[], seat: number): number {
  for (let i = xs.length - 1; i >= 0; i--) if (xs[i].seat === seat) return i;
  return -1;
}
