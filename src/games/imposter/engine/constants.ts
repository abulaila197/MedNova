/** All fixed numbers of the game in one place (design doc sections 3, 4, 6, 7). */
export const RULES = {
  minPlayers: 3,
  maxPlayers: 6,
  minRounds: 1,
  maxRounds: 5,

  // timers (milliseconds)
  clueMs: 30_000, // up to 30 s to type a clue (skipped when submitted early)
  pauseMs: 3_000, // pause after each reveal
  decisionMs: 10_000, // "Vote now / One more turn"
  voteMs: 60_000, // vote + discussion
  voteCountdownMs: 5_000, // countdown after everybody voted (votes can still change)
  redemptionMs: 20_000,
  offlineDiscussionMs: 60_000, // skippable
  wordRevealMs: 10_000, // online: the word is shown for a fixed 10 s, there is no Ready button
  resultMs: 5_000, // online: the round result continues after 5 s

  // turns
  obligatoryTurns: 2,
  maxExtraTurns: 1,

  // clues
  clueMaxLength: 15,
  profanityNotifyAfter: 3,

  // points
  points: {
    correctVoter: 2,
    imposterNotCaughtBase: 2,
    imposterPerWrongVoter: 1,
    redemptionSuccess: 1,
    othersWhenImposterDisconnects: 2,
  },
} as const;
