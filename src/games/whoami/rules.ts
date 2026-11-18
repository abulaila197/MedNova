import type { ClueRules } from '../diagnostic/core';

/** Who am I? numbers (Yazan 2026-11-17). Clue 1 very vague … clue 5 the giveaway. A wrong guess shows the next clue; Reveal uses up a guess. */
export const WAI: ClueRules = {
  clueCount: 5,
  maxGuesses: 5,
  cluePoints: [100, 80, 60, 40, 20],
  speedBonusMax: 20,
  fullBonusUntilMs: 30_000,
  zeroBonusAtMs: 120_000,
  hintTokenCost: 1,
};
