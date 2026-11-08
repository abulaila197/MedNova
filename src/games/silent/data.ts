import { fullName } from '../shell/names';
import type { Word } from './core';
import basicJson from './data/words-basic.json';
import moreJson from './data/words-more.json';
import newJson from './data/words-new.json';
import wordsJson from './data/words.json';

/**
 * The words to draw or act (master list, NL1 names): the 300 diseases (w ids), then the 200 basic science
 * words (b ids), then the 201 added 2026-11-01 (#38/#45: t ids are medical tools, counted as clinical; more w and b ids),
 * then 300 more (Yazan 2026-11-01: 50 tools t041-t090, 130 clinical w401-w530, 120 basic b262-b381).
 * The order matters: online turns name a word by its place here (sa_words.n), so new words only ever go at the end.
 */
export const WORDS = [...(wordsJson as Word[]), ...(basicJson as Word[]), ...(newJson as Word[]), ...(moreJson as Word[])];
/** The words a game can pick: all 1,000 (publish task 1, 2026-11-02: the retired "Medicine cup" was deleted and the
 *  places after it moved down by one, here and in sa_words). */
export const PICKABLE = WORDS;

/** QS1: Mixed (default), Clinical or Basic science, for Pass the phone and Online rooms. */
export type Mix = 'mixed' | 'clinical' | 'basic';
export const MIXES: { value: Mix; label: string }[] = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'clinical', label: 'Clinical' },
  { value: 'basic', label: 'Basic science' },
];
export const isBasic = (w: Word) => w.id.startsWith('b');
export const wordsFor = (mix: unknown): Word[] => (mix === 'clinical' ? PICKABLE.filter((w) => !isBasic(w)) : mix === 'basic' ? PICKABLE.filter(isBasic) : PICKABLE);
export const wordById = new Map(WORDS.map((w) => [w.id, w]));
/** "Main name (other 1, other 2)", as shown on reveals and results. */
export const wordName = (w: Word) => fullName({ label: w.name, aliases: w.aliases });

/** Words this phone performed lately, so the next match picks fresh ones. */
export const RECENT_KEY = 'silent:recent';

const fieldsOf = (ws: readonly Word[]) => [...ws.reduce((m, w) => m.set(w.field, (m.get(w.field) ?? 0) + 1), new Map<string, number>())];
/** Fields for the Solo field filter: the clinical ones largest first, then the 6 basic sciences in list order. */
export const FIELDS = [...fieldsOf(PICKABLE.filter((w) => !isBasic(w))).sort((a, b) => b[1] - a[1]), ...fieldsOf(PICKABLE.filter(isBasic))].map(([f]) => f);
