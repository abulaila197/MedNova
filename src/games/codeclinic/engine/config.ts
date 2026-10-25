/** Every tunable number lives here. */

export const BOARD = {
  size: 25,
  columns: 5,
  firstTeamCards: 9,
  secondTeamCards: 8,
  neutralCards: 7,
  assassinCards: 1,
} as const;

export const TIMERS = {
  clueMs: 60_000,
  guessMs: 60_000,
  /** Last seconds shown in the urgent color. */
  urgentMs: 10_000,
} as const;

export const ROOM = {
  minPlayers: 4,
  maxPlayers: 6,
  minPerTeam: 2,
  maxPerTeam: 3,
} as const;

export const CLUE = {
  maxNumber: 9,
  minLength: 2,
  maxLength: 30,
} as const;

/** CC2 (Yazan 2026-10-25): online EXP only, no tokens. Winners 60, losers 20. Pass the phone earns none. */
export const REWARDS = {
  winXp: 60,
  loseXp: 20,
} as const;

export const SERVER_RULES = {
  /** A disconnected player has this long to rejoin before they count as left. */
  rejoinWindowMs: 60_000,
} as const;
