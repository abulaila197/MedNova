// Who am I? as a clue game kit (diagnostic/kit.ts): Race to Diagnosis's screens with 5 clues, puzzles instead of cases
// and the first letter + length as its hint (Yazan 2026-11-17).
import type { ClueKit } from '../diagnostic/kit';
import { tickedFields } from '../shell/fields';
import { INDEX, caseById, guessById, guessName, nearMisses, poolOf } from './data';
import { WAI } from './rules';
import { tr } from '@/i18n';

/** One colour a category, for the pill on the top bar. */
const CAT_COLOR: Record<string, string> = {
  Anatomy: '#fb7185',
  Physiology: '#f59e0b',
  Biochemistry: '#34d399',
  Pathology: '#c084fc',
  Pharmacology: '#22d3ee',
  Microbiology: '#a3e635',
  Histology: '#f472b6',
  Embryology: '#60a5fa',
};

export const WAI_KIT: ClueKit = {
  rules: WAI,
  byId: caseById,
  index: INDEX,
  guessById,
  guessName,
  pool: (settings) => poolOf(tickedFields(settings)),
  pill: (c) => ({ label: tr(c.fields[0]), color: CAT_COLOR[c.fields[0]] ?? '#f5c96b' }),
  resultSub: (c) => [c.type, c.fields[0]].filter(Boolean).join(' · '),
  hint: { reason: 'whoami_hint', title: tr('💡 Hint · First letter and length'), kind: 'letters' },
  gameData: (c) => ({ category: c.fields[0] }),
  nearMisses,
  // Vs rivals (Yazan 2026-11-17): a clue every 10 s, 50 s a puzzle, 5 s lock after a wrong guess.
  race: { itemMs: 50_000, clueMs: 10_000, lockMs: 5_000, revealMs: 6_000, clueBonus: [50, 40, 25, 10, 0] },
  words: {
    item: 'Puzzle {n}',
    itemOf: 'Puzzle {n} of {n2}',
    next: 'Next puzzle',
    missSolo: 'No points this time. This one goes to your Learn review.',
    missLearn: 'Not solved. No points this time. It goes to your Learn review.',
    hidden: 'Puzzle hidden',
    pausedSolo: 'The clock is stopped. Resume to see the clues again.',
    pausedBots: 'The match is paused, rivals too. Resume to see the clues again.',
    placeholder: 'Type your answer…',
    inputLabel: 'Your answer',
    wrongList: 'Wrong guesses',
    solved: 'solved it · +{v}',
    missed: 'missed it',
  },
};
