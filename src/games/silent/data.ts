import { fullName } from '../shell/names';
import type { Word } from './core';
import wordsJson from './data/words.json';

/** The 300 diseases to draw or act (master list, NL1 names). */
export const WORDS = wordsJson as Word[];
export const wordById = new Map(WORDS.map((w) => [w.id, w]));
/** "Main name (other 1, other 2)", as shown on reveals and results. */
export const wordName = (w: Word) => fullName({ label: w.name, aliases: w.aliases });
/** Fields in the list, largest first, for the Solo field filter. */
export const FIELDS = [...WORDS.reduce((m, w) => m.set(w.field, (m.get(w.field) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).map(([f]) => f);

/** Words this phone performed lately, so the next match picks fresh ones. */
export const RECENT_KEY = 'silent:recent';
