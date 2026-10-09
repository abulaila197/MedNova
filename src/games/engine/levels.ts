// Player levels (LV1-LV2): EXP raises the level and each level up gives 1 hint token.
// Capped climb: level 2 at 60 EXP, each next level needs 20 more, up to 300 per level.

export const LEVEL_STEP_START = 60;
export const LEVEL_STEP_GROW = 20;
export const LEVEL_STEP_CAP = 300;

/** EXP needed to go from `level - 1` up to `level` (level >= 2). */
export const stepTo = (level: number) => Math.min(LEVEL_STEP_CAP, LEVEL_STEP_START + LEVEL_STEP_GROW * (level - 2));

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
