import assert from 'node:assert/strict';
import { test } from 'node:test';
import termsJson from '../data/terms.json';
import { newBoard, pickTerms, termsClash } from '../engine/board';
import { seededRng } from '../engine/random';
import type { Term } from '../engine/types';

const TERMS = termsJson as Term[];

test('the bank: the clinical + basic science counts, unique ids and words, one word each', () => {
  assert.equal(TERMS.filter((t) => t.style === 'clinical').length, 595);
  assert.equal(TERMS.filter((t) => t.style === 'basic').length, 605);
  assert.equal(new Set(TERMS.map((t) => t.id)).size, TERMS.length);
  assert.equal(new Set(TERMS.map((t) => t.term.toLowerCase())).size, TERMS.length);
  for (const t of TERMS) assert.match(t.term, /^[A-Za-z]+$/, t.term);
});

test('no two words in the bank contain one another', () => {
  for (let i = 0; i < TERMS.length; i++) for (let j = i + 1; j < TERMS.length; j++) assert.ok(!termsClash(TERMS[i].term, TERMS[j].term), `${TERMS[i].term} / ${TERMS[j].term}`);
});

test('every style fills a board', () => {
  for (const style of ['clinical', 'basic', 'mixed'] as const) {
    for (let seed = 1; seed <= 20; seed++) assert.equal(pickTerms(TERMS, style, seededRng(seed)).length, 25);
    assert.equal(newBoard(TERMS, style, seededRng(3)).cards.length, 25);
  }
});

test('every board has at least three field groups of 3 or more words (Yazan 2026-11-02)', () => {
  const shapes = new Set<string>();
  for (const style of ['clinical', 'basic', 'mixed'] as const) {
    for (let seed = 1; seed <= 200; seed++) {
      const picked = pickTerms(TERMS, style, seededRng(seed));
      assert.equal(new Set(picked.map((t) => t.id)).size, 25);
      const per = new Map<string, number>();
      for (const t of picked) per.set(t.field, (per.get(t.field) ?? 0) + 1);
      const groups = [...per.values()].filter((n) => n >= 2).sort((a, b) => b - a);
      assert.ok(groups.filter((n) => n >= 3).length >= 3, `${style} seed ${seed}: ${groups}`);
      shapes.add(groups.join('+'));
    }
  }
  assert.ok(shapes.size > 20, 'the group sizes change from game to game');
});
