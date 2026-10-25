import { createGame, reduceGame, type GameEffect, type GameEvent, type GameState } from './gameCore';
import { offlineReward, type Reward } from './rewards';
import type { GameRecord } from './records';
import type { Card, HapticId, SoundId, StyleChoice, Team } from './types';
import { TEAMS } from './types';

/**
 * Offline pass-and-play on one device.
 *
 *   idle -> keyCheck (red spymaster peeks, then blue) -> playing -> finished
 *
 * The spymaster says the clue ALOUD, so the app only takes the number
 * (CLUE with word: null). Hold-to-reveal: KEY_HOLD shows the key, KEY_RELEASE (or
 * anything else happening) hides it again. It is allowed only in key check and in the
 * 'ready' / 'clue' phase of the team whose spymaster is holding the device.
 * Between turns the game waits in 'ready' until BEGIN_TURN, so nobody's clock runs
 * while the device is being passed.
 */

export interface OfflineRoster {
  /** 2-3 names per team. */
  red: string[];
  blue: string[];
  /** Index into each roster. */
  spymaster: Record<Team, number>;
}

export interface OfflineSettings {
  style: StyleChoice;
  roster: OfflineRoster;
}

export type OfflinePhase = 'idle' | 'keyCheck' | 'playing' | 'finished';

export interface OfflineState {
  phase: OfflinePhase;
  settings: OfflineSettings | null;
  game: GameState | null;
  /** keyCheck: whose spymaster is up. */
  keyTeam: Team | null;
  /** Who is holding the key button right now (null = key hidden). */
  keyHeldBy: Team | null;
  startedAt: number;
  record: GameRecord | null;
  reward: Reward | null;
  rematches: number;
}

export type OfflineEvent =
  | { type: 'START'; settings: OfflineSettings; cards: Card[]; startingTeam: Team; at: number }
  | { type: 'KEY_HOLD'; team: Team }
  | { type: 'KEY_RELEASE' }
  | { type: 'KEY_DONE' }
  | { type: 'GAME'; event: GameEvent }
  | { type: 'REMATCH'; cards: Card[]; startingTeam: Team; at: number }
  | { type: 'RESET' };

export type OfflineEffect =
  | GameEffect
  | { type: 'gameFinished'; record: GameRecord; reward: Reward };

export const createInitialOfflineState = (): OfflineState => ({
  phase: 'idle',
  settings: null,
  game: null,
  keyTeam: null,
  keyHeldBy: null,
  startedAt: 0,
  record: null,
  reward: null,
  rematches: 0,
});

export const spymasterName = (s: OfflineSettings, team: Team): string => s.roster[team][s.roster.spymaster[team]];

export const OFFLINE_SOUNDS: SoundId[] = ['clue', 'correct', 'neutral', 'wrong', 'assassin', 'turn', 'win', 'tick'];
export const OFFLINE_HAPTICS: HapticId[] = ['light', 'warning', 'error', 'success'];

export function validateOfflineSettings(s: OfflineSettings): string | null {
  for (const t of TEAMS) {
    const n = s.roster[t].length;
    if (n < 2 || n > 3) return `${t} team needs 2-3 players.`;
    if (s.roster.spymaster[t] < 0 || s.roster.spymaster[t] >= n) return `Pick a spymaster for ${t}.`;
    if (s.roster[t].some((name) => !name.trim())) return 'Every player needs a name.';
  }
  const total = s.roster.red.length + s.roster.blue.length;
  if (total < 4 || total > 6) return 'Between 4 and 6 players in total.';
  return null;
}

export function reduceOffline(state: OfflineState, event: OfflineEvent): { state: OfflineState; effects: OfflineEffect[] } {
  switch (event.type) {
    case 'START': {
      if (validateOfflineSettings(event.settings)) {
        return { state, effects: [{ type: 'notice', code: 'BAD_CARD', message: validateOfflineSettings(event.settings)! }] };
      }
      return {
        state: {
          ...createInitialOfflineState(),
          phase: 'keyCheck',
          settings: event.settings,
          game: createGame({ cards: event.cards, startingTeam: event.startingTeam, now: event.at, config: { requireReady: true } }),
          keyTeam: 'red',
          startedAt: event.at,
        },
        effects: [],
      };
    }

    case 'KEY_HOLD': {
      if (!canPeek(state, event.team)) return { state, effects: [] };
      return { state: { ...state, keyHeldBy: event.team }, effects: [{ type: 'haptic', id: 'light' }] };
    }
    case 'KEY_RELEASE':
      return state.keyHeldBy === null ? { state, effects: [] } : { state: { ...state, keyHeldBy: null }, effects: [] };

    case 'KEY_DONE': {
      if (state.phase !== 'keyCheck') return { state, effects: [] };
      if (state.keyTeam === 'red') return { state: { ...state, keyTeam: 'blue', keyHeldBy: null }, effects: [] };
      return { state: { ...state, phase: 'playing', keyTeam: null, keyHeldBy: null }, effects: [] };
    }

    case 'GAME': {
      if (state.phase !== 'playing' || !state.game) return { state, effects: [] };
      const r = reduceGame(state.game, event.event);
      // Anything but a peek hides the key.
      let next: OfflineState = { ...state, game: r.state, keyHeldBy: null };
      const effects: OfflineEffect[] = [...r.effects];
      if (r.state.phase === 'over' && r.state.winner && r.state.winReason) {
        const record = buildOfflineRecord(next, event.event.at);
        const reward = offlineReward();
        next = { ...next, phase: 'finished', record, reward };
        effects.push({ type: 'gameFinished', record, reward });
      }
      return { state: next, effects };
    }

    case 'REMATCH': {
      if (state.phase !== 'finished' || !state.settings) return { state, effects: [] };
      const s = state.settings;
      const rotated = rotateIndexes(s);
      return {
        state: {
          ...createInitialOfflineState(),
          phase: 'keyCheck',
          settings: { ...s, roster: { ...s.roster, spymaster: rotated } },
          game: createGame({ cards: event.cards, startingTeam: event.startingTeam, now: event.at, config: { requireReady: true } }),
          keyTeam: 'red',
          startedAt: event.at,
          rematches: state.rematches + 1,
        },
        effects: [],
      };
    }

    case 'RESET':
      return { state: createInitialOfflineState(), effects: [] };
  }
}

function canPeek(state: OfflineState, team: Team): boolean {
  if (state.phase === 'keyCheck') return state.keyTeam === team;
  if (state.phase === 'playing' && state.game) {
    return state.game.turn === team && (state.game.phase === 'ready' || state.game.phase === 'clue') && state.game.pausedAt === null;
  }
  return false;
}

function rotateIndexes(s: OfflineSettings): Record<Team, number> {
  const next = { ...s.roster.spymaster };
  for (const t of TEAMS) next[t] = (s.roster.spymaster[t] + 1) % s.roster[t].length;
  return next;
}

function buildOfflineRecord(state: OfflineState, at: number): GameRecord {
  const s = state.settings!;
  const g = state.game!;
  const players = TEAMS.flatMap((t) =>
    s.roster[t].map((name, i) => ({
      id: `${t}-${i}`,
      name,
      team: t,
      role: i === s.roster.spymaster[t] ? ('spymaster' as const) : ('guesser' as const),
    })),
  );
  return {
    id: `offline-${state.startedAt}-${state.rematches}`,
    mode: 'offline',
    style: s.style,
    finishedAt: at,
    startingTeam: g.startingTeam,
    winner: g.winner!,
    winReason: g.winReason!,
    turns: g.turnNumber,
    players,
  };
}

