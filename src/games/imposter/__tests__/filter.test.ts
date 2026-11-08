import assert from 'node:assert/strict';
import { test } from 'node:test';

import bankJson from '../data/pairs.json';
import { PROFANITY } from '../engine/filter';
import type { WordBank } from '../engine/types';

const bank = bankJson as unknown as WordBank;

test('filter: no word or alternative in the bank is ever blocked', () => {
  const blocked = bank.pairs.flatMap((p) => [p.a, p.b]).flatMap((e) => [e.word, ...e.alts]).filter((w) => PROFANITY.isProfane(w));
  assert.deepEqual(blocked, []);
});

test('filter: real profanity is blocked, stretched or plural, and medical words pass', () => {
  for (const w of ['shit', 'shiiiit', 'bitches', 'Fuck']) assert.equal(PROFANITY.isProfane(w), true, w);
  for (const w of ['penis', 'vagina', 'anus', 'testicle', 'labia', 'bloody', 'cox', 'are', 'hit']) assert.equal(PROFANITY.isProfane(w), false, w);
});
