import { CONFIG } from './config';
import type { Term } from './types';

/** Lower case, accents removed. */
export const strip = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Words of a text: split on anything that is not a letter or digit. "anti-inflammatory" -> anti, inflammatory */
export const tokens = (s: string): string[] =>
  strip(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

export type ClueRejection = 'EMPTY' | 'NOT_ONE_WORD' | 'INVALID_CHARS' | 'TOO_LONG' | 'TERM_WORD' | 'SAME_ROOT' | 'FORBIDDEN' | 'DUPLICATE';

export type ClueCheck = { ok: true; clue: string } | { ok: false; reason: ClueRejection };

/**
 * Checks one clue for a secret term (used online, where clues are typed). Rules:
 *  1. exactly one word; hyphenated words and acronyms count as one word;
 *  2. not the term, not any word of it, and not containing one of its words;
 *  3. not the same root: same first 5 letters, or one contains the other (4+ letters);
 *  4. not on the term's hand-written forbidden list;
 *  5. not a repeat of a clue already given for this word.
 * Accents and capitals are ignored. Rejected clues are not counted.
 */
export function validateClue(term: Term, raw: string, previous: readonly string[] = []): ClueCheck {
  const text = raw.trim();
  if (text === '') return { ok: false, reason: 'EMPTY' };
  if (/\s/.test(text)) return { ok: false, reason: 'NOT_ONE_WORD' };
  if (text.length > CONFIG.MAX_CLUE_LENGTH) return { ok: false, reason: 'TOO_LONG' };
  if (!/^[\p{L}\p{N}'\u2019-]+$/u.test(text)) return { ok: false, reason: 'INVALID_CHARS' };

  const clueTokens = tokens(text);
  if (clueTokens.length === 0) return { ok: false, reason: 'INVALID_CHARS' };
  const termTokens = tokens(term.name);

  // 2. the term itself, one of its words, or containing one of its words
  const joined = termTokens.join('');
  if (clueTokens.join('') === joined || clueTokens.some((c) => termTokens.includes(c)) || clueTokens.some((c) => termTokens.some((t) => t.length >= CONFIG.ROOT_CONTAINS_MIN && c.includes(t)))) {
    return { ok: false, reason: 'TERM_WORD' };
  }

  // 3. same root
  for (const c of clueTokens) {
    for (const t of termTokens) {
      const shortest = Math.min(c.length, t.length);
      if (shortest >= CONFIG.ROOT_PREFIX && c.slice(0, CONFIG.ROOT_PREFIX) === t.slice(0, CONFIG.ROOT_PREFIX)) {
        return { ok: false, reason: 'SAME_ROOT' };
      }
      if (shortest >= CONFIG.ROOT_CONTAINS_MIN && (c.includes(t) || t.includes(c))) {
        return { ok: false, reason: 'SAME_ROOT' };
      }
    }
  }

  // 4. hand-written forbidden list (single words; multi-word entries are split)
  const forbidden = new Set(term.forbidden.flatMap(tokens));
  if (clueTokens.some((c) => forbidden.has(c))) return { ok: false, reason: 'FORBIDDEN' };

  // 5. duplicate
  const key = clueTokens.join('');
  if (previous.some((p) => tokens(p).join('') === key)) return { ok: false, reason: 'DUPLICATE' };

  return { ok: true, clue: text };
}
