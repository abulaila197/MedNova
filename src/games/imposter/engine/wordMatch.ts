import { levenshtein, lettersOnly } from './text';
import type { WordEntry } from './types';

/** Typos allowed in a redemption guess: 8+ letters -> 2, 5-7 letters -> 1, 4 or fewer -> exact. */
export const allowedTypos = (len: number): number => (len >= 8 ? 2 : len >= 5 ? 1 : 0);

const candidates = (e: WordEntry): string[] => [e.word, ...e.alts].map(lettersOnly).filter(Boolean);

/** Smallest distance to the word or any accepted alternative, only if within the typo allowance. */
function bestDistance(guess: string, e: WordEntry): number {
  let best = Infinity;
  for (const c of candidates(e)) {
    const d = levenshtein(guess, c);
    if (d <= allowedTypos(c.length) && d < best) best = d;
  }
  return best;
}

/**
 * Is `guessRaw` the target word? Typos and accepted alternatives count.
 * A guess that is as close to the OTHER word of the pair is rejected, so a typo can never
 * turn the imposter's own word into a correct answer.
 */
export function isCorrectGuess(guessRaw: string, target: WordEntry, other: WordEntry): boolean {
  const g = lettersOnly(guessRaw);
  if (!g) return false;
  const t = bestDistance(g, target);
  if (t === Infinity) return false;
  const o = bestDistance(g, other);
  return o === Infinity || t < o;
}
