import { type FieldMenu, inFields } from '../shell/fields';
import type { Group } from './core';
import groupsJson from './data/groups.json';

/** 300 groups (25 fields x 11 + 25 wordplay), 8+ boxes each. Source: build/fok-bank/*.txt (build.py writes the JSON). */
export const GROUPS = groupsJson as Group[];
export const groupById: ReadonlyMap<string, Group> = new Map(GROUPS.map((g) => [g.id, g]));

/** The 26 field ticks (Yazan 2026-11-12): Race to Diagnosis's 19 clinical fields, 6 basic sciences and Wordplay. */
export const FIELDS: { key: string; label: string; group: 'Clinical' | 'Basic science' | 'Wordplay' }[] = [
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
  { key: 'pharm', label: 'Pharmacology', group: 'Basic science' },
  { key: 'anatomy', label: 'Anatomy', group: 'Basic science' },
  { key: 'physio', label: 'Physiology', group: 'Basic science' },
  { key: 'micro', label: 'Microbiology', group: 'Basic science' },
  { key: 'patho', label: 'Pathology', group: 'Basic science' },
  { key: 'biochem', label: 'Biochemistry', group: 'Basic science' },
  { key: 'wordplay', label: 'Wordplay', group: 'Wordplay' },
];
export const fieldLabel = (f: string) => FIELDS.find((x) => x.key === f)?.label ?? f;

/** The groups the ticked fields allow (null = every field). */
export const poolOf = (ticked: string[] | null) => inFields(GROUPS, (g) => g.f, ticked);

/** The field ticks behind "All fields". A board needs at least 4 groups that can sit together. */
export function fieldMenu(): FieldMenu {
  const count = (f: string) => GROUPS.filter((g) => g.f === f).length;
  return {
    groups: (['Clinical', 'Basic science', 'Wordplay'] as const).map((title) => ({
      title,
      items: FIELDS.filter((x) => x.group === title).map((x) => ({ key: x.key, label: x.label, count: count(x.key) })),
    })),
    total: (ticked) => poolOf(ticked).length,
    min: 11,
    unit: 'groups',
  };
}
