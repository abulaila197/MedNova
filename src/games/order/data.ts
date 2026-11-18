// Put it in order bank: 320 questions, 40 in each of 8 basic science categories. Source: build/order-bank/*.txt
// (build.py writes data/questions.json). Pure: runs in node tests.
import { type FieldMenu, inFields } from '../shell/fields';
import type { Question } from './core';
import questionsJson from './data/questions.json';

export const QUESTIONS = questionsJson as Question[];
export const questionById: ReadonlyMap<string, Question> = new Map(QUESTIONS.map((q) => [q.id, q]));

/** The 8 categories in menu order (Yazan 2026-11-17, as Who am I?). */
export const CATEGORIES = ['Anatomy', 'Physiology', 'Biochemistry', 'Pathology', 'Pharmacology', 'Microbiology', 'Histology', 'Embryology'] as const;

/** The questions the ticked categories allow (null = all). */
export const poolOf = (ticked: string[] | null) => inFields(QUESTIONS, (q) => q.cat, ticked).map((q) => q.id);

/** The category ticks behind "All": one Basic science group. `min` = questions the whole game needs. */
export function categoryMenu(min: number): FieldMenu {
  const count = (cat: string) => QUESTIONS.filter((q) => q.cat === cat).length;
  return {
    groups: [{ title: 'Basic science', items: CATEGORIES.map((c) => ({ key: c, label: c, count: count(c) })) }],
    total: (ticked) => poolOf(ticked).length,
    min,
    unit: 'questions',
  };
}
