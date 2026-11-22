import { type FieldMenu, inFields } from '../shell/fields';
import type { Case } from './core';
import casesJson from './data/cases.json';

/** The case bank: 25 a clinical or hospital tick, 40 a basic science tick. Source: build/stf-bank/*.txt (build.py writes the JSON). */
export const CASES = casesJson as Case[];
export const caseById: ReadonlyMap<string, Case> = new Map(CASES.map((c) => [c.id, c]));

/** The 22 field ticks (Yazan 2026-11-12): Race to Diagnosis's 19 clinical fields and 3 hospital ones. */
export const FIELDS: { key: string; label: string; group: 'Clinical' | 'Hospital' | 'Basic science' }[] = [
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
  // Basic sciences (Yazan 2026-11-17): lab notebooks, practical reports, handouts, exam sheets, flashcards, textbook pages.
  { key: 'anatomy', label: 'Anatomy', group: 'Basic science' },
  { key: 'physiology', label: 'Physiology', group: 'Basic science' },
  { key: 'biochemistry', label: 'Biochemistry', group: 'Basic science' },
  { key: 'pathology', label: 'Pathology', group: 'Basic science' },
  { key: 'pharmacology', label: 'Pharmacology', group: 'Basic science' },
  { key: 'microbiology', label: 'Microbiology', group: 'Basic science' },
  { key: 'histology', label: 'Histology', group: 'Basic science' },
  { key: 'embryology', label: 'Embryology', group: 'Basic science' },
];
export const fieldLabel = (f: string) => FIELDS.find((x) => x.key === f)?.label ?? f;

/** Made-up hospitals for the sheet's header, one a case. */
const HOSPITALS = ['Al Noor', 'Riverside', 'Cedar Hill', 'Nile View', 'Green Valley', 'Lakeside', 'Al Salam', 'Northgate', 'Palm Grove', 'Saint Luke', 'Hillcrest', 'Al Amal'];
export function hospitalOf(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HOSPITALS[h % HOSPITALS.length];
}

/** What the cases ask about (Yazan 2026-11-22), its own setup row like Word Lab's: Clinical (clinical and hospital
 * fields), Basic sciences, or Mixed (all). */
export type StfKnow = 'clinical' | 'basic' | 'mixed';
export const knowOf = (settings: Record<string, unknown> | undefined): StfKnow =>
  settings?.know === 'clinical' || settings?.know === 'basic' ? settings.know : 'mixed';
const GROUPS: Record<StfKnow, readonly (typeof FIELDS)[number]['group'][]> = {
  clinical: ['Clinical', 'Hospital'],
  basic: ['Basic science'],
  mixed: ['Clinical', 'Hospital', 'Basic science'],
};
const fieldsOf = (know: StfKnow) => new Set(FIELDS.filter((x) => GROUPS[know].includes(x.group)).map((x) => x.key));

/** The cases the knowledge row and the ticked fields allow (null = every field of that knowledge). Ticks left over
 * from another knowledge are dropped; if none are left, every field of the knowledge counts. */
export function poolOf(ticked: string[] | null, know: StfKnow = 'mixed') {
  const keys = fieldsOf(know);
  const kept = ticked?.filter((f) => keys.has(f)) ?? null;
  return inFields(CASES.filter((c) => keys.has(c.f)), (c) => c.f, kept?.length ? kept : null);
}

/** The field ticks behind "All fields", only those of the chosen knowledge. */
export function fieldMenu(know: StfKnow = 'mixed'): FieldMenu {
  const count = (f: string) => CASES.filter((c) => c.f === f).length;
  return {
    groups: GROUPS[know].map((title) => ({
      title,
      items: FIELDS.filter((x) => x.group === title).map((x) => ({ key: x.key, label: x.label, count: count(x.key) })),
    })),
    total: (ticked) => poolOf(ticked, know).length,
    min: 5,
    unit: 'cases',
  };
}
