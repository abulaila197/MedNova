export type Subtype = 'clinical' | 'basic';
export type SubtypeChoice = Subtype | 'mixed';
export type Mode = 'online' | 'offline';
export type Side = 'a' | 'b';
export type Choice = 'vote' | 'extra';

/** One word of a pair. `alts` are accepted synonyms/abbreviations (may contain spaces). */
export interface WordEntry {
  word: string;
  alts: string[];
}
export interface WordPair {
  id: string;
  subtype: Subtype;
  /** General category shown to everybody: body system (clinical) or subject (basic science). */
  category: string;
  a: WordEntry;
  b: WordEntry;
  /** Clinical pairs only: what the two words are. Informational, the game ignores it. */
  kind?: 'disease' | 'symptom' | 'investigation' | 'treatment';
  /** Basic science pairs only: the sub-topic the pair comes from. Informational, the game ignores it. */
  topic?: string;
}
export interface WordBank {
  pairs: WordPair[];
}

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  score: number;
  /** Tiebreak credits: rounds in which this player's first vote for the true imposter was the earliest. */
  credits: number;
  profanityAttempts: number;
}

export interface MatchConfig {
  subtype: SubtypeChoice;
  rounds: number;
}

/** text === null means "no clue" (shown as "—"). */
export interface ClueRecord {
  turn: number;
  playerId: string;
  text: string | null;
}
export interface VoteLogEntry {
  voter: string;
  target: string;
  at: number;
}

export interface Round {
  index: number;
  pair: WordPair;
  subtype: Subtype;
  imposterId: string;
  imposterSide: Side;
  participants: string[]; // seating order
  order: string[]; // clue order (clockwise from a random start)
  acks: string[];
  clues: ClueRecord[];
  turn: number;
  extraUsed: boolean;
  decisions: Record<string, Choice>;
  votes: Record<string, string>;
  voteLog: VoteLogEntry[];
  voteRound: 1 | 2;
  candidates: string[] | null;
  /** Frozen when the vote is resolved: counted votes and the players whose votes counted. */
  final: { votes: Record<string, string>; voters: string[] } | null;
}

export interface RoundSummary {
  roundIndex: number;
  category: string;
  pairId: string;
  words: { a: string; b: string };
  imposterId: string;
  imposterWord: string;
  majorityWord: string;
  outcome: 'caught' | 'not-caught' | 'imposter-disconnected';
  redemptionCorrect: boolean | null;
  votes: Record<string, string>;
  deltas: Record<string, number>;
  creditWinnerId: string | null;
}

export type Phase =
  | { kind: 'lobby' }
  | { kind: 'wordReveal'; deadline: number | null }
  | { kind: 'clue'; turn: number; slot: number; stage: 'typing' | 'pause'; deadline: number; reveal: ClueRecord | null }
  | { kind: 'offlineTurn'; turn: number }
  | { kind: 'decision'; deadline: number | null }
  | { kind: 'offlineDiscussion'; deadline: number }
  | { kind: 'vote'; deadline: number | null; allVotedAt: number | null }
  | { kind: 'redemption'; deadline: number; confirmerId: string | null; guessed: boolean }
  | { kind: 'roundResult'; deadline: number | null; summary: RoundSummary }
  | { kind: 'matchEnd'; winners: string[] };

export interface GameState {
  version: 1;
  roomId: string;
  mode: Mode;
  hostId: string;
  players: Player[]; // seating order = clockwise
  config: MatchConfig | null;
  roundIndex: number;
  usedPairIds: string[];
  round: Round | null;
  phase: Phase;
  history: RoundSummary[];
  winners: string[] | null;
}

export type GameAction =
  | { type: 'JOIN'; playerId: string; name: string }
  | { type: 'START_MATCH'; playerId: string; config: MatchConfig }
  | { type: 'ACK_WORD'; playerId: string }
  | { type: 'SUBMIT_CLUE'; playerId: string; text: string }
  | { type: 'NEXT_TURN'; playerId: string } // offline only
  | { type: 'DECIDE'; playerId: string; choice: Choice }
  | { type: 'SKIP_DISCUSSION'; playerId: string } // offline only
  | { type: 'CAST_VOTE'; playerId: string; target: string }
  | { type: 'SUBMIT_GUESS'; playerId: string; text: string } // online only
  | { type: 'CONFIRM_GUESS'; playerId: string; correct: boolean } // offline only
  | { type: 'NEXT_ROUND'; playerId: string }
  | { type: 'PLAYER_DISCONNECTED'; playerId: string }
  | { type: 'PLAYER_RECONNECTED'; playerId: string }
  | { type: 'TICK' };

export type GameEvent =
  | { type: 'profanity-threshold'; playerId: string; notifyId: string }
  | { type: 'host-changed'; hostId: string }
  | { type: 'round-ended'; summary: RoundSummary }
  | { type: 'match-ended'; winners: string[]; reason: 'completed' | 'too-few-players' | 'bank-exhausted' };

export interface GameError {
  code: string;
  message: string;
}

export interface ActionResult {
  state: GameState;
  events: GameEvent[];
  error: GameError | null;
}
