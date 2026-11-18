// Race to Diagnosis as a clue game kit (see kit.ts).
import { tickedFields } from '../shell/fields';
import { DP, type Difficulty, type DPCase } from './core';
import { CASES, INDEX, caseById, guessById, guessName, poolFor } from './data';
import type { ClueKit } from './kit';
import { tr } from '@/i18n';

const DIFF_COLOR: Record<string, string> = {
  Easy: '#34d399',
  Medium: '#f59e0b',
  Hard: '#fb7185',
  Extreme: '#c084fc',
};

/** Tempting wrong diagnoses for a case: diseases from the same field, closest first (the main field counts double). */
function nearMisses(c: DPCase, pick: (n: number) => number, n: number) {
  if (!n) return [];
  const near = (x: DPCase) => x.fields.filter((f) => c.fields.includes(f)).length + (x.fields[0] === c.fields[0] ? 1 : 0);
  const ranked = CASES.filter((x) => x.answer_id !== c.answer_id && guessById.has(x.answer_id) && near(x) > 0).sort((a, b) => near(b) - near(a));
  const pool = [...new Set(ranked.map((x) => x.answer_id))].slice(0, 12);
  const out: string[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(pick(pool.length), 1)[0]);
  return out;
}

export const DP_KIT: ClueKit = {
  rules: DP,
  byId: caseById,
  index: INDEX,
  guessById,
  guessName,
  pool: (settings) => poolFor(settings.difficulty as Difficulty, tickedFields(settings)),
  pill: (c) => ({ label: tr(c.difficulty ?? 'Medium'), color: DIFF_COLOR[c.difficulty ?? 'Medium'] ?? DIFF_COLOR.Medium }),
  resultSub: (c) => c.fields.join(' · '),
  hint: { reason: 'diagnostic_hint', title: tr('💡 Hint · Medical field'), kind: 'fields' },
  gameData: (c) => ({ difficulty: c.difficulty }),
  nearMisses,
  race: { itemMs: 60_000, clueMs: 10_000, lockMs: 5_000, revealMs: 6_000, clueBonus: [50, 40, 30, 20, 10, 0] },
  words: {
    item: 'Case {n}',
    itemOf: 'Case {n} of {n2}',
    next: 'Next case',
    missSolo: 'No points this time. This case goes to your Learn review.',
    missLearn: 'Not solved. No points this case. It goes to your Learn review.',
    hidden: 'Case hidden',
    pausedSolo: 'The clock is stopped. Resume to see the case again.',
    pausedBots: 'The match is paused, rivals too. Resume to see the case again.',
    placeholder: 'Type a diagnosis…',
    inputLabel: 'Your diagnosis',
    wrongList: 'Differential',
    solved: 'solved the case · +{v}',
    missed: 'missed the case',
  },
};
