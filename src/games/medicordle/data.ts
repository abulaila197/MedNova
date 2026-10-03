import { inList, type Style, type Word } from './core';

import wordsJson from './data/words.json';

export const WORDS = wordsJson as Word[];
export const wordById = new Map(WORDS.map((w) => [w.id, w]));
export const poolFor = (style: Style) => WORDS.filter((w) => w.style === style);

// The accepted-guess list is about 2.4 MB, so it loads on the first guess, not at app start (NM24).
let packed: Record<string, string> | null = null;
export function isWord(word: string): boolean {
  packed ??= require('./data/guesses.json') as Record<string, string>;
  return inList(packed[String(word.length)], word);
}
