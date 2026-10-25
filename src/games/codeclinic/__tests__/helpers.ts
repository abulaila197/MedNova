import { buildCards } from '../engine/board';
import { seededRng } from '../engine/random';
import type { Card, Team, Term } from '../engine/types';

const CLIN = ['Aorta', 'Insulin', 'Appendectomy', 'Asthma', 'Warfarin', 'Pneumonia', 'Stent', 'Sepsis', 'Migraine', 'Colonoscopy', 'Anemia', 'Gout', 'Biopsy', 'Eczema', 'Hernia', 'Cirrhosis', 'Lupus', 'Angina', 'Scalpel', 'Tinnitus', 'Vertigo', 'Cataract', 'Rickets', 'Ulcer', 'Glaucoma', 'Measles', 'Mumps'];
const BASIC = ['Ribosome', 'Mitochondria', 'Femur', 'Cortisol', 'Neuron', 'Lysosome', 'Collagen', 'Myosin', 'Nephron', 'Alveolus', 'Dopamine', 'Thyroxine', 'Glycolysis', 'Plasmid', 'Hemoglobin', 'Synapse', 'Cochlea', 'Pancreas', 'Sarcomere', 'Osmosis', 'Ligament', 'Cerebellum', 'Meiosis', 'Peroxisome', 'Telomere', 'Chromatin', 'Albumin'];

export const TERMS: Term[] = [
  ...CLIN.map((term, i) => ({ id: i + 1, style: 'clinical' as const, field: 'F', term })),
  ...BASIC.map((term, i) => ({ id: 100 + i, style: 'basic' as const, field: 'F', term })),
];

/** Cards 0-8 = starting team, 9-16 = other team, 17-23 neutral, 24 assassin. Deterministic layout for tests. */
export function fixedCards(startingTeam: Team = 'red'): Card[] {
  const other: Team = startingTeam === 'red' ? 'blue' : 'red';
  return TERMS.slice(0, 25).map((t, index) => ({
    index,
    termId: t.id,
    term: t.term,
    color: index < 9 ? startingTeam : index < 17 ? other : index < 24 ? 'neutral' : 'assassin',
    revealed: false,
  }));
}

export const randomCards = (seed = 1, team: Team = 'red') => buildCards(TERMS.slice(0, 25), team, seededRng(seed));
