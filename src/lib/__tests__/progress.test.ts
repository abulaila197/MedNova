import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyProgress, mergeProgress, sameProgress } from '../progress';

test('stars: the higher count per level wins, levels from both phones are kept', () => {
  assert.deepEqual(mergeProgress('crossword:best', { 1: 3, 2: 1 }, { 2: 2, 5: 1 }), { 1: 3, 2: 2, 5: 1 });
  assert.deepEqual(mergeProgress('riddler:best', null, { a: 2 }), { a: 2 });
});

test('stamps: solved on either phone stays solved', () => {
  assert.deepEqual(mergeProgress('casefiles:played', { c1: 'CLOSED', c2: 'SOLVED' }, { c1: 'SOLVED', c3: 'CLOSED' }), { c1: 'SOLVED', c2: 'SOLVED', c3: 'CLOSED' });
});

test('junk values are dropped and key order does not matter', () => {
  assert.deepEqual(mergeProgress('crossword:best', { 1: 'x' }, { 2: 1 }), { 2: 1 });
  assert.equal(sameProgress({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
  assert.equal(sameProgress({ a: 1 }, { a: 2 }), false);
});

test('streak bests: the higher score per style and length wins', () => {
  assert.deepEqual(mergeProgress('streak:best', { 'mixed:60': 14 }, { 'mixed:60': 9, 'basic:30': 5 }), { 'mixed:60': 14, 'basic:30': 5 });
});

test('learn review: latest Got it wins, Again cards from both phones stay at the end', () => {
  assert.deepEqual(
    mergeProgress('learn:review', { done: { a: 5, b: 1 }, later: ['c'] }, { done: { b: 3 }, later: ['d', 'c'] }),
    { done: { a: 5, b: 3 }, later: ['c', 'd'] },
  );
  assert.deepEqual(mergeProgress('learn:opened', ['x', 'y'], ['y', 'w']), ['w', 'x', 'y']);
  assert.equal(emptyProgress({ done: {}, later: [] }), true);
  assert.equal(emptyProgress([]), true);
  assert.equal(sameProgress({ done: { a: 1, b: 2 }, later: [] }, { later: [], done: { b: 2, a: 1 } }), true);
});
