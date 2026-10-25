import assert from 'node:assert/strict';
import { test } from 'node:test';
import termsJson from '../data/terms.json';
import { tokens, validateClue } from '../engine/clues';
import type { Term } from '../engine/types';

const TERMS = termsJson as Term[];

test('the bank: 500 clinical + 500 basic science, unique ids and names', () => {
  assert.equal(TERMS.filter((t) => t.bank === 'clinical').length, 500);
  assert.equal(TERMS.filter((t) => t.bank === 'basic').length, 500);
  assert.equal(new Set(TERMS.map((t) => t.id)).size, TERMS.length);
  assert.equal(new Set(TERMS.map((t) => tokens(t.name).join(' '))).size, TERMS.length);
});

test('every term has 3 to 5 forbidden single words, none already blocked by the root rules', () => {
  for (const t of TERMS) {
    assert.ok(t.forbidden.length >= 3 && t.forbidden.length <= 5, t.name);
    for (const w of t.forbidden) {
      assert.match(w, /^[\p{L}\p{N}'-]+$/u, `${t.name}: ${w}`);
      // Without the list the word would be a valid clue, so the list adds something.
      assert.ok(validateClue({ ...t, forbidden: [] }, w).ok, `${t.name}: ${w}`);
      assert.equal((validateClue(t, w) as { reason?: string }).reason, 'FORBIDDEN');
    }
  }
});
