import { BOARD, CLUE, TIMERS } from './config';
import { unrevealedTerms } from './board';
import { checkClue } from './clueCheck';
import {
  otherTeam,
  type Card,
  type CardColor,
  type ClueNumber,
  type HapticId,
  type SoundId,
  type Team,
  type WinReason,
} from './types';

/**
 * The shared game core: one board, two teams, turns of clue -> guesses.
 * Pure: `(state, event) => { state, effects }`. No clock (events carry `at`),
 * no I/O. The offline machine and the online server both wrap this.
 *
 * Turn flow
 *   ready (offline only: waits for BEGIN_TURN) -> clue (60 s) -> guess (60 s) -> next team's turn
 *
 * Rules
 *  - Clue number 1-9 or 'unlimited'. Guesses allowed = number + 1 (unlimited: no cap).
 *  - Own-team card: keep guessing. Neutral or enemy card: turn ends. Assassin: that team loses.
 *  - Revealing the last card of either team (even by mistake) wins it for that team.
 *  - May end the turn voluntarily only after at least 1 guess.
 *  - Clue timer runs out: that team loses its turn. Guess timer runs out: turn passes.
 */

export type GamePhase = 'ready' | 'clue' | 'guess' | 'over';

export interface GameConfig {
  clueMs: number;
  guessMs: number;
  /** Offline: pause between turns until the next team's device holder taps start. */
  requireReady: boolean;
}

export const DEFAULT_GAME_CONFIG: GameConfig = { clueMs: TIMERS.clueMs, guessMs: TIMERS.guessMs, requireReady: false };

export interface ActiveClue {
  team: Team;
  /** null offline: the spymaster says it aloud. */
  word: string | null;
  number: ClueNumber;
  /** null when unlimited. */
  guessesLeft: number | null;
  guesses: number;
}

export type LogEntry =
  | { kind: 'clue'; team: Team; word: string | null; number: ClueNumber; at: number }
  | { kind: 'guess'; team: Team; cardIndex: number; color: CardColor; at: number }
  | { kind: 'endTurn'; team: Team; at: number }
  | { kind: 'timeout'; team: Team; phase: 'clue' | 'guess'; at: number }
  | { kind: 'forfeit'; team: Team; at: number };

export interface GameState {
  config: GameConfig;
  cards: Card[];
  startingTeam: Team;
  turn: Team;
  phase: GamePhase;
  /** When the current phase's timer ends (null in 'ready' and 'over'). */
  phaseEndsAt: number | null;
  pausedAt: number | null;
  clue: ActiveClue | null;
  remaining: Record<Team, number>;
  log: LogEntry[];
  turnNumber: number;
  winner: Team | null;
  winReason: WinReason | null;
}

export type GameEvent =
  | { type: 'BEGIN_TURN'; at: number }
  | { type: 'CLUE'; team: Team; word: string | null; number: ClueNumber; at: number }
  | { type: 'GUESS'; team: Team; cardIndex: number; at: number }
  | { type: 'END_TURN'; team: Team; at: number }
  | { type: 'TICK'; at: number }
  | { type: 'PAUSE'; at: number }
  | { type: 'RESUME'; at: number }
  | { type: 'FORFEIT'; team: Team; at: number };

export type NoticeCode =
  | 'CLUE_REJECTED'
  | 'BAD_NUMBER'
  | 'WRONG_PHASE'
  | 'WRONG_TEAM'
  | 'CARD_ALREADY_REVEALED'
  | 'BAD_CARD'
  | 'NEED_ONE_GUESS'
  | 'CLUE_TIMEOUT'
  | 'GUESS_TIMEOUT';

export type GameEffect =
  | { type: 'sound'; id: SoundId }
  | { type: 'haptic'; id: HapticId }
  | { type: 'notice'; code: NoticeCode; message: string };

export interface GameResult {
  state: GameState;
  effects: GameEffect[];
}

export function createGame(args: {
  cards: Card[];
  startingTeam: Team;
  now: number;
  config?: Partial<GameConfig>;
}): GameState {
  const config = { ...DEFAULT_GAME_CONFIG, ...args.config };
  const count = (t: Team) => args.cards.filter((c) => c.color === t && !c.revealed).length;
  const base: GameState = {
    config,
    cards: args.cards,
    startingTeam: args.startingTeam,
    turn: args.startingTeam,
    phase: 'ready',
    phaseEndsAt: null,
    pausedAt: null,
    clue: null,
    remaining: { red: count('red'), blue: count('blue') },
    log: [],
    turnNumber: 1,
    winner: null,
    winReason: null,
  };
  return config.requireReady ? base : { ...base, phase: 'clue', phaseEndsAt: args.now + config.clueMs };
}

export const isOver = (s: GameState) => s.phase === 'over';
export const getPhaseRemainingMs = (s: GameState, now: number): number =>
  s.phaseEndsAt === null ? 0 : Math.max(0, (s.pausedAt ?? now) < s.phaseEndsAt ? s.phaseEndsAt - (s.pausedAt ?? now) : 0);
export const guessesAllowed = (clue: ActiveClue | null): number | null => (clue ? clue.guessesLeft : null);
export const canEndTurn = (s: GameState): boolean => s.phase === 'guess' && (s.clue?.guesses ?? 0) >= 1;

const notice = (code: NoticeCode, message: string): GameEffect => ({ type: 'notice', code, message });
const sound = (id: SoundId): GameEffect => ({ type: 'sound', id });
const haptic = (id: HapticId): GameEffect => ({ type: 'haptic', id });

export function reduceGame(state: GameState, event: GameEvent): GameResult {
  if (state.phase === 'over') return { state, effects: [] };

  if (event.type === 'PAUSE') {
    return state.pausedAt === null ? { state: { ...state, pausedAt: event.at }, effects: [] } : { state, effects: [] };
  }
  if (event.type === 'RESUME') {
    if (state.pausedAt === null) return { state, effects: [] };
    const shift = Math.max(0, event.at - state.pausedAt);
    return {
      state: { ...state, pausedAt: null, phaseEndsAt: state.phaseEndsAt === null ? null : state.phaseEndsAt + shift },
      effects: [],
    };
  }
  if (state.pausedAt !== null) return { state, effects: [] }; // everything else waits while paused

  if (event.type === 'FORFEIT') return finish(state, otherTeam(event.team), 'forfeit', event.at, [], { kind: 'forfeit', team: event.team, at: event.at });

  // Apply an expired timer first, so a late action can't sneak in after the buzzer.
  const expired = applyTimeout(state, event.at);
  if (event.type === 'TICK') return expired;
  if (expired.state.phase === 'over') return expired;

  const next = handle(expired.state, event);
  return { state: next.state, effects: [...expired.effects, ...next.effects] };
}

function handle(state: GameState, event: Exclude<GameEvent, { type: 'TICK' | 'PAUSE' | 'RESUME' | 'FORFEIT' }>): GameResult {
  switch (event.type) {
    case 'BEGIN_TURN':
      if (state.phase !== 'ready') return { state, effects: [] };
      return { state: { ...state, phase: 'clue', phaseEndsAt: event.at + state.config.clueMs }, effects: [sound('turn')] };

    case 'CLUE': {
      if (state.phase !== 'clue') return reject(state, 'WRONG_PHASE', 'Not the clue phase.');
      if (event.team !== state.turn) return reject(state, 'WRONG_TEAM', 'Not your team\'s turn.');
      const n = event.number;
      if (n !== 'unlimited' && !(Number.isInteger(n) && n >= 1 && n <= CLUE.maxNumber)) {
        return reject(state, 'BAD_NUMBER', `Pick 1-${CLUE.maxNumber} or unlimited.`);
      }
      let word: string | null = null;
      if (event.word !== null) {
        const check = checkClue(event.word, unrevealedTerms(state.cards));
        if (!check.ok) return reject(state, 'CLUE_REJECTED', check.message);
        word = check.clue;
      }
      const clue: ActiveClue = {
        team: event.team,
        word,
        number: n,
        guessesLeft: n === 'unlimited' ? null : n + 1,
        guesses: 0,
      };
      return {
        state: {
          ...state,
          phase: 'guess',
          phaseEndsAt: event.at + state.config.guessMs,
          clue,
          log: [...state.log, { kind: 'clue', team: event.team, word, number: n, at: event.at }],
        },
        effects: [sound('clue'), haptic('light')],
      };
    }

    case 'GUESS': {
      if (state.phase !== 'guess' || !state.clue) return reject(state, 'WRONG_PHASE', 'Not the guessing phase.');
      if (event.team !== state.turn) return reject(state, 'WRONG_TEAM', 'Not your team\'s turn.');
      const card = state.cards[event.cardIndex];
      if (!card) return reject(state, 'BAD_CARD', 'No such card.');
      if (card.revealed) return reject(state, 'CARD_ALREADY_REVEALED', 'Already revealed.');
      return revealCard(state, card, event.at);
    }

    case 'END_TURN': {
      if (state.phase !== 'guess' || !state.clue) return reject(state, 'WRONG_PHASE', 'Not the guessing phase.');
      if (event.team !== state.turn) return reject(state, 'WRONG_TEAM', 'Not your team\'s turn.');
      if (state.clue.guesses < 1) return reject(state, 'NEED_ONE_GUESS', 'Make at least one guess first.');
      return {
        state: passTurn({ ...state, log: [...state.log, { kind: 'endTurn', team: event.team, at: event.at }] }, event.at),
        effects: [sound('turn')],
      };
    }
  }
}

function revealCard(state: GameState, card: Card, at: number): GameResult {
  const team = state.turn;
  const clue = state.clue!;
  const cards = state.cards.map((c) => (c.index === card.index ? { ...c, revealed: true } : c));
  const remaining = { ...state.remaining };
  if (card.color === 'red' || card.color === 'blue') remaining[card.color] -= 1;
  const updatedClue: ActiveClue = {
    ...clue,
    guesses: clue.guesses + 1,
    guessesLeft: clue.guessesLeft === null ? null : clue.guessesLeft - 1,
  };
  const entry: LogEntry = { kind: 'guess', team, cardIndex: card.index, color: card.color, at };
  const base: GameState = { ...state, cards, remaining, clue: updatedClue, log: [...state.log, entry] };

  if (card.color === 'assassin') {
    return finish(base, otherTeam(team), 'assassin', at, [sound('assassin'), haptic('error')]);
  }
  if (card.color === 'red' || card.color === 'blue') {
    if (remaining[card.color] === 0) {
      return finish(base, card.color, 'allFound', at, [card.color === team ? sound('correct') : sound('wrong')]);
    }
  }
  if (card.color === team) {
    if (updatedClue.guessesLeft === 0) {
      return { state: passTurn(base, at), effects: [sound('correct'), haptic('light'), sound('turn')] };
    }
    return { state: base, effects: [sound('correct'), haptic('light')] };
  }
  const isEnemy = card.color !== 'neutral';
  return {
    state: passTurn(base, at),
    effects: [sound(isEnemy ? 'wrong' : 'neutral'), haptic(isEnemy ? 'warning' : 'light'), sound('turn')],
  };
}

function applyTimeout(state: GameState, at: number): GameResult {
  if (state.phaseEndsAt === null || at < state.phaseEndsAt) return { state, effects: [] };
  if (state.phase === 'clue') {
    return {
      state: passTurn({ ...state, log: [...state.log, { kind: 'timeout', team: state.turn, phase: 'clue', at }] }, at),
      effects: [notice('CLUE_TIMEOUT', `${cap(state.turn)} ran out of time and loses the turn.`), haptic('warning'), sound('turn')],
    };
  }
  if (state.phase === 'guess') {
    return {
      state: passTurn({ ...state, log: [...state.log, { kind: 'timeout', team: state.turn, phase: 'guess', at }] }, at),
      effects: [notice('GUESS_TIMEOUT', `${cap(state.turn)}'s guessing time is up.`), haptic('warning'), sound('turn')],
    };
  }
  return { state, effects: [] };
}

function passTurn(state: GameState, at: number): GameState {
  const base = { ...state, turn: otherTeam(state.turn), clue: null, turnNumber: state.turnNumber + 1 };
  return state.config.requireReady
    ? { ...base, phase: 'ready', phaseEndsAt: null }
    : { ...base, phase: 'clue', phaseEndsAt: at + state.config.clueMs };
}

function finish(state: GameState, winner: Team, reason: WinReason, _at: number, effects: GameEffect[], extra?: LogEntry): GameResult {
  return {
    state: {
      ...state,
      log: extra ? [...state.log, extra] : state.log,
      phase: 'over',
      phaseEndsAt: null,
      winner,
      winReason: reason,
      clue: state.clue,
    },
    effects: [...effects, sound('win'), haptic('success')],
  };
}

const reject = (state: GameState, code: NoticeCode, message: string): GameResult => ({
  state,
  effects: [notice(code, message), haptic('error')],
});
const cap = (t: Team) => t[0].toUpperCase() + t.slice(1);

/** Number of cards of each color still hidden. Handy for UI. */
export const hiddenCounts = (s: GameState) => ({ ...s.remaining, total: s.cards.filter((c) => !c.revealed).length });
export const boardSize = BOARD.size;
