// The Conqueror question bank: Yazan's 4,400 questions (10 fields x 440) in 8 styles, and drawing them.
// Built from the clean copy by build/conqueror-bank.py. The right answer sits first in most source items,
// so every draw shuffles the options.

export type Rng = () => number;

export type FieldKey =
  | 'anatomy' | 'physiology' | 'pathology' | 'pharmacology' | 'microbiology' | 'biochemistry'
  | 'medicine' | 'surgery' | 'pediatrics' | 'obgyn';

export const FIELDS: { key: FieldKey; name: string; group: 'basic' | 'clinical' }[] = [
  { key: 'anatomy', name: 'Anatomy', group: 'basic' },
  { key: 'physiology', name: 'Physiology', group: 'basic' },
  { key: 'pathology', name: 'Pathology', group: 'basic' },
  { key: 'pharmacology', name: 'Pharmacology', group: 'basic' },
  { key: 'microbiology', name: 'Microbiology', group: 'basic' },
  { key: 'biochemistry', name: 'Biochemistry', group: 'basic' },
  { key: 'medicine', name: 'Internal Medicine', group: 'clinical' },
  { key: 'surgery', name: 'Surgery', group: 'clinical' },
  { key: 'pediatrics', name: 'Pediatrics', group: 'clinical' },
  { key: 'obgyn', name: 'Obs & Gynae', group: 'clinical' },
];

/** QS1 / CQ11: the host picks Mixed (default), Clinical or Basic. */
export type Mix = 'mixed' | 'clinical' | 'basic';
export const MIXES: { value: Mix; label: string }[] = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'clinical', label: 'Clinical' },
  { value: 'basic', label: 'Basic science' },
];

/** NL1: a main name plus at most 2 other names. note = the source's bracket text, shown only after the round. */
export type Named = { label: string; aliases?: string[]; note?: string };

type Base = { id: string; field: FieldKey; difficulty: number; prompt: string; explanation?: string };
export type McqQ = Base & { style: 'mcq'; options: string[]; answer: number };
export type TfQ = Base & { style: 'tf'; answer: boolean };
/** items in the right order. */
export type OrderQ = Base & { style: 'order'; items: string[] };
/** [left, right] pairs. */
export type MatchQ = Base & { style: 'match'; pairs: [string, string][] };
export type ClosestQ = Base & { style: 'closest'; answer: number; unit: string };
export type RushQ = Base & { style: 'rush'; answers: Named[] };
/** answers: indices of the right options (1 to 3 of 6). */
export type StandingQ = Base & { style: 'standing'; options: string[]; answers: number[] };
export type ClueQ = Base & { style: 'clue'; clues: string[]; answer: Named };

export type SoloQ = McqQ | TfQ | OrderQ | MatchQ;
export type BankQ = SoloQ | ClosestQ | RushQ | StandingQ | ClueQ;
export type BankStyle = BankQ['style'];
export type SoloStyle = SoloQ['style'];
export const SOLO_STYLES: SoloStyle[] = ['mcq', 'tf', 'order', 'match'];

export type Bank = { all: BankQ[]; byStyle: { [S in BankStyle]: Extract<BankQ, { style: S }>[] } };

export function makeBank(list: readonly BankQ[]): Bank {
  const byStyle = { mcq: [], tf: [], order: [], match: [], closest: [], rush: [], standing: [], clue: [] } as unknown as Bank['byStyle'];
  for (const q of list) (byStyle[q.style] as BankQ[]).push(q);
  return { all: [...list], byStyle };
}

export const inMix = (field: FieldKey, mix: Mix) => mix === 'mixed' || FIELDS.find((f) => f.key === field)?.group === mix;

export function shuffle<T>(list: readonly T[], rng: Rng): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** MCQ with its options shuffled and the answer index moved with them. */
export function shuffleMcq(q: McqQ, rng: Rng): McqQ {
  const order = shuffle(q.options.map((_, i) => i), rng);
  return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
}

export function shuffleStanding(q: StandingQ, rng: Rng): StandingQ {
  const order = shuffle(q.options.map((_, i) => i), rng);
  return { ...q, options: order.map((i) => q.options[i]), answers: q.answers.map((a) => order.indexOf(a)).sort((x, y) => x - y) };
}

/**
 * Draws n questions of a style in the match's mix, skipping ids already used this match.
 * When the unused pool runs dry, used ids of that style are forgotten and the pool starts again.
 */
export function draw<S extends BankStyle>(bank: Bank, style: S, n: number, mix: Mix, used: Set<string>, rng: Rng): Extract<BankQ, { style: S }>[] {
  const pool = (bank.byStyle[style] as Extract<BankQ, { style: S }>[]).filter((q) => inMix(q.field, mix));
  let fresh = pool.filter((q) => !used.has(q.id));
  if (fresh.length < n) {
    for (const q of pool) used.delete(q.id);
    fresh = pool;
  }
  const picked = shuffle(fresh, rng).slice(0, n);
  for (const q of picked) used.add(q.id);
  return picked.map((x) => {
    const q = x as BankQ;
    return (q.style === 'mcq' ? shuffleMcq(q, rng) : q.style === 'standing' ? shuffleStanding(q, rng) : q) as Extract<BankQ, { style: S }>;
  });
}

/** How many bank items one solo tile holds (his code: MCQ/TF tile = 3 items, Order/Match = 1 set of 5). */
export const TILE_ITEMS: Record<SoloStyle, number> = { mcq: 3, tf: 3, order: 1, match: 1 };
