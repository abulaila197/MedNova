import { ROOM } from './config';
import { TEAMS, type Team } from './types';

/** Pure lobby rules, shared by the client (disable the Start button) and the server (the real check). */

export interface LobbyPlayer {
  id: string;
  name: string;
  team: Team | null;
  isSpymaster: boolean;
  connected: boolean;
}

export type StartProblem =
  | 'TOO_FEW_PLAYERS'
  | 'TOO_MANY_PLAYERS'
  | 'UNASSIGNED_PLAYERS'
  | 'TEAM_TOO_SMALL'
  | 'TEAM_TOO_BIG';

export interface StartCheck {
  ok: boolean;
  problems: StartProblem[];
  message: string | null;
}

const MESSAGES: Record<StartProblem, string> = {
  TOO_FEW_PLAYERS: `Need at least ${ROOM.minPlayers} players.`,
  TOO_MANY_PLAYERS: `At most ${ROOM.maxPlayers} players.`,
  UNASSIGNED_PLAYERS: 'Everyone must pick a team.',
  TEAM_TOO_SMALL: `Each team needs at least ${ROOM.minPerTeam} players.`,
  TEAM_TOO_BIG: `Each team can have at most ${ROOM.maxPerTeam} players.`,
};

/** Spymasters are NOT required here: the server auto-assigns any missing one at start. */
export function validateStart(players: readonly LobbyPlayer[]): StartCheck {
  const problems: StartProblem[] = [];
  if (players.length < ROOM.minPlayers) problems.push('TOO_FEW_PLAYERS');
  if (players.length > ROOM.maxPlayers) problems.push('TOO_MANY_PLAYERS');
  if (players.some((p) => p.team === null)) problems.push('UNASSIGNED_PLAYERS');
  const sizes = TEAMS.map((t) => players.filter((p) => p.team === t).length);
  if (sizes.some((n) => n < ROOM.minPerTeam) && !problems.includes('UNASSIGNED_PLAYERS')) problems.push('TEAM_TOO_SMALL');
  if (sizes.some((n) => n > ROOM.maxPerTeam)) problems.push('TEAM_TOO_BIG');
  return { ok: problems.length === 0, problems, message: problems.length ? MESSAGES[problems[0]] : null };
}

/** Whether a player may join `team` right now (team not full). */
export const teamHasRoom = (players: readonly LobbyPlayer[], team: Team, excludeId?: string): boolean =>
  players.filter((p) => p.team === team && p.id !== excludeId).length < ROOM.maxPerTeam;

/**
 * Makes sure each team has exactly one spymaster. Keeps an existing one; otherwise picks the
 * first connected member (join order), falling back to the first member.
 */
export function ensureSpymasters(players: readonly LobbyPlayer[], rng?: () => number): LobbyPlayer[] {
  const out = players.map((p) => ({ ...p }));
  for (const team of TEAMS) {
    const members = out.filter((p) => p.team === team);
    const existing = members.filter((p) => p.isSpymaster);
    if (existing.length === 1) continue;
    members.forEach((m) => (m.isSpymaster = false));
    const pool = members.filter((m) => m.connected);
    const candidates = pool.length ? pool : members;
    if (!candidates.length) continue;
    const chosen = rng ? candidates[Math.floor(rng() * candidates.length)] : candidates[0];
    chosen.isSpymaster = true;
  }
  return out;
}

/** Rematch: the spymaster role moves to the next teammate in join order. */
export function rotateSpymasters(players: readonly LobbyPlayer[]): LobbyPlayer[] {
  const out = players.map((p) => ({ ...p, isSpymaster: false }));
  for (const team of TEAMS) {
    const before = players.filter((p) => p.team === team);
    if (!before.length) continue;
    const at = Math.max(0, before.findIndex((p) => p.isSpymaster));
    const nextId = before[(at + 1) % before.length].id;
    const target = out.find((p) => p.id === nextId);
    if (target) target.isSpymaster = true;
  }
  return out;
}
