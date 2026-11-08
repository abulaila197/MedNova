import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProfanityChecker } from '../engine/profanity';
import { validateClue } from '../engine/clues';
import { isCorrectGuess } from '../engine/wordMatch';
import { MEDICAL_ALLOWLIST } from '../engine/medicalAllowlist';
import { profanity } from './helpers';

test('profanity: whole word only, final s ignored, stretched spellings caught', () => {
  assert.equal(profanity.isProfane('foobar'), true);
  assert.equal(profanity.isProfane('FooBars'), true);
  assert.equal(profanity.isProfane('fooooobar'), true);
  assert.equal(profanity.isProfane('foobaaaar'), true);
  assert.equal(profanity.isProfane('analysis'), false); // "anal" is on the list but never matches inside a word
  assert.equal(profanity.isProfane('unfoobared'), false);
  assert.equal(profanity.isProfane('hello'), false);
});

test('profanity: the medical allowlist wins over the blocklist', () => {
  assert.equal(profanity.isProfane('anus'), false);
  assert.equal(profanity.isProfane('anal'), true);
  const strict = createProfanityChecker({ blocklist: ['rectum', 'breast'], allowlist: MEDICAL_ALLOWLIST });
  assert.equal(strict.isProfane('rectum'), false);
  assert.equal(strict.isProfane('breasts'), false);
});

const own = { word: 'Tuberculosis', alts: ['TB', 'phthisis', 'red blood cell'] };
const ctx = (prior: (string | null)[] = []) => ({ own, prior, profanity });

test('clue format: letters only, 1 to 15 letters', () => {
  assert.equal(validateClue('', ctx()).ok, false);
  assert.equal(validateClue('two words', ctx()).ok, false);
  assert.equal(validateClue('x-ray', ctx()).ok, false);
  assert.equal(validateClue('b12', ctx()).ok, false);
  assert.equal(validateClue('abcdefghijklmnop', ctx()).ok, false); // 16 letters
  assert.equal(validateClue('abcdefghijklmno', ctx()).ok, true); // 15 letters
  assert.equal(validateClue('  cough  ', ctx()).ok, true);
});

test('clue: own word, synonyms, abbreviations and plurals are blocked', () => {
  const code = (t: string, prior: (string | null)[] = []) => { const r = validateClue(t, ctx(prior)); return r.ok ? 'ok' : r.code; };
  assert.equal(code('tuberculosis'), 'clue/ownWord');
  assert.equal(code('TB'), 'clue/ownWord');
  assert.equal(code('tbs'), 'clue/ownWord'); // abbreviation + final s
  assert.equal(code('phthisis'), 'clue/ownWord');
  assert.equal(code('redbloodcell'), 'clue/ownWord'); // spaces in an accepted alternative are ignored
  assert.equal(code('cough'), 'ok');
});

test('clue: duplicates ignore capitals and a final s; empty clues are ignored', () => {
  const code = (t: string, prior: (string | null)[]) => { const r = validateClue(t, ctx(prior)); return r.ok ? 'ok' : r.code; };
  assert.equal(code('cough', ['Cough']), 'clue/duplicate');
  assert.equal(code('coughs', ['cough']), 'clue/duplicate');
  assert.equal(code('cough', ['coughs']), 'clue/duplicate');
  assert.equal(code('cough', [null]), 'ok');
});

test('clue: profanity is rejected', () => {
  const r = validateClue('foobar', ctx());
  assert.deepEqual(r, { ok: false, code: 'clue/profanity' });
});

const tb = { word: 'Tuberculosis', alts: ['TB', 'phthisis'] };
const pn = { word: 'Pneumonia', alts: [] };
test('redemption guess: typo tolerance 2 / 1 / exact and accepted alternatives', () => {
  assert.equal(isCorrectGuess('tuberculosis', tb, pn), true);
  assert.equal(isCorrectGuess('tubercolosis', tb, pn), true); // 1 typo
  assert.equal(isCorrectGuess('tuberkolosis', tb, pn), true); // 2 typos, 8+ letters
  assert.equal(isCorrectGuess('tuberkolasis', tb, pn), false); // 3 typos
  assert.equal(isCorrectGuess('tb', tb, pn), true);
  assert.equal(isCorrectGuess('tc', tb, pn), false); // short words are exact
  assert.equal(isCorrectGuess('pneumonia', tb, pn), false); // the imposter's own word is wrong
  const as = { word: 'Asthma', alts: [] }; // 6 letters: 1 typo
  const pe = { word: 'Pulmonary embolism', alts: ['PE'] };
  assert.equal(isCorrectGuess('asthmo', as, pe), true);
  assert.equal(isCorrectGuess('astmo', as, pe), false);
  const cxr = { word: 'Chest X-ray', alts: ['CXR'] };
  assert.equal(isCorrectGuess('chest xray', cxr, pe), true); // spaces and hyphens are ignored
});

test('redemption guess: a typo can never turn the other word into a correct answer', () => {
  const a = { word: 'Hepatitis', alts: [] };
  const b = { word: 'Hepatitis B', alts: [] };
  assert.equal(isCorrectGuess('hepatitis', a, b), true);
  assert.equal(isCorrectGuess('hepatitis b', a, b), false);
});
