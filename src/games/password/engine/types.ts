/** Pure type definitions for Medical Password. */

export type TeamId = 'A' | 'B';
export type Role = 'giver' | 'guesser';
export type TermId = string;
/** Random source in [0, 1). Injected so logic stays deterministic in tests. */
export type Rng = () => number;

export type Bank = 'clinical' | 'basic';
export type BankChoice = Bank | 'mixed';

/** Clinical: disease, drug, procedure, sign. Basic science: anatomy, physiology, microbiology, biochemistry, pathology, pharmacology. */
export interface Term {
  id: TermId;
  /** May be several words, e.g. "Myocardial infarction". Clues for it are always one word. */
  name: string;
  bank: Bank;
  category: string;
  /** Hand-written forbidden clue words for this term (single words). */
  forbidden: string[];
}

export interface Settings {
  bank: BankChoice;
  wordsPerTeam: 5 | 10;
  rounds: 1 | 2;
}

export interface TeamRoundResult {
  teamId: TeamId;
  wordsCompleted: number;
  /** All clues given, including on skipped or unfinished words. */
  clues: number;
  /** Capped at 3:00 when time ran out. */
  timeMs: number;
}

// ---------------------------------------------------------------------------
// Effects (requested by machines, executed by stores)
// ---------------------------------------------------------------------------

export type ClientMessage =
  | { t: 'CLUE'; text: string }
  | { t: 'GUESS'; termId: TermId }
  | { t: 'SKIP' }
  | { t: 'ACTIVITY' }
  | { t: 'QUIT' }
  | { t: 'REMATCH_ACCEPT' }
  | { t: 'LOBBY'; intent: unknown };

export type Effect<E = unknown> =
  | { type: 'HAPTIC'; kind: 'tap' | 'correct' | 'wrong' | 'buzzer' }
  | { type: 'SOUND'; kind: 'tap' | 'ding' | 'buzzer' | 'tick' }
  /** Repeats `event` every `ms` until cancelled (the clock display and the 3-minute cap). */
  | { type: 'START_TICKER'; id: string; ms: number; event: E }
  | { type: 'CANCEL_TICKER'; id: string }
  | { type: 'START_TIMER'; id: string; ms: number; event: E }
  | { type: 'CANCEL_TIMER'; id: string }
  | { type: 'SEND'; message: ClientMessage }
  | { type: 'NAVIGATE'; to: 'menu' };

export interface Step<S, E = unknown> {
  state: S;
  effects: Effect<E>[];
}
