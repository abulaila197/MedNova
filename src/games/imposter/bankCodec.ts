// The word bank packed small for the online referee (the edge function upload has to stay light): categories are
// listed once, each pair is one row, alternatives are joined by '|'. Only what the engine reads is kept.
import type { WordBank } from './engine/types';

export type PackedBank = { c: string[]; p: [string, 0 | 1, number, string, string, string, string][] };

export function packBank(bank: WordBank): PackedBank {
  const c = [...new Set(bank.pairs.map((x) => x.category))];
  return { c, p: bank.pairs.map((x) => [x.id, x.subtype === 'basic' ? 1 : 0, c.indexOf(x.category), x.a.word, x.a.alts.join('|'), x.b.word, x.b.alts.join('|')]) };
}

export function unpackBank(b: PackedBank): WordBank {
  const alts = (s: string) => (s ? s.split('|') : []);
  return { pairs: b.p.map(([id, s, c, aw, aa, bw, ba]) => ({ id, subtype: s ? 'basic' : 'clinical', category: b.c[c], a: { word: aw, alts: alts(aa) }, b: { word: bw, alts: alts(ba) } })) };
}
