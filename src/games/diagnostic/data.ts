import { type FieldMenu, groupsOf, inFields } from '../shell/fields';
import { fullName } from '../shell/names';
import type { DPCase, Difficulty, GuessEntry } from './core';
import { buildIndex } from './core';

import casesJson from './data/cases.json';
import guessJson from './data/guess-list.json';
import { tr } from '@/i18n';

export const CASES = casesJson as DPCase[];
export const GUESSES = guessJson as GuessEntry[];
export const INDEX = buildIndex(GUESSES);

export const caseById = new Map(CASES.map((c) => [String(c.number), c]));
export const guessById = new Map(GUESSES.map((g) => [g.id, g]));
/** A guess as shown everywhere: "Main name (other 1, other 2)" (NL1). */
export const guessName = (id: string) => {
  const g = guessById.get(id);
  return g ? fullName(g) : id;
};

export const LEVELS: Difficulty[] = ['Easy', 'Medium', 'Hard', 'Extreme'];
export const levelCount = (d: Difficulty) => CASES.filter((c) => c.difficulty === d).length;

/** Field ticks (Yazan 2026-11-11): the cases' 38 labels merged into 19 fields. */
const MERGE: Record<string, string> = {
  'Tropical Medicine': 'Infectious Diseases',
  Neurosurgery: 'Neurology',
  Gastroenterology: 'Gastroenterology & Hepatology',
  Oncology: 'Hematology & Oncology',
  Hematology: 'Hematology & Oncology',
  'Critical Care': 'Pulmonology',
  Endocrinology: 'Endocrinology & Metabolism',
  Metabolism: 'Endocrinology & Metabolism',
  Metabolic: 'Endocrinology & Metabolism',
  Nutrition: 'Endocrinology & Metabolism',
  Surgery: 'Surgery & Trauma',
  'Vascular Surgery': 'Surgery & Trauma',
  Vascular: 'Surgery & Trauma',
  Rheumatology: 'Rheumatology & Immunology',
  Immunology: 'Rheumatology & Immunology',
  Allergy: 'Rheumatology & Immunology',
  Nephrology: 'Nephrology & Urology',
  Urology: 'Nephrology & Urology',
  Orthopedics: 'Orthopedics & Sports Medicine',
  Otolaryngology: 'ENT',
  'Otolaryngology (ENT)': 'ENT',
};
export const fieldsOfCase = (c: DPCase) => [...new Set((c.fields ?? []).map((f) => MERGE[f] ?? f))];
const ofLevel = (d: Difficulty) => CASES.filter((c) => c.difficulty === d);
/** A level's cases; with field ticks, only cases in a ticked field. */
export const poolFor = (d: Difficulty, ticked: string[] | null = null) => inFields(ofLevel(d), fieldsOfCase, ticked).map((c) => String(c.number));
/** The field menu under a difficulty: that level's cases per field (a case in two fields counts in both). */
export function fieldMenu(d: Difficulty, min: number): FieldMenu {
  const items = ofLevel(d);
  const flat = items.flatMap((c) => fieldsOfCase(c).map((f) => ({ f })));
  return { groups: groupsOf(flat, (x) => x.f, () => undefined), total: (t) => inFields(items, fieldsOfCase, t).length, min, unit: 'cases' };
}
