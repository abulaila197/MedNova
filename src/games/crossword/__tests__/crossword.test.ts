/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { CW, buildSlots, cellKey, composeAnswer, indexOf, isFilled, isUnlocked, levelExp, lockedCells, pickHintCells, placeLetter, removeSlot, startSolo, starsFor, stepSolo, validatePuzzle, type PuzzleDef } from '../core';
import { currentSeat, offlineRecap, startOffline, stepOffline } from '../offline';

const PUZZLES = JSON.parse(readFileSync('src/games/crossword/data/puzzles.json', 'utf8')) as PuzzleDef[];
const IMAGE_KEYS = new Set([...readFileSync('src/games/crossword/data/images.ts', 'utf8').matchAll(/^  (\w+): require/gm)].map((m) => m[1]));

// CAT across at row 0; COW down from C; TOE down from T. CAT's every cell is not crossed (A is free).
const P: PuzzleDef = {
  id: 't', level: 1, rows: 3, cols: 3,
  words: [
    { id: 'cat', answer: 'CAT', direction: 'across', start: { r: 0, c: 0 }, category: 'x', question: { kind: 'text', text: 'q' } },
    { id: 'cow', answer: 'COW', direction: 'down', start: { r: 0, c: 0 }, category: 'x', question: { kind: 'text', text: 'q' } },
    { id: 'toe', answer: 'TOE', direction: 'down', start: { r: 0, c: 2 }, category: 'x', question: { kind: 'text', text: 'q' } },
  ],
};

test('all 70 bundled puzzles are valid: letters agree at every crossing, no word fully crossed', () => {
  assert.equal(PUZZLES.length, 70);
  for (const p of PUZZLES) assert.deepEqual(validatePuzzle(p), [], p.id);
  // Array order is play order (publish task 1): place = level = the online puzzle number (cw_words.n).
  PUZZLES.forEach((p, i) => assert.equal(p.level, i + 1, p.id));
  assert.equal(new Set(PUZZLES.map((p) => p.id)).size, 70);
  // The 19 puzzles added last (cw-32 to cw-50) never repeat an answer among themselves.
  const late = PUZZLES.filter((p) => Number(p.id.slice(3)) > 31).flatMap((p) => p.words.map((w) => w.answer));
  assert.equal(new Set(late).size, late.length);
  // The 20 photo puzzles (cw-51 to cw-70) repeat no answer from any older puzzle or among themselves,
  // and each has one Identify picture, except cw-63 (no picture, Yazan 2026-11-09).
  const older = new Set(PUZZLES.slice(0, 50).flatMap((p) => p.words.map((w) => w.answer)));
  const fresh = PUZZLES.slice(50).flatMap((p) => p.words.map((w) => w.answer));
  assert.equal(new Set(fresh).size, fresh.length);
  fresh.forEach((a) => assert.ok(!older.has(a), a));
  PUZZLES.slice(50).forEach((p) => assert.equal(p.words.filter((w) => w.question.kind === 'image').length, p.id === 'cw-63' ? 0 : 1, p.id));
  // Every picture clue has its image registered.
  PUZZLES.flatMap((p) => p.words).forEach((w) => w.question.kind === 'image' && assert.ok(IMAGE_KEYS.has(w.question.imageKey), w.answer));
  assert.ok(PUZZLES.find((p) => p.id === 'cw-18')!.words.some((w) => w.answer === 'EPILEPSY'));
});

test('popup: letters fill the first open slot, a tap clears it, locked slots keep their letter', () => {
  const idx = indexOf(P);
  const slots = buildSlots(idx, 'cow', lockedCells(idx, ['cat']));
  assert.equal(slots[0].letter, 'C');
  let t = [null, null, null] as (string | null)[];
  t = placeLetter(slots, t, 'O')!;
  t = placeLetter(slots, t, 'X')!;
  assert.equal(placeLetter(slots, t, 'Y'), null);
  assert.ok(isFilled(slots, t));
  assert.equal(composeAnswer(slots, t), 'COX');
  t = removeSlot(slots, t, 2);
  assert.ok(!isFilled(slots, t));
  assert.equal(removeSlot(slots, t, 0), t);
});

test('stars (CW2), unlocks and EXP (CW9)', () => {
  assert.equal(starsFor(10, 10), 3);
  assert.equal(starsFor(10, 9), 2);
  assert.equal(starsFor(10, 8), 1);
  assert.equal(starsFor(10, 7), 0);
  assert.ok(isUnlocked(1, {}));
  assert.ok(!isUnlocked(2, { 1: 0 }));
  assert.ok(isUnlocked(2, { 1: 1 }));
  assert.equal(levelExp(3, 0), 12);
  assert.equal(levelExp(3, 2), 4);
  assert.equal(levelExp(1, 3), 0);
});

test('hint (CW4): a third of the empty letters, never the last one', () => {
  const idx = indexOf(PUZZLES[1]);
  const long = PUZZLES[1].words.find((w) => w.answer === 'PHOSPHORYLATION')!;
  assert.equal(pickHintCells(idx, long.id, new Set(), () => 0.3).length, 5);
  const cells = idx.cellsOf.get(long.id)!.map(cellKey);
  assert.deepEqual(pickHintCells(idx, long.id, new Set(cells.slice(1))), []);
  assert.equal(pickHintCells(idx, long.id, new Set(cells.slice(2))).length, 1);
});

test('solo: wrong costs a heart, repeats are free, 0 hearts is out, revive gives 1, crossings auto-solve', () => {
  let r = startSolo('t');
  r = stepSolo(P, r, { type: 'SUBMIT', wordId: 'cow', answer: 'COX' });
  r = stepSolo(P, r, { type: 'SUBMIT', wordId: 'cow', answer: 'COX' });
  assert.equal(r.hearts, CW.hearts - 1);
  for (const a of ['CAB', 'CAD', 'CAN', 'CAP'].slice(0, CW.hearts - 1)) r = stepSolo(P, r, { type: 'SUBMIT', wordId: 'cat', answer: a });
  assert.equal(r.phase, 'out');
  assert.equal(stepSolo(P, r, { type: 'SUBMIT', wordId: 'cat', answer: 'CAT' }), r);
  r = stepSolo(P, r, { type: 'REVIVE' });
  assert.equal(r.hearts, 1);
  r = stepSolo(P, r, { type: 'SUBMIT', wordId: 'cat', answer: 'CAT' });
  r = stepSolo(P, r, { type: 'SUBMIT', wordId: 'cow', answer: 'COW' });
  // TOE: T shows from CAT; reveal O by hint, then E is the last and stays open.
  r = stepSolo(P, r, { type: 'HINT', cells: ['1,2'] });
  assert.equal(r.phase, 'playing');
  r = stepSolo(P, r, { type: 'SUBMIT', wordId: 'toe', answer: 'TOE' });
  assert.equal(r.phase, 'done');
  assert.equal(r.left, false);
});

test('offline: right scores the length and passes, wrong costs a heart, one revive, then out', () => {
  let o = startOffline('t', [0, 1], () => 0);
  const first = currentSeat(o);
  const other = first === 0 ? 1 : 0;
  o = stepOffline(P, o, { type: 'READY' });
  o = stepOffline(P, o, { type: 'SUBMIT', wordId: 'cat', answer: 'CAT' });
  assert.equal(o.players[first].score, 3);
  assert.equal(currentSeat(o), other);
  assert.equal(o.phase, 'handoff');
  // other burns all their hearts across their turns (first passes by closing)
  for (let i = 0; i < CW.hearts; i++) {
    o = stepOffline(P, o, { type: 'READY' });
    o = stepOffline(P, o, { type: 'SUBMIT', wordId: 'cow', answer: `CO${'ABCDE'[i]}` });
    if (i < CW.hearts - 1) {
      o = stepOffline(P, o, { type: 'READY' });
      o = stepOffline(P, o, { type: 'CLOSE' });
    }
  }
  assert.equal(o.phase, 'revive');
  o = stepOffline(P, o, { type: 'REVIVE' });
  assert.equal(o.players[other].hearts, 1);
  o = stepOffline(P, o, { type: 'READY' });
  o = stepOffline(P, o, { type: 'CLOSE' });
  o = stepOffline(P, o, { type: 'READY' });
  o = stepOffline(P, o, { type: 'SUBMIT', wordId: 'cow', answer: 'COZ' });
  assert.ok(o.players[other].out);
  const play = { seats: [{ seat: 0, name: 'Yazan', color: '#fff' }, { seat: 1, name: 'Sara', color: '#000' }], settings: {} } as never;
  const lines = offlineRecap(P, o, first, play).map((l) => l.text);
  assert.ok(lines.some((t) => t.endsWith('is out of hearts')));
  // Only the first player is left: they finish the grid.
  o = stepOffline(P, o, { type: 'READY' });
  o = stepOffline(P, o, { type: 'SUBMIT', wordId: 'cow', answer: 'COW' });
  o = stepOffline(P, o, { type: 'READY' });
  o = stepOffline(P, o, { type: 'SUBMIT', wordId: 'toe', answer: 'TOE' });
  assert.equal(o.phase, 'done');
  assert.equal(o.players[first].score, 9);
});
