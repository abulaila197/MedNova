// Shared types every game uses. The record shape follows build/play-record-draft.md (v3).

export type GameKey =
  | 'the-diagnostic-pursuit'
  | 'the-wheels-of-chaos'
  | 'nova-crossword'
  | 'nova-medicordle'
  | 'the-silent-artist'
  | 'the-riddler'
  | 'the-streak-master'
  | 'case-files-unsolved'
  | 'the-conqueror'
  | 'trust-me-not';

export type Mode = 'solo' | 'offline' | 'online';

export type PlayStatus = 'in_progress' | 'finished';

export type Outcome = 'right' | 'wrong' | 'skipped' | 'timed_out';

/** `team` is the team id when the host turned teams on (TM1-TM6). */
export type Seat = { seat: number; name: string; color?: string; character?: string; removed?: boolean; team?: number };

export type Standing = { seat: number; name: string; score: number; timeMs: number; rank: number };

/** One row per play. */
export type Play = {
  id: string;
  userId: string | null; // null = guest; uploaded on first sign-in (rule 19)
  game: GameKey;
  mode: Mode;
  submode?: string;
  settings: Record<string, unknown>; // locked once the game starts (rule 9)
  startedAt: number;
  endedAt: number | null;
  status: PlayStatus;
  score: number;
  seats: Seat[];
  standings: Standing[];
  pauses: number; // app went to the background (rule 4)
  expEarned: number;
  /** The level reached when this play's EXP caused a level up (LV1); shown on results. */
  levelUp?: { level: number; tokens: number };
  /** Game-owned snapshot so a bookmarked play can resume at the exact case and clock (rules 7, 10). */
  resume: unknown;
  synced: boolean;
};

/** One row per case or question. */
export type PlayItem = {
  id: string;
  playId: string;
  seat: number;
  itemId: string; // the game's own case id
  answerKey: string | null; // canonical disease id (dossiers/name-map.json)
  outcome: Outcome;
  answersGiven: string[];
  timeMs: number;
  hintsUsed: number;
  revealsUsed: number;
  points: number;
  feedsLearn: boolean; // decided per game mode (rule 8)
  gameData: Record<string, unknown>;
  at: number;
};
