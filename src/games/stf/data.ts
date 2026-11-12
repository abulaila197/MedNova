import { type FieldMenu, inFields } from '../shell/fields';
import type { Case } from './core';
import casesJson from './data/cases.json';

/** The case bank (25 a tick x 22 ticks). Source: build/stf-bank/*.txt (build.py writes the JSON). */
export const CASES = casesJson as Case[];
export const caseById: ReadonlyMap<string, Case> = new Map(CASES.map((c) => [c.id, c]));

/** The 22 field ticks (Yazan 2026-11-12): Race to Diagnosis's 19 clinical fields and 3 hospital ones. */
export const FIELDS: { key: string; label: string; group: 'Clinical' | 'Hospital' }[] = [
  { key: 'cardiology', label: 'Cardiology', group: 'Clinical' },
  { key: 'dermatology', label: 'Dermatology', group: 'Clinical' },
  { key: 'ent', label: 'ENT', group: 'Clinical' },
  { key: 'emergency', label: 'Emergency Medicine & Toxicology', group: 'Clinical' },
  { key: 'endocrine', label: 'Endocrinology & Metabolism', group: 'Clinical' },
  { key: 'gastro', label: 'Gastroenterology & Hepatology', group: 'Clinical' },
  { key: 'genetics', label: 'Genetics', group: 'Clinical' },
  { key: 'heme', label: 'Hematology & Oncology', group: 'Clinical' },
  { key: 'infectious', label: 'Infectious Diseases', group: 'Clinical' },
  { key: 'nephro', label: 'Nephrology & Urology', group: 'Clinical' },
  { key: 'neuro', label: 'Neurology', group: 'Clinical' },
  { key: 'obgyn', label: 'Obstetrics & Gynecology', group: 'Clinical' },
  { key: 'ophtho', label: 'Ophthalmology', group: 'Clinical' },
  { key: 'ortho', label: 'Orthopedics & Sports Medicine', group: 'Clinical' },
  { key: 'peds', label: 'Pediatrics', group: 'Clinical' },
  { key: 'psych', label: 'Psychiatry', group: 'Clinical' },
  { key: 'pulm', label: 'Pulmonology', group: 'Clinical' },
  { key: 'rheum', label: 'Rheumatology & Immunology', group: 'Clinical' },
  { key: 'surgery', label: 'Surgery & Trauma', group: 'Clinical' },
  { key: 'ethics', label: 'Ethics & Law', group: 'Hospital' },
  { key: 'safety', label: 'Patient Care & Safety', group: 'Hospital' },
  { key: 'flow', label: 'Hospital Flow & Teamwork', group: 'Hospital' },
];
export const fieldLabel = (f: string) => FIELDS.find((x) => x.key === f)?.label ?? f;

/** Made-up hospitals for the sheet's header, one a case. */
const HOSPITALS = ['Al Noor', 'Riverside', 'Cedar Hill', 'Nile View', 'Green Valley', 'Lakeside', 'Al Salam', 'Northgate', 'Palm Grove', 'Saint Luke', 'Hillcrest', 'Al Amal'];
export function hospitalOf(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HOSPITALS[h % HOSPITALS.length];
}

/** The cases the ticked fields allow (null = every field). */
export const poolOf = (ticked: string[] | null) => inFields(CASES, (c) => c.f, ticked);

/** The field ticks behind "All fields". */
export function fieldMenu(): FieldMenu {
  const count = (f: string) => CASES.filter((c) => c.f === f).length;
  return {
    groups: (['Clinical', 'Hospital'] as const).map((title) => ({
      title,
      items: FIELDS.filter((x) => x.group === title).map((x) => ({ key: x.key, label: x.label, count: count(x.key) })),
    })),
    total: (ticked) => poolOf(ticked).length,
    min: 5,
    unit: 'cases',
  };
}
