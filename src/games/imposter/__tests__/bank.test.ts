import assert from 'node:assert/strict';
import { test } from 'node:test';
import fullJson from '../data/pairs.json';
import sampleJson from './sample-pairs.json';
import { validateClue } from '../engine/clues';
import { isCorrectGuess } from '../engine/wordMatch';
import { lettersOnly, sameWord } from '../engine/text';
import type { WordBank, WordPair } from '../engine/types';
import { Sim, playRoundCaught, profanity } from './helpers';

const full = fullJson as unknown as WordBank;
const samples = (sampleJson as unknown as WordBank).pairs;
const clinical = full.pairs.filter((p) => p.subtype === 'clinical');
const basic = full.pairs.filter((p) => p.subtype === 'basic');
const count = (ps: WordPair[], f: (p: WordPair) => string | undefined) => {
  const m: Record<string, number> = {};
  for (const p of ps) { const k = f(p) ?? '?'; m[k] = (m[k] ?? 0) + 1; }
  return m;
};

test('word bank: 500 pairs per subtype with the agreed categories', () => {
  assert.equal(clinical.length, 500);
  assert.equal(basic.length, 500);
  const systems = ['Respiratory', 'Cardiovascular', 'Digestive', 'Nervous', 'Endocrine', 'Renal and urinary', 'Musculoskeletal', 'Reproductive', 'Blood and immune', 'Skin'];
  assert.deepEqual(count(clinical, (p) => p.category), Object.fromEntries(systems.map((s) => [s, 50])));
  assert.deepEqual(count(clinical, (p) => p.kind), { disease: 300, symptom: 80, investigation: 60, treatment: 60 });
  assert.deepEqual(count(basic, (p) => p.category), { Anatomy: 84, Physiology: 84, Biochemistry: 83, Pharmacology: 83, Pathology: 83, Microbiology: 83 });
});

test('word bank: the 20 approved sample pairs come first, unchanged', () => {
  const order = [...samples.filter((s) => s.subtype === 'clinical'), ...samples.filter((s) => s.subtype === 'basic')];
  order.forEach((s, i) => {
    const p = i < 10 ? clinical[i] : basic[i - 10];
    assert.equal(p.a.word, s.a.word);
    assert.equal(p.b.word, s.b.word);
    assert.equal(p.category, s.category);
    for (const side of ['a', 'b'] as const) for (const alt of s[side].alts) assert.ok(p[side].alts.includes(alt), `${s.id} lost ${alt}`);
  });
});

test('word bank: structure, unique ids, no duplicate pairs, no word in more than 2 pairs', () => {
  const ids = new Set<string>();
  const pairKeys = new Set<string>();
  const uses: Record<string, number> = {};
  for (const p of full.pairs) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
    ids.add(p.id);
    assert.ok(p.a.word.trim() && p.b.word.trim(), p.id);
    for (const e of [p.a, p.b]) {
      assert.ok(Array.isArray(e.alts) && e.alts.every((x) => typeof x === 'string' && x.trim()), p.id);
      uses[e.word.toLowerCase()] = (uses[e.word.toLowerCase()] ?? 0) + 1;
    }
    const key = [p.a.word.toLowerCase(), p.b.word.toLowerCase()].sort().join('|');
    assert.ok(!pairKeys.has(key), `duplicate pair ${key}`);
    pairKeys.add(key);
  }
  assert.ok(Math.max(...Object.values(uses)) <= 2);
});

test('word bank: the two words of a pair never overlap, even through alternatives or a final s', () => {
  for (const p of full.pairs) {
    for (const x of [p.a.word, ...p.a.alts]) for (const y of [p.b.word, ...p.b.alts]) {
      assert.ok(!sameWord(x, y), `${p.id}: "${x}" ~ "${y}"`);
    }
  }
});

test('word bank: every word is guessable (word and alternatives) and own-word blocking works', () => {
  for (const p of full.pairs) {
    for (const [mine, other] of [[p.a, p.b], [p.b, p.a]] as const) {
      for (const g of [mine.word, ...mine.alts]) {
        assert.ok(isCorrectGuess(g, mine, other), `${p.id}: "${g}" should be accepted`);
        assert.ok(!isCorrectGuess(g, other, mine), `${p.id}: "${g}" must not match the other word`);
      }
      // a clue that is the word's own letters (up to 15) is blocked for its holder
      const own = lettersOnly(mine.word);
      if (own.length <= 15) {
        const r = validateClue(own, { own: mine, prior: [], profanity });
        assert.deepEqual(r, { ok: false, code: 'clue/ownWord' }, p.id);
      }
    }
  }
});

test('word bank works in the engine: a 5-round, 6-player mixed match with the real bank', () => {
  const sim = new Sim({ n: 6, seed: 77, bank: full });
  sim.startOnline('mixed', 5);
  for (let r = 0; r < 5; r++) {
    assert.ok(['clinical', 'basic'].includes(sim.round.subtype));
    playRoundCaught(sim);
    sim.must({ type: 'NEXT_ROUND', playerId: sim.state.hostId });
    if (r < 4) sim.ackAll();
  }
  assert.equal(String(sim.phase.kind), 'matchEnd');
  assert.equal(new Set(sim.state.usedPairIds).size, 5);
});
