import type { FieldMenu } from '../shell/fields';
import WORDS from './data/words.json';

export type CatKey = 'diseases' | 'drugs' | 'anatomy' | 'signs' | 'tests' | 'hospital' | 'staff' | 'emergency' | 'body';
export type Word = { id: string; w: string; c: CatKey };

/** 1,800 well-known words, 200 in each of the 9 categories (Yazan 2026-11-12). Sources: build/tilt-words/*.py. */
export const BANK = WORDS as Word[];
export const wordById = new Map(BANK.map((x) => [x.id, x]));

/** The categories in setup order. */
export const CATS: { key: CatKey; label: string }[] = [
  { key: 'diseases', label: 'Diseases' },
  { key: 'drugs', label: 'Drugs' },
  { key: 'anatomy', label: 'Anatomy' },
  { key: 'signs', label: 'Signs and symptoms' },
  { key: 'tests', label: 'Tests and procedures' },
  { key: 'hospital', label: 'Hospital and equipment' },
  { key: 'staff', label: 'Specialties and staff' },
  { key: 'emergency', label: 'Emergencies and first aid' },
  { key: 'body', label: 'Body in action' },
];
export const catLabel = (c: string) => CATS.find((x) => x.key === c)?.label ?? c;

/** The category ticks behind "All mixed" (the shared field-tick menu). At least one category to start. */
export function catMenu(): FieldMenu {
  const count = (c: string) => BANK.filter((x) => x.c === c).length;
  return {
    groups: [{ items: CATS.map((c) => ({ key: c.key, label: c.label, count: count(c.key) })) }],
    total: (ticked) => (ticked == null ? BANK.length : BANK.filter((x) => ticked.includes(x.c)).length),
    min: 200,
    unit: 'words',
  };
}
