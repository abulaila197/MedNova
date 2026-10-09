// The Wheels answer keys for the online referee (ON17, WC20-WC23). Every phone carries the full bank, so the
// server only needs what the engine draws and judges with: each question's style, field and answer, each
// Redemption call's field, round and answer, and each Boss item's fit. Questions are named by their place in
// the bank, and a bank version stops a phone with a different bank from joining the same game.
import { FIELDS, STYLE_KEYS, type Difficulty, type Question } from './core';
import type { BossSet, FullBank } from './offline';

/** 80 plain symbols: no quotes, backslash or backtick, so the keys sit in JSON or source untouched. */
const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-./:;<=>?@[]^_{|}~';
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];
const ch = (n: number) => {
  if (n < 0 || n >= ALPHA.length) throw new Error(`key out of range: ${n}`);
  return ALPHA[n];
};
const at = (s: string, i: number) => ALPHA.indexOf(s[i]);

export type Keys = { v: string; q: string; r: string; b: string };

/** Changes whenever questions are added, removed or reordered. */
export function bankVersion(bank: FullBank): string {
  let h = 2166136261;
  for (const id of [...bank.questions, ...bank.redemption].map((q) => q.id).concat(bank.boss.map((b) => b.id)))
    for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return `${bank.questions.length}.${bank.redemption.length}.${bank.boss.length}.${(h >>> 0).toString(36)}`;
}

const fieldIx = (f: string) => FIELDS.findIndex((x) => x.key === f);

function answerCode(q: Question): number {
  switch (q.style) {
    case 'tf': return q.answer ? 1 : 0;
    case 'lie': return q.lie;
    case 'match': return q.pairs.length;
    case 'r2o': return q.out[0] * 8 + q.out[1];
    default: return q.answer;
  }
}

export function encodeKeys(bank: FullBank): Keys {
  return {
    v: bankVersion(bank),
    q: bank.questions.map((q) => ch(STYLE_KEYS.indexOf(q.style) * 10 + fieldIx(q.field)) + ch(answerCode(q))).join(''),
    r: bank.redemption.map((q) => ch(fieldIx(q.field)) + ch((q.round ?? -1) + 1) + ch(DIFFS.indexOf(q.difficulty) * 2 + (q.style === 'tf' && q.answer ? 1 : 0))).join(''),
    b: bank.boss.map((s) => ch(fieldIx(s.field)) + s.items.map((i) => (i.fits ? '1' : '0')).join('')).join(','),
  };
}

/** A bank the engine can run on: ids are bank places, prompts are empty, Boss labels are item places. */
export function decodeKeys(k: Keys): FullBank {
  const questions: Question[] = [];
  for (let i = 0; i * 2 < k.q.length; i++) {
    const c = at(k.q, i * 2), a = at(k.q, i * 2 + 1);
    const style = STYLE_KEYS[Math.floor(c / 10)];
    const base = { id: String(i), field: FIELDS[c % 10].key, difficulty: 'medium' as Difficulty, prompt: '' };
    if (style === 'tf') questions.push({ ...base, style, answer: a === 1 });
    else if (style === 'lie') questions.push({ ...base, style, statements: [], lie: a });
    else if (style === 'match') questions.push({ ...base, style, pairs: Array.from({ length: a }, () => ['', ''] as [string, string]) });
    else if (style === 'r2o') questions.push({ ...base, style, items: [], out: [Math.floor(a / 8), a % 8] });
    else questions.push({ ...base, style, choices: [], answer: a });
  }
  const redemption: Question[] = [];
  for (let i = 0; i * 3 < k.r.length; i++) {
    const round = at(k.r, i * 3 + 1) - 1, d = at(k.r, i * 3 + 2);
    redemption.push({
      id: String(i), style: 'tf', field: FIELDS[at(k.r, i * 3)].key, difficulty: DIFFS[d >> 1], prompt: '', answer: (d & 1) === 1,
      ...(round >= 0 ? { round } : null),
    });
  }
  const boss: BossSet[] = k.b.split(',').map((s, i) => ({
    id: String(i), field: FIELDS[at(s, 0)].key, category: String(i),
    items: [...s.slice(1)].map((f, j) => ({ label: String(j), fits: f === '1' })),
  }));
  return { questions, redemption, boss };
}
