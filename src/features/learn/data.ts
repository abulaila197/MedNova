// Sample content for My cases (writing your own cases comes later; RL plan 2026-10-11).

export type Case = { title: string; area: string; state: string };
export const MY_CASES: Case[] = [
  { title: 'Chest pain after a long flight', area: 'Cardiology', state: 'Draft' },
  { title: 'Fever and a rash on the palms', area: 'Infectious', state: 'Shared · 12 plays' },
  { title: 'Sudden vision loss, one eye', area: 'Ophthalmology', state: 'Shared · 4 plays' },
  { title: 'Toddler with a limp', area: 'Paediatrics', state: 'Draft' },
];
