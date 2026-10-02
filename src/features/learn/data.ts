// Sample content for the Learn section, copied from the locked previews.

export type Field = { key: string; tab: string; label: string; text: string };

/** The five dossier fields of Myasthenia gravis, in folder-tab order. */
export const MG_FIELDS: Field[] = [
  { key: 'epi', tab: 'Epidemiology', label: 'Epidemiology', text: 'Can occur at any age and has a female predominance in younger adults.' },
  { key: 'eti', tab: 'Etiology', label: 'Etiology', text: 'Autoimmune disruption of neuromuscular transmission, commonly involving acetylcholine receptors or related proteins.' },
  { key: 'cli', tab: 'Clinical', label: 'Clinical features', text: 'Fluctuating fatigable weakness, often involving ocular, bulbar or proximal muscles.' },
  { key: 'inv', tab: 'Investigations', label: 'Investigations', text: 'Antibody testing, electrodiagnostic studies and selected bedside tests support diagnosis; chest imaging assesses thymic disease.' },
  { key: 'tre', tab: 'Treatment', label: 'Treatment', text: 'Pyridostigmine and immunotherapy are common; thymectomy and advanced immunotherapies are selected for appropriate patients.' },
];

/** Today's review: the card on screen. `dot` is the lit dot of the five on the back. */
export const REVIEW = {
  index: 3,
  total: 8,
  game: 'The Riddler',
  when: '3 days ago',
  first: 'Myasthenia',
  em: 'gravis',
  field: MG_FIELDS[1],
  dot: 0,
};

export type Spine = { name: string; count: number; mastery: number; c: number };

/** Disease dossier shelves. `c` picks the spine colour (index into the palette's spine colours). */
export const DOSSIER_TOTAL = 388;
export const CLINICAL_SHELVES: Spine[][] = [
  [
    { name: 'Neurology', count: 15, mastery: 0.27, c: 0 },
    { name: 'Dermatology', count: 13, mastery: 0.62, c: 1 },
    { name: 'Gastro', count: 8, mastery: 0.5, c: 2 },
    { name: 'Endocrine', count: 8, mastery: 0.12, c: 3 },
    { name: 'Rheumatology', count: 7, mastery: 0.43, c: 4 },
  ],
  [
    { name: 'Haematology', count: 5, mastery: 0.8, c: 0 },
    { name: 'Eyes', count: 5, mastery: 0.2, c: 1 },
    { name: 'Heart', count: 3, mastery: 0.67, c: 2 },
    { name: 'Lungs', count: 2, mastery: 0.04, c: 3 },
    { name: 'Kidneys', count: 1, mastery: 0.04, c: 4 },
  ],
];
export const BASIC_SHELF: Spine[] = [
  { name: 'Anatomy', count: 42, mastery: 0.3, c: 0 },
  { name: 'Physiology', count: 38, mastery: 0.55, c: 1 },
  { name: 'Microbiology', count: 33, mastery: 0.66, c: 2 },
  { name: 'Pathology', count: 47, mastery: 0.4, c: 3 },
  { name: 'Pharmacology', count: 51, mastery: 0.2, c: 4 },
  { name: 'Biochemistry', count: 29, mastery: 0.1, c: 5 },
];

export type Case = { title: string; area: string; state: string };
export const MY_CASES: Case[] = [
  { title: 'Chest pain after a long flight', area: 'Cardiology', state: 'Draft' },
  { title: 'Fever and a rash on the palms', area: 'Infectious', state: 'Shared · 12 plays' },
  { title: 'Sudden vision loss, one eye', area: 'Ophthalmology', state: 'Shared · 4 plays' },
  { title: 'Toddler with a limp', area: 'Paediatrics', state: 'Draft' },
];

export type Mark = 'miss' | 'done' | null;
export type Disease = { name: string; mark: Mark };

/** The Neurology shelf, A to Z. */
export const NEUROLOGY: Disease[] = [
  { name: 'Alexander disease', mark: null },
  { name: 'Amyotrophic lateral sclerosis', mark: null },
  { name: "Bell's Palsy", mark: 'done' },
  { name: 'Benign Essential Tremor', mark: null },
  { name: 'CADASIL', mark: 'miss' },
  { name: 'CARASIL', mark: null },
  { name: 'Creutzfeldt-Jakob disease', mark: null },
  { name: 'Epilepsy', mark: 'done' },
  { name: 'MELAS syndrome', mark: null },
  { name: 'MERRF syndrome', mark: null },
  { name: 'Migraine with aura', mark: 'done' },
  { name: 'Miller Fisher syndrome', mark: 'miss' },
  { name: 'Multiple sclerosis', mark: null },
  { name: 'Myasthenia gravis', mark: 'miss' },
  { name: 'Parkinson disease', mark: 'done' },
];

/** The open dossier. */
export const DOSSIER = {
  first: 'Myasthenia',
  em: 'gravis',
  shelf: 'Neurology',
  status: 'Missed twice',
  meta: 'Neurology · dossier 7 of 15',
  fields: MG_FIELDS,
};
