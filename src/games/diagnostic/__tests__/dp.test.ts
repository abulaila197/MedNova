/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, cluePoints, guess, guessesLeft, MAX_CASE_POINTS, newAttempt, reveal, search, speedBonus } from '../core';
import { elapsed, snapshot, startRun, step } from '../solo';

test('scoring matches the original config', () => {
  assert.equal(cluePoints(1), 100);
  assert.equal(cluePoints(6), 10);
  assert.equal(speedBonus(30_000), 20);
  assert.equal(speedBonus(75_000), 10);
  assert.equal(speedBonus(120_000), 0);
  assert.equal(MAX_CASE_POINTS, 120);
});

test('attempt: wrong shows next clue, duplicate ignored, 6th wrong fails', () => {
  let a = newAttempt();
  for (let i = 0; i < 5; i++) a = guess(a, `x${i}`, false).attempt;
  assert.equal(a.cluesShown, 6);
  assert.equal(guess(a, 'x0', false).outcome, 'ignored');
  const last = guess(a, 'x9', false);
  assert.equal(last.outcome, 'wrong_out');
  assert.equal(last.attempt.status, 'failed');
});

test('attempt: each revealed clue uses up one guess', () => {
  let a = reveal(reveal(newAttempt()));
  assert.equal(guessesLeft(a), 4);
  for (let i = 0; i < 3; i++) a = guess(a, `x${i}`, false).attempt;
  assert.equal(a.cluesShown, 6);
  assert.equal(guessesLeft(a), 1);
  const last = guess(a, 'x9', false);
  assert.equal(last.outcome, 'wrong_out');
  assert.equal(last.attempt.wrong.length, 4);
  // every clue revealed by button: one guess left
  let b = newAttempt();
  for (let i = 0; i < 5; i++) b = reveal(b);
  assert.equal(guessesLeft(b), 1);
  assert.equal(guess(b, 'y', false).outcome, 'wrong_out');
});

test('solo run: solve, skip, pause keeps clock, done after last case', () => {
  let r = startRun(['c1', 'c2'], 0);
  r = step(r, { type: 'GUESS', answerId: 'w', accepted: false, now: 5_000 });
  r = step(r, { type: 'PAUSE', now: 10_000 });
  r = step(r, { type: 'RESUME', now: 60_000 });
  assert.equal(elapsed(r, 70_000), 20_000, 'paused time does not count');
  r = step(r, { type: 'GUESS', answerId: 'a', accepted: true, now: 70_000 });
  assert.equal(r.phase, 'caseOver');
  assert.equal(r.results[0].points, 80 + 20);
  r = step(r, { type: 'NEXT', now: 71_000 });
  r = step(r, { type: 'SKIP', now: 80_000 });
  assert.equal(r.results[1].outcome, 'skipped');
  assert.equal(r.results[1].points, 0);
  r = step(r, { type: 'NEXT', now: 81_000 });
  assert.equal(r.phase, 'done');
  assert.equal(r.score, 100);
});

test('snapshot saves a paused run at the exact clock', () => {
  const r = startRun(['c1'], 1_000);
  const s = snapshot(r, 13_000);
  assert.equal(s.phase, 'paused');
  assert.equal(s.elapsedMs, 12_000);
  const back = step(s, { type: 'RESUME', now: 500_000 });
  assert.equal(elapsed(back, 503_000), 15_000);
});

test('search: prefix, alias, min 2 letters, max 5', () => {
  const idx = buildIndex([
    { id: 'mi', label: 'Myocardial Infarction', aliases: ['MI', 'Heart attack'], answer: true, canonical_id: 'x' },
    { id: 'my', label: 'Myasthenia Gravis', aliases: [], answer: false, canonical_id: null },
  ]);
  assert.deepEqual(search(idx, 'm'), []);
  assert.deepEqual(search(idx, 'my').map((e) => e.id), ['my', 'mi']);
  assert.deepEqual(search(idx, 'heart').map((e) => e.id), ['mi']);
});
