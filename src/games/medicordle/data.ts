import { inList, type KnowPick, type Style, type Word } from './core';

import wordsJson from './data/words.json';

export const WORDS = wordsJson as Word[];
export const wordById = new Map(WORDS.map((w) => [w.id, w]));
/** The words of one length style, of one knowledge kind ('mixed', or none, takes both). */
export const poolFor = (style: Style, know: KnowPick = 'mixed') => WORDS.filter((w) => w.style === style && (know === 'mixed' || w.know === know));
/** The knowledge row's pick from a play's settings; older plays have none and get both. */
export const knowOf = (settings: Record<string, unknown>): KnowPick => (settings.know === 'clinical' || settings.know === 'basic' ? settings.know : 'mixed');

// The accepted-guess list is about 2.4 MB, so it loads on the first guess, not at app start (NM24).
let packed: Record<string, string> | null = null;
export function isWord(word: string): boolean {
  packed ??= require('./data/guesses.json') as Record<string, string>;
  return inList(packed[String(word.length)], word);
}

/** The accepted guesses of one length, packed (sorted, fixed width): the rivals pick their real words from it (G4). */
export function packedOf(len: number): string | undefined {
  packed ??= require('./data/guesses.json') as Record<string, string>;
  return packed[String(len)];
}
