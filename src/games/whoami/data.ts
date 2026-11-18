// Who am I? bank: 320 puzzles, 40 in each of 8 basic science categories. Source: build/whoami-bank/*.txt (build.py
// writes data/puzzles.json). Pure: runs in node tests.
import type { DPCase, GuessEntry } from '../diagnostic/core';
import { buildIndex } from '../diagnostic/core';
import { type FieldMenu, inFields } from '../shell/fields';
import { fullName } from '../shell/names';
import puzzlesJson from './data/puzzles.json';

export type Puzzle = { id: string; cat: string; answer: string; type: string; aliases: string[]; clues: string[]; fact: string };

export const PUZZLES = puzzlesJson as Puzzle[];

/** The 8 categories in menu order (Yazan 2026-11-17). */
export const CATEGORIES = ['Anatomy', 'Physiology', 'Biochemistry', 'Pathology', 'Pharmacology', 'Microbiology', 'Histology', 'Embryology'] as const;

/** Guess list ids and Learn keys: the answer in lower case, words joined by dashes. */
export const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Every answer is on the guess list, so typing never tells you which names are puzzles today. */
export const GUESSES: GuessEntry[] = PUZZLES.map((p) => ({ id: slug(p.answer), label: p.answer, aliases: p.aliases, answer: true, canonical_id: `whoami:${slug(p.answer)}` }));
export const INDEX = buildIndex(GUESSES);
export const guessById = new Map(GUESSES.map((g) => [g.id, g]));
export const guessName = (id: string) => {
  const g = guessById.get(id);
  return g ? fullName(g) : id;
};

/** A puzzle in the clue screens' case shape: the category is its one field. */
export const CASES: DPCase[] = PUZZLES.map((p) => ({
  number: Number(p.id),
  fields: [p.cat],
  disease: p.answer,
  canonical_id: `whoami:${slug(p.answer)}`,
  answer_id: slug(p.answer),
  clues: p.clues,
  type: p.type,
  fact: p.fact,
}));
export const caseById = new Map(CASES.map((c) => [String(c.number), c]));
export const puzzleById = new Map(PUZZLES.map((p) => [p.id, p]));

/** The puzzles the ticked categories allow (null = all). */
export const poolOf = (ticked: string[] | null) => inFields(CASES, (c) => c.fields[0], ticked).map((c) => String(c.number));

/** The category ticks behind "All categories": one Basic science group. `min` = puzzles the whole game needs. */
export function categoryMenu(min: number): FieldMenu {
  const count = (cat: string) => PUZZLES.filter((p) => p.cat === cat).length;
  return {
    groups: [{ title: 'Basic science', items: CATEGORIES.map((c) => ({ key: c, label: c, count: count(c) })) }],
    total: (ticked) => poolOf(ticked).length,
    min,
    unit: 'questions',
  };
}

/** Rivals' tempting wrong answers: same category, same kind of thing first (another nerve, another enzyme). */
export function nearMisses(c: DPCase, pick: (n: number) => number, n: number) {
  if (!n) return [];
  const same = CASES.filter((x) => x.answer_id !== c.answer_id && x.fields[0] === c.fields[0]);
  const ranked = [...same.filter((x) => x.type === c.type), ...same.filter((x) => x.type !== c.type)];
  const pool = [...new Set(ranked.map((x) => x.answer_id))].slice(0, 12);
  const out: string[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(pick(pool.length), 1)[0]);
  return out;
}
