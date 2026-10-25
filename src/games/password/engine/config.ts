/** Medical Password - game constants. */
export const CONFIG = {
  PLAYERS: 4,
  TEAM_SIZE: 2,
  WORDS_OPTIONS: [5, 10] as const,
  ROUNDS_OPTIONS: [1, 2] as const,

  /** A round lasts at most 3 minutes (per team turn offline; for both teams at once online). */
  ROUND_MAX_MS: 3 * 60_000,
  TICK_MS: 1000,

  // Autocomplete
  MIN_AUTOCOMPLETE_CHARS: 3,

  // Clue rules
  MAX_CLUE_LENGTH: 40,
  ROOT_PREFIX: 5, // words sharing their first 5 letters are "the same root"
  ROOT_CONTAINS_MIN: 4, // ...or one contains the other (both at least 4 letters)

  // Online
  REJOIN_WINDOW_MS: 30_000,
  IDLE_REMOVE_MS: 60_000, // enforced by the server (value not decided; same as Case File)
  ACTIVITY_PING_MS: 10_000,

  // Online EXP (PLACEHOLDERS, not decided). The server awards it; 200 EXP = 1 token.
  EXP_WIN: 60,
  EXP_DRAW: 30,
  EXP_LOSS: 20,
  EXP_PER_TOKEN: 200,
} as const;
