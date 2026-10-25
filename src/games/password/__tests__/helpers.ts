import type { Term } from '../engine/types';

/** Terms with real names for the clue and autocomplete tests. */
export const MI: Term = { id: 'mi', name: 'Myocardial infarction', bank: 'clinical', category: 'disease', forbidden: ['heart', 'attack'] };
export const APPENDICITIS: Term = { id: 'appy', name: 'Appendicitis', bank: 'clinical', category: 'disease', forbidden: ['rlq'] };
export const ASPIRIN: Term = { id: 'asa', name: 'Aspirin', bank: 'clinical', category: 'drug', forbidden: ['acetylsalicylic'] };
export const FEMUR: Term = { id: 'femur', name: 'Femur', bank: 'basic', category: 'anatomy', forbidden: [] };

/** A bank big enough for the biggest match (10 words, 2 rounds, offline = 40 terms). */
export function makeTerms(clinical = 30, basic = 30): Term[] {
  const out: Term[] = [MI, APPENDICITIS, ASPIRIN, FEMUR];
  for (let i = 0; i < clinical; i++) {
    out.push({ id: `c${i}`, name: `Clinical term ${i}`, bank: 'clinical', category: 'disease', forbidden: [] });
  }
  for (let i = 0; i < basic; i++) {
    out.push({ id: `b${i}`, name: `Basic term ${i}`, bank: 'basic', category: 'pathology', forbidden: [] });
  }
  return out;
}

export const seqRng = (values: number[] = [0.31, 0.77, 0.05, 0.52, 0.93, 0.18, 0.64, 0.41]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

export function makeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => void (t += ms), set: (v: number) => void (t = v) };
}
