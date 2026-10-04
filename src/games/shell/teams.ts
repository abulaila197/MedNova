// Shared team play (TM1-TM6): the host makes any number of teams (at least 2, a team may be one player),
// each with a preset colour and a default name the host can rename. Team score is the players' average
// unless the game counts team wins (Medicordle). In turn-based modes teams alternate.
import type { Play, Seat, Standing } from '../engine/types';

export type Team = { id: number; name: string; color: string };

export const TEAM_PRESETS = [
  { name: 'Team Cyan', color: '#6fd6ff' },
  { name: 'Team Violet', color: '#a48bff' },
  { name: 'Team Rose', color: '#ff7aa8' },
  { name: 'Team Amber', color: '#f5b041' },
  { name: 'Team Green', color: '#34d399' },
  { name: 'Team Coral', color: '#ff8a5b' },
];

export const presetTeam = (id: number): Team => ({ id, ...TEAM_PRESETS[id % TEAM_PRESETS.length] });

/** Teams saved on the play's settings, or null when the host played without teams. */
export function teamsOf(play: Pick<Play, 'settings'>): Team[] | null {
  const t = play.settings.teams as Team[] | undefined;
  return Array.isArray(t) && t.length >= 2 ? t : null;
}

/**
 * TM5: one lap where teams alternate (A, B, C, A...) and each team's players go in order.
 * Every player appears once; when teams are uneven the bigger team's extra players finish the lap.
 */
export function teamLap(seats: Seat[], teams: Team[]): number[] {
  const groups = teams.map((t) => seats.filter((x) => x.team === t.id).map((x) => x.seat)).filter((g) => g.length);
  const out: number[] = [];
  for (let i = 0; out.length < groups.reduce((a, g) => a + g.length, 0); i++) for (const g of groups) if (i < g.length) out.push(g[i]);
  return out;
}

export type TeamRow = Team & { score: number; players: number; rank: number };

/** Team table from the players' standings: average (TM3) or added up (games where the team wins the item). */
export function teamStandings(standings: Standing[], seats: Seat[], teams: Team[], how: 'average' | 'sum' = 'average'): TeamRow[] {
  const rows = teams
    .map((t) => {
      const mine = standings.filter((r) => seats.find((x) => x.seat === r.seat)?.team === t.id);
      const total = mine.reduce((a, r) => a + r.score, 0);
      const score = how === 'sum' || !mine.length ? total : Math.round((total / mine.length) * 10) / 10;
      return { ...t, score, players: mine.length };
    })
    .filter((t) => t.players > 0)
    .sort((a, b) => b.score - a.score);
  const out: TeamRow[] = [];
  rows.forEach((r, i) => out.push({ ...r, rank: i > 0 && rows[i - 1].score === r.score ? out[i - 1].rank : i + 1 }));
  return out;
}
