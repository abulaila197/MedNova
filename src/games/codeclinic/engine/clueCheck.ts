import { CLUE } from './config';

export type ClueProblem =
  | 'EMPTY'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'MULTIPLE_WORDS'
  | 'INVALID_CHARS'
  | 'BOARD_WORD'
  | 'CONTAINS_BOARD_WORD'
  | 'INSIDE_BOARD_WORD';

export type ClueCheck =
  | { ok: true; clue: string }
  | { ok: false; problem: ClueProblem; message: string; conflictsWith?: string };

/** Lowercase, strip accents. Used for every comparison. */
export function normalizeTerm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Validates a typed clue against the cards that are STILL UNREVEALED.
 *  - single word only: no spaces, no hyphens
 *  - letters and digits only
 *  - not equal to a board word, not containing one, not inside one
 *    ("cardio" is rejected next to "cardiomyopathy"; "heartburn" next to "heart")
 * Revealed cards are ignored on purpose.
 */
export function checkClue(raw: string, unrevealedTerms: readonly string[]): ClueCheck {
  const clue = raw.trim();
  if (clue.length === 0) return fail('EMPTY', 'Type a one-word clue.');
  if (/[\s‐-―-]/.test(clue)) return fail('MULTIPLE_WORDS', 'One word only: no spaces or hyphens.');
  if (!/^[\p{L}\p{N}]+$/u.test(clue)) return fail('INVALID_CHARS', 'Letters and numbers only.');
  if (clue.length < CLUE.minLength) return fail('TOO_SHORT', `At least ${CLUE.minLength} letters.`);
  if (clue.length > CLUE.maxLength) return fail('TOO_LONG', `At most ${CLUE.maxLength} letters.`);

  const c = normalizeTerm(clue);
  for (const term of unrevealedTerms) {
    const t = normalizeTerm(term);
    if (t === c) return fail('BOARD_WORD', `"${term}" is on the board.`, term);
    if (c.includes(t)) return fail('CONTAINS_BOARD_WORD', `Contains the board word "${term}".`, term);
    if (t.includes(c)) return fail('INSIDE_BOARD_WORD', `Is part of the board word "${term}".`, term);
  }
  return { ok: true, clue };
}

function fail(problem: ClueProblem, message: string, conflictsWith?: string): ClueCheck {
  return conflictsWith === undefined ? { ok: false, problem, message } : { ok: false, problem, message, conflictsWith };
}
