// Player levels (LV1, LV2, LV4, LV5): EXP raises the level; each level up gives 1 token and every 5th level 3 more.
// Climb: level 2 at 60 EXP, each next level needs 20 more up to level 10 (1,260 in total), then 6% more each level.

export const LEVEL_STEP_START = 60;
export const LEVEL_STEP_GROW = 20;
export const STEEP_FROM = 10;
export const STEEP_GROWTH = 1.06;
export const TOKENS_PER_LEVEL = 1;
export const FIFTH_LEVEL_PRIZE = 3;

const linearStep = (level: number) => LEVEL_STEP_START + LEVEL_STEP_GROW * (level - 2);

/** EXP needed to go from `level - 1` up to `level` (level >= 2). */
export const stepTo = (level: number) =>
  level <= STEEP_FROM ? linearStep(level) : Math.round(linearStep(STEEP_FROM) * STEEP_GROWTH ** (level - STEEP_FROM));

/** Tokens the levels have paid in total by `level`: 1 per level up, plus the 5th-level prizes. */
export const levelTokens = (level: number) => TOKENS_PER_LEVEL * (level - 1) + FIFTH_LEVEL_PRIZE * Math.floor(level / 5);

/** Level for a total EXP, plus how far into the next level it is. */
export function levelOf(totalExp: number) {
  let level = 1;
  let left = Math.max(0, Math.floor(totalExp));
  while (left >= stepTo(level + 1)) {
    left -= stepTo(level + 1);
    level++;
  }
  return { level, into: left, need: stepTo(level + 1) };
}

/** The results line for a play that levelled the player up (LV1, step 3), e.g. "Level 7 · +1 token". */
export function levelUpLine(up: { level: number; tokens: number } | undefined) {
  if (!up) return null;
  return `Level ${up.level} · +${up.tokens} token${up.tokens === 1 ? '' : 's'}`;
}
