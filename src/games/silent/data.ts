import { fullName } from '../shell/names';
import type { Word } from './core';
import basicJson from './data/words-basic.json';
import wordsJson from './data/words.json';

/**
 * The words to draw or act (master list, NL1 names): the 300 diseases (w ids), then the 200 basic science
 * words (b ids). The order matters: online turns name a word by its place here (sa_words.n).
 */
export const WORDS = [...(wordsJson as Word[]), ...(basicJson as Word[])];

/** QS1: Mixed (default), Clinical or Basic science, for Pass the phone and Online rooms. */
export type Mix = 'mixed' | 'clinical' | 'basic';
export const MIXES: { value: Mix; label: string }[] = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'clinical', label: 'Clinical' },
  { value: 'basic', label: 'Basic science' },
];
export const isBasic = (w: Word) => w.id.startsWith('b');
export const wordsFor = (mix: unknown): Word[] => (mix === 'clinical' ? WORDS.filter((w) => !isBasic(w)) : mix === 'basic' ? WORDS.filter(isBasic) : WORDS);
export const wordById = new Map(WORDS.map((w) => [w.id, w]));
/** "Main name (other 1, other 2)", as shown on reveals and results. */
export const wordName = (w: Word) => fullName({ label: w.name, aliases: w.aliases });

/** Words this phone performed lately, so the next match picks fresh ones. */
export const RECENT_KEY = 'silent:recent';

const fieldsOf = (ws: readonly Word[]) => [...ws.reduce((m, w) => m.set(w.field, (m.get(w.field) ?? 0) + 1), new Map<string, number>())];
/** Fields for the Solo field filter: the clinical ones largest first, then the 6 basic sciences in list order. */
export const FIELDS = [...fieldsOf(WORDS.filter((w) => !isBasic(w))).sort((a, b) => b[1] - a[1]), ...fieldsOf(WORDS.filter(isBasic))].map(([f]) => f);
