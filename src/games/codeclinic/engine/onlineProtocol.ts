import type { ClueCheck } from './clueCheck';
import type { ActiveClue, GamePhase, LogEntry } from './gameCore';
import type { LobbyPlayer, StartCheck } from './lobby';
import type { CardColor, ClueNumber, StyleChoice, Team, WinReason } from './types';

/** Messages between the room server and the app. Plain JSON: send them over any socket. */

export interface RosterPlayer extends LobbyPlayer {
  /** True once the rejoin window expired (or they left): they are out for this game. */
  left: boolean;
}

/** A card as guessers see it: the color is null until the card is revealed (or the game is over). */
export interface PublicCard {
  index: number;
  term: string;
  revealed: boolean;
  color: CardColor | null;
}

export interface PublicClue {
  team: Team;
  word: string | null;
  number: ClueNumber;
  guessesLeft: number | null;
  guesses: number;
}

export interface PublicGame {
  cards: PublicCard[];
  style: StyleChoice;
  startingTeam: Team;
  turn: Team;
  phase: GamePhase;
  phaseEndsAt: number | null;
  clue: PublicClue | null;
  remaining: Record<Team, number>;
  log: LogEntry[];
  turnNumber: number;
  winner: Team | null;
  winReason: WinReason | null;
  /** The card a guesser has tapped once; everyone sees it. Another guesser may confirm it. */
  marker: number | null;
  hostId: string;
  players: RosterPlayer[];
}

export interface LobbyState {
  hostId: string;
  players: LobbyPlayer[];
  style: StyleChoice;
  start: StartCheck;
}

export type ClientMessage =
  | { t: 'SET_TEAM'; team: Team | null }
  | { t: 'CLAIM_SPYMASTER' }
  | { t: 'RELEASE_SPYMASTER' }
  | { t: 'ASSIGN_SPYMASTER'; playerId: string }
  | { t: 'SET_STYLE'; style: StyleChoice }
  | { t: 'START' }
  | { t: 'CLUE'; word: string; number: ClueNumber }
  | { t: 'MARK'; cardIndex: number | null }
  | { t: 'CONFIRM'; cardIndex: number }
  | { t: 'END_TURN' }
  | { t: 'REMATCH' }
  | { t: 'BACK_TO_LOBBY' }
  | { t: 'LEAVE' };

export type RejectReason =
  | 'NOT_HOST'
  | 'NOT_IN_LOBBY'
  | 'NOT_IN_GAME'
  | 'ROOM_FULL'
  | 'GAME_IN_PROGRESS'
  | 'TEAM_FULL'
  | 'NO_TEAM'
  | 'SPYMASTER_TAKEN'
  | 'NOT_SPYMASTER'
  | 'NOT_GUESSER'
  | 'NOT_YOUR_TURN'
  | 'NOT_READY'
  | 'NOT_ENOUGH_TERMS'
  | 'MARK_FIRST'
  | 'UNKNOWN_PLAYER'
  | 'LEFT_GAME'
  | 'CLUE_REJECTED'
  | 'BAD_NUMBER'
  | 'WRONG_PHASE'
  | 'WRONG_TEAM'
  | 'CARD_ALREADY_REVEALED'
  | 'BAD_CARD'
  | 'NEED_ONE_GUESS';

export type ServerEvent =
  | { t: 'LOBBY'; lobby: LobbyState; serverNow: number }
  /** Sent at game start, after every action, and on rejoin. */
  | { t: 'GAME'; game: PublicGame; serverNow: number }
  /** Private: only spymasters receive it (also after a promotion, and on rejoin). */
  | { t: 'KEY'; key: CardColor[] }
  | { t: 'REJECTED'; reason: RejectReason; message: string }
  | { t: 'ROOM_CLOSED' };

export interface Outbound {
  /** A player id, or 'all'. */
  to: string;
  event: ServerEvent;
}

export type { ActiveClue, ClueCheck };
