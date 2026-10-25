import { RULES } from './constants';
import type { ProfanityChecker } from './profanity';
import { lettersOnly, sameWord } from './text';
import type { WordEntry } from './types';

export type ClueErrorCode = 'clue/format' | 'clue/profanity' | 'clue/ownWord' | 'clue/duplicate';

export type ClueCheck = { ok: true; text: string } | { ok: false; code: ClueErrorCode };

export const CLUE_MESSAGES: Record<ClueErrorCode, string> = {
  'clue/format': 'Use letters only (no spaces, hyphens or numbers), up to 15 letters.',
  'clue/profanity': 'That word is not allowed.',
  'clue/ownWord': 'You cannot use your own word, its synonyms or its abbreviation.',
  'clue/duplicate': 'That word was already used this round.',
};

/**
 * Online clue rules (design doc section 4 and 5):
 * letters only, max 15, not profane, not your own word/synonym/abbreviation,
 * not a word already used this round (a final "s" is ignored, capitals are ignored).
 * Real-word and "two glued words" checks are intentionally NOT done.
 */
export function validateClue(
  raw: string,
  ctx: { own: WordEntry; prior: (string | null)[]; profanity: ProfanityChecker },
): ClueCheck {
  const text = raw.trim();
  if (!new RegExp(`^[A-Za-z]{1,${RULES.clueMaxLength}}$`).test(text)) return { ok: false, code: 'clue/format' };
  if (ctx.profanity.isProfane(text)) return { ok: false, code: 'clue/profanity' };
  const key = lettersOnly(text);
  if ([ctx.own.word, ...ctx.own.alts].some((w) => sameWord(w, key))) return { ok: false, code: 'clue/ownWord' };
  if (ctx.prior.some((p) => p !== null && sameWord(p, key))) return { ok: false, code: 'clue/duplicate' };
  return { ok: true, text };
}
