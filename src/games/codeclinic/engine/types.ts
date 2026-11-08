export type Team = 'red' | 'blue';
export type CardColor = Team | 'neutral' | 'assassin';
export type TermStyle = 'clinical' | 'basic';
/** 'mixed' = about half clinical, half basic science. */
export type StyleChoice = TermStyle | 'mixed';
export type Rng = () => number;

export const TEAMS: readonly Team[] = ['red', 'blue'];
export const otherTeam = (t: Team): Team => (t === 'red' ? 'blue' : 'red');

/** One row of the term bank (SQLite table `cc_terms`). */
export interface Term {
  id: number;
  style: TermStyle;
  field: string;
  term: string;
}

/** A card on the board. `color` is secret until `revealed` (never send it to guessers early). */
export interface Card {
  index: number; // 0-24, row-major
  termId: number;
  term: string;
  color: CardColor;
  revealed: boolean;
}

export type SoundId = 'clue' | 'correct' | 'neutral' | 'wrong' | 'assassin' | 'turn' | 'win' | 'tick';
export type HapticId = 'light' | 'warning' | 'error' | 'success';

/** 1-9, or 'unlimited'. (Zero-clues are not supported.) */
export type ClueNumber = number | 'unlimited';

export type WinReason = 'allFound' | 'assassin' | 'forfeit';
export type PlayerRole = 'spymaster' | 'guesser';

export interface RecordPlayer {
  id: string;
  name: string;
  team: Team;
  role: PlayerRole;
}
