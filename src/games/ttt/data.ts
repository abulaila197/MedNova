import { type FieldMenu, inFields } from '../shell/fields';
import type { Case } from './core';
import casesJson from './data/cases.json';

/** The case bank. Source: build/ttt-bank/*.txt (build.py writes the JSON). */
export const CASES = casesJson as Case[];
export const caseById: ReadonlyMap<string, Case> = new Map(CASES.map((c) => [c.id, c]));

/** The 20 field ticks (Yazan 2026-11-12): Race to Diagnosis's 19 clinical fields and first aid. */
export const FIELDS: { key: string; label: string; short: string; group: 'Clinical' | 'First aid' }[] = [
  { key: 'cardiology', label: 'Cardiology', short: 'Cardiology', group: 'Clinical' },
  { key: 'dermatology', label: 'Dermatology', short: 'Dermatology', group: 'Clinical' },
  { key: 'ent', label: 'ENT', short: 'ENT', group: 'Clinical' },
  { key: 'emergency', label: 'Emergency Medicine & Toxicology', short: 'Emergency', group: 'Clinical' },
  { key: 'endocrine', label: 'Endocrinology & Metabolism', short: 'Endocrinology', group: 'Clinical' },
  { key: 'gastro', label: 'Gastroenterology & Hepatology', short: 'Gastro', group: 'Clinical' },
  { key: 'genetics', label: 'Genetics', short: 'Genetics', group: 'Clinical' },
  { key: 'heme', label: 'Hematology & Oncology', short: 'Hematology', group: 'Clinical' },
  { key: 'infectious', label: 'Infectious Diseases', short: 'Infections', group: 'Clinical' },
  { key: 'nephro', label: 'Nephrology & Urology', short: 'Nephrology', group: 'Clinical' },
  { key: 'neuro', label: 'Neurology', short: 'Neurology', group: 'Clinical' },
  { key: 'obgyn', label: 'Obstetrics & Gynecology', short: 'Obs & Gyn', group: 'Clinical' },
  { key: 'ophtho', label: 'Ophthalmology', short: 'Eyes', group: 'Clinical' },
  { key: 'ortho', label: 'Orthopedics & Sports Medicine', short: 'Orthopedics', group: 'Clinical' },
  { key: 'peds', label: 'Pediatrics', short: 'Pediatrics', group: 'Clinical' },
  { key: 'psych', label: 'Psychiatry', short: 'Psychiatry', group: 'Clinical' },
  { key: 'pulm', label: 'Pulmonology', short: 'Chest', group: 'Clinical' },
  { key: 'rheum', label: 'Rheumatology & Immunology', short: 'Rheumatology', group: 'Clinical' },
  { key: 'surgery', label: 'Surgery & Trauma', short: 'Surgery', group: 'Clinical' },
  { key: 'firstaid', label: 'First Aid & Resuscitation', short: 'First aid', group: 'First aid' },
];
export const fieldLabel = (f: string) => FIELDS.find((x) => x.key === f)?.label ?? f;
export const fieldShort = (f: string) => FIELDS.find((x) => x.key === f)?.short ?? f;

/** The cases the ticked fields allow (null = every field). */
export const poolOf = (ticked: string[] | null) => inFields(CASES, (c) => c.f, ticked);

/** The field ticks behind "All fields". */
export function fieldMenu(): FieldMenu {
  const count = (f: string) => CASES.filter((c) => c.f === f).length;
  return {
    groups: (['Clinical', 'First aid'] as const).map((title) => ({
      title,
      items: FIELDS.filter((x) => x.group === title).map((x) => ({ key: x.key, label: x.label, count: count(x.key) })),
    })),
    total: (ticked) => poolOf(ticked).length,
    min: 5,
    unit: 'cases',
  };
}
