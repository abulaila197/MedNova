/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import words from '../data/words.json';

// #19 (Yazan 2026-11-04): a specimen note must never hold its own word or the word's root (CRYPT in "the crypts of…").
test('no specimen note gives its word away', () => {
  const bad: string[] = [];
  for (const w of words as { id: string; word: string; definition: string }[]) {
    const word = w.word.toUpperCase();
    const base = word.replace(/(ES|S|E)$/, '');
    const head = word.slice(0, Math.min(5, word.length));
    const tokens = w.definition.toUpperCase().match(/[A-Z]+/g) ?? [];
    const hit = tokens.find(
      (t) => t.includes(base) || t.startsWith(head) || (base.length >= 4 && t.length >= 4 && t.startsWith(base.slice(0, 4))) || (t.length >= 5 && word.includes(t)),
    );
    if (hit) bad.push(`${w.id} ${word}: "${hit}"`);
  }
  assert.deepEqual(bad, []);
});
