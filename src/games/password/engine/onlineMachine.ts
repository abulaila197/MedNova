import { CONFIG } from './config';
import { validateClue, type ClueRejection } from './clues';
import { step, stay } from './machine';
import type { MatchSummary } from './scoring';
import { findTerm } from './terms';
import type { Effect, Role, Step, TeamId, Term, TeamRoundResult, TermId } from './types';

/**
 * ONLINE MODE (client side). 4 players, 2 teams of 2, both teams play at the same time.
 *
 *  - The SERVER is authoritative: it judges clues and guesses, and only the giver ever receives the
 *    secret term (S_NEW_WORD). The client sends intents and applies the server's events.
 *  - The giver types clues; they are checked here for instant feedback and again by the server.
 *    The guesser picks from autocomplete (see searchTerms). Wrong guesses are free.
 *  - Each team sees only the other team's number of completed words.
 *  - A round lasts at most 3 minutes (the server decides; the client just shows the countdown).
 *  - Disconnect: 30 s to rejoin, then the team forfeits the round (the server decides).
 *  - The client sends throttled ACTIVITY pings so the server can apply its idle rule.
 *  - Rematch needs all 4 players; the server then starts a new match.
 */

export interface OnlineEnv {
  terms: readonly Term[];
  now: () => number;
}

export interface PlayerView {
  id: string;
  name: string;
  team: TeamId;
  role: Role;
  connected: boolean;
}

export interface TeamProgress {
  completed: number;
  total: number;
}

export type OnlineUi =
  | { name: 'connecting' }
  | { name: 'playing' }
  | { name: 'reconnecting' }
  | { name: 'roundBreak'; round: number; results: Record<TeamId, TeamRoundResult> }
  | { name: 'results'; summary: MatchSummary }
  | { name: 'left' };

export type OnlineNotice = ClueRejection | 'NOT_GIVER' | 'NOT_GUESSER' | 'NO_WORD';

export interface OnlineState {
  ui: OnlineUi;
  myId: string;
  myTeam: TeamId | null;
  role: Role | null;
  round: number;
  totalRounds: number;
  players: PlayerView[];
  /** The secret term: only the giver ever has it. */
  currentTermId: TermId | null;
  /** Clues given for the current word (both team members see them). */
  clues: string[];
  /** Wrong guesses for the current word. */
  guesses: TermId[];
  progress: Record<TeamId, TeamProgress>;
  /** Local timestamp when the round ends (the server sends "ends in N ms"). */
  roundEndsAt: number | null;
  forfeitedTeams: TeamId[];
  notice: OnlineNotice | null;
  lastActivitySentAt: number | null;
  rematchAccepted: string[];
}

export interface SnapshotData {
  myTeam: TeamId;
  role: Role;
  round: number;
  totalRounds: number;
  players: PlayerView[];
  currentTermId: TermId | null;
  clues: string[];
  guesses: TermId[];
  progress: Record<TeamId, TeamProgress>;
  endsInMs: number;
}

export type OnlineEvent =
  // user
  | { type: 'GIVE_CLUE'; text: string }
  | { type: 'PICK_GUESS'; termId: TermId }
  | { type: 'SKIP' }
  | { type: 'USER_ACTIVITY' }
  | { type: 'DISMISS_NOTICE' }
  | { type: 'QUIT' }
  | { type: 'REMATCH_ACCEPT' }
  // connection
  | { type: 'CONNECTION_LOST' }
  | { type: 'REJOIN_TIMEOUT' }
  // server
  | { type: 'S_SNAPSHOT'; data: SnapshotData }
  | { type: 'S_ROUND_START'; round: number; role: Role; endsInMs: number; progress: Record<TeamId, TeamProgress>; players?: PlayerView[] }
  | { type: 'S_NEW_WORD'; termId: TermId | null }
  | { type: 'S_CLUE_ACCEPTED'; text: string }
  | { type: 'S_CLUE_REJECTED'; reason: ClueRejection }
  | { type: 'S_GUESS_WRONG'; termId: TermId }
  | { type: 'S_PROGRESS'; teamId: TeamId; completed: number; total: number }
  | { type: 'S_ROUND_ENDED'; round: number; results: Record<TeamId, TeamRoundResult> }
  | { type: 'S_MATCH_ENDED'; summary: MatchSummary }
  | { type: 'S_TEAM_FORFEITED'; teamId: TeamId }
  | { type: 'S_PLAYER_CONNECTION'; playerId: string; connected: boolean }
  | { type: 'S_REMATCH'; accepted: string[] }
  | { type: 'S_REMATCH_STARTED' };

type FX = Effect<OnlineEvent>;
type OnlineStep = Step<OnlineState, OnlineEvent>;
const REJOIN = 'rejoin';

export function initialOnlineState(myId: string): OnlineState {
  return {
    ui: { name: 'connecting' },
    myId,
    myTeam: null,
    role: null,
    round: 0,
    totalRounds: 1,
    players: [],
    currentTermId: null,
    clues: [],
    guesses: [],
    progress: { A: { completed: 0, total: 0 }, B: { completed: 0, total: 0 } },
    roundEndsAt: null,
    forfeitedTeams: [],
    notice: null,
    lastActivitySentAt: null,
    rematchAccepted: [],
  };
}

/** Only the other team's number of completed words is shown. */
export const opponentProgress = (s: OnlineState): TeamProgress | null => (s.myTeam ? s.progress[s.myTeam === 'A' ? 'B' : 'A'] : null);
export const myProgress = (s: OnlineState): TeamProgress | null => (s.myTeam ? s.progress[s.myTeam] : null);
export const msLeft = (s: OnlineState, now: number): number => (s.roundEndsAt === null ? 0 : Math.max(0, s.roundEndsAt - now));

/** Throttled "I touched the screen" ping for the server's idle rule. */
function withPing(env: OnlineEnv, s: OnlineState): { state: OnlineState; fx: FX[] } {
  const now = env.now();
  if (s.lastActivitySentAt === null || now - s.lastActivitySentAt >= CONFIG.ACTIVITY_PING_MS) {
    return { state: { ...s, lastActivitySentAt: now }, fx: [{ type: 'SEND', message: { t: 'ACTIVITY' } }] };
  }
  return { state: s, fx: [] };
}

function userAction(env: OnlineEnv, s: OnlineState, event: OnlineEvent): OnlineStep {
  const ping = withPing(env, s);
  let state = ping.state;
  const done = (patch: Partial<OnlineState>, fx: FX[] = []): OnlineStep => step<OnlineState, OnlineEvent>({ ...state, ...patch }, [...ping.fx, ...fx]);

  switch (event.type) {
    case 'USER_ACTIVITY':
      return done({});
    case 'DISMISS_NOTICE':
      return done({ notice: null });
    case 'GIVE_CLUE': {
      if (s.role !== 'giver') return done({ notice: 'NOT_GIVER' });
      const term = s.currentTermId ? findTerm(env.terms, s.currentTermId) : undefined;
      if (!term) return done({ notice: 'NO_WORD' });
      const check = validateClue(term, event.text, s.clues);
      if (!check.ok)
        return done({ notice: check.reason }, [
          { type: 'HAPTIC', kind: 'wrong' },
          { type: 'SOUND', kind: 'buzzer' },
        ]);
      return done({ notice: null }, [{ type: 'SEND', message: { t: 'CLUE', text: check.clue } }]);
    }
    case 'PICK_GUESS': {
      if (s.role !== 'guesser') return done({ notice: 'NOT_GUESSER' });
      return done({ notice: null }, [{ type: 'SEND', message: { t: 'GUESS', termId: event.termId } }]);
    }
    case 'SKIP': {
      if (s.role !== 'giver') return done({ notice: 'NOT_GIVER' });
      return done({ notice: null }, [{ type: 'SEND', message: { t: 'SKIP' } }]);
    }
    default:
      return stay(s);
  }
}

export function onlineTransition(env: OnlineEnv, s: OnlineState, event: OnlineEvent): OnlineStep {
  const { ui } = s;
  if (ui.name === 'left') return stay(s);

  // After the match: results and rematch.
  if (ui.name === 'results') {
    switch (event.type) {
      case 'REMATCH_ACCEPT':
        return step<OnlineState, OnlineEvent>(s, [{ type: 'SEND', message: { t: 'REMATCH_ACCEPT' } }]);
      case 'S_REMATCH':
        return step<OnlineState, OnlineEvent>({ ...s, rematchAccepted: event.accepted });
      case 'S_REMATCH_STARTED':
        return step<OnlineState, OnlineEvent>({ ...initialOnlineState(s.myId), players: s.players });
      case 'QUIT':
        return step<OnlineState, OnlineEvent>({ ...s, ui: { name: 'left' } }, [{ type: 'NAVIGATE', to: 'menu' }]);
      default:
        return stay(s);
    }
  }

  // Events that work in every live state.
  switch (event.type) {
    case 'QUIT': // quitting forfeits the round for the team
      return step<OnlineState, OnlineEvent>({ ...s, ui: { name: 'left' } }, [
        { type: 'SEND', message: { t: 'QUIT' } },
        { type: 'CANCEL_TIMER', id: REJOIN },
        { type: 'NAVIGATE', to: 'menu' },
      ]);
    case 'S_MATCH_ENDED':
      return step<OnlineState, OnlineEvent>({ ...s, ui: { name: 'results', summary: event.summary } }, [
        { type: 'CANCEL_TIMER', id: REJOIN },
        { type: 'SOUND', kind: 'ding' },
      ]);
    case 'CONNECTION_LOST':
      if (ui.name === 'reconnecting') return stay(s);
      return step<OnlineState, OnlineEvent>({ ...s, ui: { name: 'reconnecting' } }, [{ type: 'START_TIMER', id: REJOIN, ms: CONFIG.REJOIN_WINDOW_MS, event: { type: 'REJOIN_TIMEOUT' } }]);
    case 'REJOIN_TIMEOUT':
      return ui.name === 'reconnecting' ? step<OnlineState, OnlineEvent>({ ...s, ui: { name: 'left' } }, [{ type: 'NAVIGATE', to: 'menu' }]) : stay(s);
    case 'S_SNAPSHOT': {
      const d = event.data;
      return step<OnlineState, OnlineEvent>(
        {
          ...s,
          ui: { name: 'playing' },
          myTeam: d.myTeam,
          role: d.role,
          round: d.round,
          totalRounds: d.totalRounds,
          players: d.players,
          currentTermId: d.role === 'giver' ? d.currentTermId : null, // the guesser never gets the term
          clues: d.clues,
          guesses: d.guesses,
          progress: d.progress,
          roundEndsAt: env.now() + d.endsInMs,
        },
        [{ type: 'CANCEL_TIMER', id: REJOIN }],
      );
    }
    case 'S_PLAYER_CONNECTION':
      return step<OnlineState, OnlineEvent>({
        ...s,
        players: s.players.map((p) => (p.id === event.playerId ? { ...p, connected: event.connected } : p)),
      });
    case 'S_TEAM_FORFEITED':
      return step<OnlineState, OnlineEvent>({
        ...s,
        forfeitedTeams: s.forfeitedTeams.includes(event.teamId) ? s.forfeitedTeams : [...s.forfeitedTeams, event.teamId],
      });
    case 'S_REMATCH':
      return step<OnlineState, OnlineEvent>({ ...s, rematchAccepted: event.accepted });
    default:
      break;
  }

  // Server facts about the round.
  switch (event.type) {
    case 'S_ROUND_START':
      if (ui.name === 'reconnecting') return stay(s);
      return step<OnlineState, OnlineEvent>(
        {
          ...s,
          ui: { name: 'playing' },
          round: event.round,
          role: event.role,
          players: event.players ?? s.players,
          progress: event.progress,
          roundEndsAt: env.now() + event.endsInMs,
          currentTermId: null,
          clues: [],
          guesses: [],
          forfeitedTeams: [],
          notice: null,
        },
        [{ type: 'SOUND', kind: 'tick' }],
      );
    case 'S_NEW_WORD':
      return step<OnlineState, OnlineEvent>({
        ...s,
        currentTermId: s.role === 'giver' ? event.termId : null,
        clues: [],
        guesses: [],
        notice: null,
      });
    case 'S_CLUE_ACCEPTED':
      return step<OnlineState, OnlineEvent>({ ...s, clues: [...s.clues, event.text], notice: null }, [{ type: 'SOUND', kind: 'tap' }]);
    case 'S_CLUE_REJECTED':
      return step<OnlineState, OnlineEvent>({ ...s, notice: event.reason }, [{ type: 'HAPTIC', kind: 'wrong' }]);
    case 'S_GUESS_WRONG':
      return step<OnlineState, OnlineEvent>({ ...s, guesses: s.guesses.includes(event.termId) ? s.guesses : [...s.guesses, event.termId] }, [
        { type: 'SOUND', kind: 'buzzer' },
        { type: 'HAPTIC', kind: 'wrong' },
      ]);
    case 'S_PROGRESS': {
      const mine = s.myTeam === event.teamId;
      return step<OnlineState, OnlineEvent>(
        { ...s, progress: { ...s.progress, [event.teamId]: { completed: event.completed, total: event.total } } },
        mine
          ? [
              { type: 'SOUND', kind: 'ding' },
              { type: 'HAPTIC', kind: 'correct' },
            ]
          : [],
      );
    }
    case 'S_ROUND_ENDED':
      return step<OnlineState, OnlineEvent>({ ...s, ui: { name: 'roundBreak', round: event.round, results: event.results } }, [{ type: 'SOUND', kind: 'buzzer' }]);
    default:
      break;
  }

  if (ui.name !== 'playing' && event.type !== 'USER_ACTIVITY' && event.type !== 'DISMISS_NOTICE') return stay(s);
  if (ui.name === 'connecting' || ui.name === 'reconnecting') return stay(s);
  return userAction(env, s, event);
}
