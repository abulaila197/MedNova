import type { DPCase, Difficulty, GuessEntry } from './core';
import { buildIndex } from './core';

import casesJson from './data/cases.json';
import guessJson from './data/guess-list.json';

export const CASES = casesJson as DPCase[];
export const GUESSES = guessJson as GuessEntry[];
export const INDEX = buildIndex(GUESSES);

export const caseById = new Map(CASES.map((c) => [String(c.number), c]));
export const guessById = new Map(GUESSES.map((g) => [g.id, g]));

export const LEVELS: Difficulty[] = ['Easy', 'Medium', 'Hard', 'Extreme'];
export const levelCount = (d: Difficulty) => CASES.filter((c) => c.difficulty === d).length;
export const poolFor = (d: Difficulty) => CASES.filter((c) => c.difficulty === d).map((c) => String(c.number));
