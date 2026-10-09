// The Silent Artist online guess matcher (SA7, SA8), copied as coded from games-src/code/the-silent-artist
// (src/game/guessMatching.ts). Only the types are local. guessCandidates at the end is new: the phone runs the
// matcher against every word and sends the server the ids it would be right or close for.
import type { Word } from './core';

type DiseaseWord = Pick<Word, 'id' | 'name' | 'aliases'>;
export type GuessResult = 'correct' | 'close' | 'wrong';

/**
 * Guess checking rules
 * --------------------
 * 1. Case, spaces, hyphens, apostrophes and accents are ignored.
 * 2. Any alias of the target counts ("Heart attack" = "Myocardial infarction").
 * 3. Small typos are accepted, BUT the tolerance is deliberately tiny because
 *    many diseases differ by 1-2 letters and mean opposite things:
 *      hypertension / hypotension, hyperthyroidism / hypothyroidism,
 *      hypoglycemia / hyperglycemia, Hepatitis A / B / C, Type 1 / Type 2 diabetes.
 *    - length < 6      -> exact only
 *      length 6-15     -> 1 edit
 *      length >= 16    -> 2 edits
 * 4. Digits (the "1" in "Type 1", the "19" in "COVID-19") and a trailing single
 *    letter (the "B" in "Hepatitis B") must match exactly, with or without
 *    spaces, so "Hepatitis C" can never be accepted as a typo of "Hepatitis B".
 * 5. If the guess is exactly another disease from the word bank, it is never
 *    correct. It is "close" when that disease is within 2 edits of the target.
 * 6. "close" = one edit beyond the tolerance, or a single meaningful word of a
 *    multi-word answer ("infarction" for "Myocardial infarction").
 * 7. A typo is never accepted when it is just as close (or closer) to a
 *    DIFFERENT disease. Example: "hyprtension" is one letter away from both
 *    Hypertension and Hypotension, so it is not accepted for either.
 */

export function canonical(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function tokens(text: string): string[] {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // An apostrophe joins ("Parkinson's" -> "parkinsons"); it must not leave a lone "s" behind,
    // because single letters are compared exactly (see strictlyMatches).
    .replace(/['\u2019\u2018`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/** Optimal string alignment distance (insert, delete, replace, swap neighbours). */
export function editDistance(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  const d: number[][] = [];
  for (let i = 0; i <= al; i++) {
    d.push(new Array<number>(bl + 1).fill(0));
    d[i][0] = i;
  }
  for (let j = 0; j <= bl; j++) d[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2][j - 2] + 1);
      }
      d[i][j] = v;
    }
  }
  return d[al][bl];
}

export function fuzzyTolerance(canonicalLength: number): number {
  if (canonicalLength < 6) return 0;
  if (canonicalLength < 16) return 1;
  return 2;
}

/** All digits of a text, in order ("Type 1 diabetes" -> "1", "COVID-19" -> "19"). */
function digitsOf(text: string): string {
  return (text.match(/\d/g) ?? []).join('');
}

/** The final single-letter token of a name ("Hepatitis B" -> "b"), or null. */
function trailingSingleLetter(raw: string): string | null {
  const t = tokens(raw);
  const last = t.length ? t[t.length - 1] : '';
  return last.length === 1 && /[a-z]/.test(last) ? last : null;
}

/**
 * Typo tolerance must never change a digit or the trailing letter of a name.
 * Works whether or not the player typed the spaces: "covd19" keeps its 19,
 * "hepatitisc" does not pass for Hepatitis B.
 */
function strictlyMatches(guessRaw: string, guessCanonical: string, formRaw: string): boolean {
  if (digitsOf(guessRaw) !== digitsOf(formRaw)) return false;
  const letter = trailingSingleLetter(formRaw);
  if (letter !== null && !guessCanonical.endsWith(letter)) return false;
  return true;
}

export interface AnswerIndex {
  /** canonical form -> ids of the words that use it as name or alias */
  byCanonical: Map<string, Set<string>>;
  /** every canonical answer with the id of its disease (used for the "just as close" check) */
  forms: { canon: string; id: string }[];
}

export function buildAnswerIndex(words: readonly DiseaseWord[]): AnswerIndex {
  const byCanonical = new Map<string, Set<string>>();
  const forms: { canon: string; id: string }[] = [];
  for (const w of words) {
    for (const form of [w.name, ...w.aliases]) {
      const c = canonical(form);
      if (!c) continue;
      forms.push({ canon: c, id: w.id });
      let set = byCanonical.get(c);
      if (!set) {
        set = new Set<string>();
        byCanonical.set(c, set);
      }
      set.add(w.id);
    }
  }
  return { byCanonical, forms };
}

/** True when the guess is within `distance` edits of a form of a DIFFERENT disease. */
function isJustAsCloseToAnother(
  guessCanonical: string,
  distance: number,
  targetId: string,
  index?: AnswerIndex,
): boolean {
  if (!index) return false;
  for (const other of index.forms) {
    if (other.id === targetId) continue;
    if (Math.abs(other.canon.length - guessCanonical.length) > distance) continue;
    if (editDistance(guessCanonical, other.canon) <= distance) return true;
  }
  return false;
}

export function evaluateGuess(
  guess: string,
  target: DiseaseWord,
  index?: AnswerIndex,
): GuessResult {
  const g = canonical(guess);
  if (g.length < 2) return 'wrong';

  const forms = [target.name, ...target.aliases].map((f) => ({
    raw: f,
    canon: canonical(f),
  }));

  // 1) exact match on the name or any alias
  if (forms.some((f) => f.canon === g)) return 'correct';

  // 2) exact match on a DIFFERENT disease: never correct
  const owners = index?.byCanonical.get(g);
  if (owners && !owners.has(target.id)) {
    const near = forms.some((f) => editDistance(g, f.canon) <= 2);
    return near ? 'close' : 'wrong';
  }

  // 3) typo tolerance
  for (const f of forms) {
    const tol = fuzzyTolerance(f.canon.length);
    if (tol === 0) continue;
    if (!strictlyMatches(guess, g, f.raw)) continue;
    const d = editDistance(g, f.canon);
    if (d > tol) continue;
    if (isJustAsCloseToAnother(g, d, target.id, index)) continue;
    return 'correct';
  }

  // 4) close guesses
  for (const f of forms) {
    const tol = fuzzyTolerance(f.canon.length);
    const closeLimit = Math.min(3, tol + 1);
    if (editDistance(g, f.canon) <= closeLimit) return 'close';
    const parts = tokens(f.raw);
    if (parts.length >= 2 && parts.some((p) => p.length >= 4 && canonical(p) === g)) {
      return 'close';
    }
  }

  return 'wrong';
}

/** Every word this guess would be right for, and every word it would be close for (online guessing). */
export function guessCandidates(guess: string, words: readonly DiseaseWord[], index: AnswerIndex = buildAnswerIndex(words)) {
  const correct: string[] = [];
  const close: string[] = [];
  for (const w of words) {
    const r = evaluateGuess(guess, w, index);
    if (r === 'correct') correct.push(w.id);
    else if (r === 'close') close.push(w.id);
  }
  return { correct, close };
}
