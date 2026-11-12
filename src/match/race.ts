// The shape of a race match (Riddler, Medicordle, Streak, Parade, Crossword, Case Files). Online matches came from
// the server; Vs bots builds the same shape on the phone (src/bots), so the race screens stay the same.

/** One player in a race match (Riddler, Medicordle, Streak Master online). */
export type RacePlayer = {
  user_id: string;
  name: string;
  character: string;
  team: number | null;
  score: number;
  solve_ms: number;
  dropped: boolean;
  rank: number | null;
  streak: number;
  best_streak: number;
  correct: number;
  /** This item: finished it (solved, out of tries, or answered). */
  done: boolean;
  solved: boolean;
  item_rank: number | null;
  item_points: number | null;
  tries: number;
  /** Medicordle: most green tiles in one of their rows (NM11). */
  greens: number | null;
  /** Streak Master: their pick, sent only once the question has ended. */
  pick?: number | null;
  /** Crossword: hearts left and whether the one revive is spent. */
  hearts?: number;
  revived?: boolean;
  /** Case Files: the stage they have reached (CF9). */
  stage?: string | null;
  /** Case Files (#11): their answers, sent only once the case has closed: first list, narrowed list, diagnosis, last call. */
  cf?: { first: string[] | null; dd: string[] | null; prov: string | null; redeem: string | null } | null;
  /** The Silent Artist: drawing this turn. */
  drawer?: boolean;
};
export type RaceMine = {
  locked_until: number | null;
  wrong: string[];
  guesses: string[];
  pick: number | null;
  done: boolean;
  solved_ms: number | null;
  rank: number | null;
  points: number;
};
export type RaceItemResult = { index: number; item: number; solved_ms: number | null; rank: number | null; points: number; wrong: string[]; guesses: string[]; pick: number | null; drawer?: boolean; skipped?: boolean };
export type RaceState = {
  now: number;
  room_id: string;
  game: string;
  /** 'pick' is The Silent Artist's 10 s choice before each drawing. */
  phase: 'countdown' | 'pick' | 'case' | 'reveal' | 'done';
  phase_started_at: number;
  phase_ends_at: number;
  index: number;
  total: number;
  /** The bank number of the current item (1-based), null in the countdown. */
  item: number | null;
  /** Shown only at reveal and done: the riddle id, the word, or the right choice index. */
  answer: string | null;
  settings: Record<string, unknown>;
  players: RacePlayer[];
  me: RaceMine | null;
  my_items: RaceItemResult[] | null;
  /** Crossword: every claimed word in claim order, and my wrong answers per word. */
  claims?: { word_id: string; user_id: string; at_ms: number; auto: boolean }[] | null;
  tried?: Record<string, string[]> | null;
  /** The Silent Artist: this turn's drawer, the drawer's options, the hints the room may see, the board version. */
  sa?: {
    drawer: string;
    options: number[] | null;
    words: number | null;
    field: string | null;
    mask: string | null;
    stage: number;
    field_at: number | null;
    version: number;
    reports: number;
    reported: boolean;
    /** The guesses box (P20): the latest 4 wrong guesses of this turn, oldest first (near misses never show). */
    guesses?: { u: string; g: string; i: number }[] | null;
  } | null;
};
