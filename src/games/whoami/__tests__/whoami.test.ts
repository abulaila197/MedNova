/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DP, cluePoints, guess, maxCasePoints, newAttempt, reveal, search } from '../../diagnostic/core';
import { startOffline, stepOffline } from '../../diagnostic/offline';
import { startRun, step } from '../../diagnostic/solo';
import { CASES, CATEGORIES, GUESSES, INDEX, PUZZLES, caseById, nearMisses, poolOf, slug } from '../data';
import { WAI } from '../rules';


test('the bank: 320 puzzles, 40 in each category, 5 clues, a type and a key fact', () => {
  assert.equal(PUZZLES.length, 320);
  for (const cat of CATEGORIES) assert.equal(PUZZLES.filter((p) => p.cat === cat).length, 40, cat);
  const ids = new Set<string>();
  for (const p of PUZZLES) {
    assert.ok(!ids.has(p.id), `${p.id} twice`);
    ids.add(p.id);
    assert.equal(p.clues.length, 5, p.answer);
    assert.ok(p.type && p.fact, p.answer);
    assert.ok(p.aliases.length <= 2, p.answer);
  }
});

test('the bank: answers are unique, and no clue says the answer or one of its other names', () => {
  const names = new Map<string, string>();
  for (const p of PUZZLES) {
    for (const n of [p.answer, ...p.aliases]) {
      const k = n.toLowerCase();
      assert.ok(!names.has(k), `${n} is used by ${names.get(k)} too`);
      names.set(k, p.answer);
      const re = new RegExp(`\\b${n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      p.clues.forEach((c, i) => assert.ok(!re.test(c.toLowerCase()), `${p.answer}: clue ${i + 1} says "${n}"`));
    }
  }
});

test('typing finds every answer by its name and by its other names', () => {
  assert.equal(GUESSES.filter((g) => g.answer).length, 320);
  for (const p of PUZZLES) {
    const c = caseById.get(p.id)!;
    for (const n of [p.answer, ...p.aliases]) assert.ok(search(INDEX, n).some((g) => g.id === c.answer_id), `"${n}" doesn't find ${p.answer}`);
  }
});

test('categories filter the pool; rivals guess wrong inside the same category', () => {
  assert.equal(poolOf(null).length, 320);
  assert.equal(poolOf(['Anatomy', 'Embryology']).length, 80);
  const c = CASES[0];
  let i = 0;
  const wrong = nearMisses(c, (n) => i++ % n, 4);
  assert.equal(wrong.length, 4);
  const own = PUZZLES[0].decoys.map(slug);
  for (const id of wrong) {
    assert.notEqual(id, c.answer_id);
    assert.ok(own.includes(id) || CASES.some((x) => x.answer_id === id && x.fields[0] === c.fields[0]));
  }
  assert.ok(own.every((d) => wrong.includes(d)), 'its own 3 distractors come first');
});

test('every answer brings 3 distractors to the guess list, none an answer, none twice', () => {
  const answers = new Set(PUZZLES.flatMap((p) => [p.answer, ...p.aliases].map(slug)));
  const all = PUZZLES.flatMap((p) => p.decoys.map(slug));
  assert.ok(PUZZLES.every((p) => p.decoys.length === 3));
  assert.equal(new Set(all).size, 960);
  assert.ok(all.every((d) => !answers.has(d)));
  assert.equal(GUESSES.filter((g) => !g.answer).length, 960);
  assert.ok(search(INDEX, 'Tibia').some((g) => g.label === 'Tibia' && !g.answer));
});

test('Who am I? rules: 5 clues, 100 to 20 points, a 5th wrong guess ends the puzzle', () => {
  assert.equal(cluePoints(1, WAI), 100);
  assert.equal(cluePoints(5, WAI), 20);
  assert.equal(maxCasePoints(WAI), 120);
  let a = newAttempt();
  for (let k = 0; k < 4; k++) a = guess(a, `x${k}`, false, WAI).attempt;
  assert.equal(a.cluesShown, 5);
  assert.equal(reveal(a, WAI), a, 'no 6th clue');
  assert.equal(guess(a, 'x9', false, WAI).outcome, 'wrong_out');
});

test('Race to Diagnosis keeps its own rules when no rules are passed (6 clues, 10 points on the last)', () => {
  assert.equal(DP.clueCount, 6);
  let a = newAttempt();
  for (let k = 0; k < 5; k++) a = guess(a, `x${k}`, false).attempt;
  assert.equal(a.cluesShown, 6);
  assert.equal(a.status, 'active');
  assert.equal(cluePoints(6), 10);
  assert.equal(guess(a, 'x9', false).outcome, 'wrong_out');
});

test('a Solo run and a Pass the phone turn score with the rules they are given', () => {
  const ids = poolOf(null).slice(0, 3);
  let r = startRun(ids, 0);
  r = step(r, { type: 'REVEAL' }, WAI);
  r = step(r, { type: 'GUESS', answerId: caseById.get(ids[0])!.answer_id, accepted: true, now: 10_000 }, WAI);
  assert.equal(r.results[0].cluePoints, 80);
  assert.equal(r.results[0].points, 100);

  let o = startOffline([0, 1], 1, ids);
  o = stepOffline(o, { type: 'READY', now: 0 }, WAI);
  for (let k = 0; k < 4; k++) o = stepOffline(o, { type: 'GUESS', answerId: `x${k}`, accepted: false, now: 1000 }, WAI);
  assert.equal(o.attempt.cluesShown, 5);
  o = stepOffline(o, { type: 'GUESS', answerId: 'x9', accepted: false, now: 2000 }, WAI);
  assert.equal(o.results[0].outcome, 'wrong');
});
