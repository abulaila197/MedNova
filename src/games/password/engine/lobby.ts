import { CONFIG } from './config';
import { shuffle } from './terms';
import type { Rng, Settings, TeamId } from './types';

/**
 * ONLINE LOBBY (pure reducer, shared by the client and the future server).
 * Exactly 4 players, never more or fewer to start. The host assigns the teams (2 + 2) with a
 * "randomize" button, picks each team's clue giver (and can swap), and chooses the bank, the number
 * of words (5 or 10) and the number of rounds (1 or 2). Only the host can change anything.
 */
export interface LobbyPlayer {
  id: string;
  name: string;
}

export interface LobbyState {
  hostId: string;
  players: LobbyPlayer[];
  teams: Record<string, TeamId | null>;
  givers: Record<TeamId, string | null>;
  settings: Settings;
}

export type LobbyIntent =
  | { type: 'ASSIGN'; playerId: string; team: TeamId | null }
  | { type: 'SET_GIVER'; team: TeamId; playerId: string }
  | { type: 'SWAP_ROLES' }
  | { type: 'RANDOMIZE' }
  | { type: 'SET_SETTINGS'; settings: Partial<Settings> };

export type LobbyEvent = { type: 'PLAYER_JOINED'; player: LobbyPlayer } | { type: 'PLAYER_LEFT'; playerId: string } | { type: 'INTENT'; by: string; intent: LobbyIntent };

export const defaultSettings = (): Settings => ({ bank: 'mixed', wordsPerTeam: 5, rounds: 1 });

export const newLobby = (host: LobbyPlayer): LobbyState => ({
  hostId: host.id,
  players: [host],
  teams: { [host.id]: null },
  givers: { A: null, B: null },
  settings: defaultSettings(),
});

const teamOf = (s: LobbyState, id: string): TeamId | null => s.teams[id] ?? null;
const members = (s: LobbyState, team: TeamId): string[] => s.players.filter((p) => teamOf(s, p.id) === team).map((p) => p.id);

/** Keeps givers valid: a giver must be on that team; the first member is the default. */
function fixGivers(s: LobbyState): LobbyState {
  const givers = { ...s.givers };
  for (const team of ['A', 'B'] as const) {
    const m = members(s, team);
    if (!givers[team] || !m.includes(givers[team]!)) givers[team] = m[0] ?? null;
  }
  return { ...s, givers };
}

export function lobbyReduce(s: LobbyState, event: LobbyEvent, rng: Rng = Math.random): LobbyState {
  switch (event.type) {
    case 'PLAYER_JOINED': {
      if (s.players.length >= CONFIG.PLAYERS || s.players.some((p) => p.id === event.player.id)) return s;
      return { ...s, players: [...s.players, event.player], teams: { ...s.teams, [event.player.id]: null } };
    }
    case 'PLAYER_LEFT': {
      if (!s.players.some((p) => p.id === event.playerId)) return s;
      const players = s.players.filter((p) => p.id !== event.playerId);
      const { [event.playerId]: _gone, ...teams } = s.teams;
      // the host leaving passes the host role to the next player
      const hostId = event.playerId === s.hostId ? (players[0]?.id ?? s.hostId) : s.hostId;
      return fixGivers({ ...s, players, teams, hostId });
    }
    case 'INTENT': {
      if (event.by !== s.hostId) return s; // only the host can change anything
      return applyIntent(s, event.intent, rng);
    }
  }
}

function applyIntent(s: LobbyState, intent: LobbyIntent, rng: Rng): LobbyState {
  switch (intent.type) {
    case 'ASSIGN': {
      if (!s.players.some((p) => p.id === intent.playerId)) return s;
      if (intent.team !== null && members(s, intent.team).filter((id) => id !== intent.playerId).length >= CONFIG.TEAM_SIZE) return s; // team full
      return fixGivers({ ...s, teams: { ...s.teams, [intent.playerId]: intent.team } });
    }
    case 'SET_GIVER': {
      if (teamOf(s, intent.playerId) !== intent.team) return s;
      return { ...s, givers: { ...s.givers, [intent.team]: intent.playerId } };
    }
    case 'SWAP_ROLES': {
      // each team's giver and guesser trade places
      const givers = { ...s.givers };
      for (const team of ['A', 'B'] as const) {
        const other = members(s, team).find((id) => id !== s.givers[team]);
        if (other) givers[team] = other;
      }
      return { ...s, givers };
    }
    case 'RANDOMIZE': {
      const shuffled = shuffle(
        s.players.map((p) => p.id),
        rng,
      );
      const teams: Record<string, TeamId | null> = {};
      shuffled.forEach((id, i) => (teams[id] = i < CONFIG.TEAM_SIZE ? 'A' : 'B'));
      return fixGivers({ ...s, teams, givers: { A: null, B: null } });
    }
    case 'SET_SETTINGS': {
      const next = { ...s.settings, ...intent.settings };
      const valid = (next.bank === 'clinical' || next.bank === 'basic' || next.bank === 'mixed') && (next.wordsPerTeam === 5 || next.wordsPerTeam === 10) && (next.rounds === 1 || next.rounds === 2);
      return valid ? { ...s, settings: next } : s;
    }
  }
}

export type StartCheck = { ok: true } | { ok: false; reason: 'NEED_4_PLAYERS' | 'TEAMS_NOT_2_AND_2' | 'MISSING_GIVER' };

/** The match can start only with exactly 4 players, 2 per team, and a giver in each team. */
export function canStart(s: LobbyState): StartCheck {
  if (s.players.length !== CONFIG.PLAYERS) return { ok: false, reason: 'NEED_4_PLAYERS' };
  if (members(s, 'A').length !== CONFIG.TEAM_SIZE || members(s, 'B').length !== CONFIG.TEAM_SIZE) {
    return { ok: false, reason: 'TEAMS_NOT_2_AND_2' };
  }
  for (const team of ['A', 'B'] as const) {
    if (!s.givers[team] || !members(s, team).includes(s.givers[team]!)) return { ok: false, reason: 'MISSING_GIVER' };
  }
  return { ok: true };
}

/** Who plays which role in a round: round 1 as set in the lobby, round 2 swapped. */
export function rolesForRound(s: Pick<LobbyState, 'givers' | 'teams' | 'players'>, round: number): Record<string, { team: TeamId; role: 'giver' | 'guesser' }> {
  const out: Record<string, { team: TeamId; role: 'giver' | 'guesser' }> = {};
  for (const p of s.players) {
    const team = s.teams[p.id];
    if (!team) continue;
    const isGiver = s.givers[team] === p.id;
    out[p.id] = { team, role: (round % 2 === 0 ? isGiver : !isGiver) ? 'giver' : 'guesser' };
  }
  return out;
}
