/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { levelExp, retryCap, search, startLevel, starsFor, stepLevel, type Answer } from '../core';
import { LOCK_MS, currentSeat, lockLeft, offlineRows, previousLine, scorePhoto, startOffline, stepOffline } from '../offline';
import { fullName } from '../../shell/names';

const guess = (l: ReturnType<typeof startLevel>, answerId: string, now: number) => stepLevel(l, { type: 'GUESS', answerId, now });

test('stars (RD4): 3 = 30 s and 0 wrong; 2 = 60 s and at most 1 wrong; else 1; hint caps at 2', () => {
  assert.equal(starsFor(30_000, 0, false), 3);
  assert.equal(starsFor(31_000, 0, false), 2);
  assert.equal(starsFor(20_000, 1, false), 2);
  assert.equal(starsFor(61_000, 0, false), 1);
  assert.equal(starsFor(20_000, 2, false), 1);
  assert.equal(starsFor(10_000, 0, true), 2);
});

test('EXP (RD9, RD10): 4 per star; a replay pays only stars above the best', () => {
  assert.equal(levelExp(3, 0), 12);
  assert.equal(levelExp(3, 2), 4);
  assert.equal(levelExp(2, 3), 0);
});

test('a level: wrong picks cost a life, repeats are free, 3 wrong fails, right solves with the clock', () => {
  let l = startLevel('r-001', 0);
  l = guess(l, 'r-002', 5_000);
  l = guess(l, 'r-002', 6_000);
  assert.equal(l.wrong.length, 1);
  l = stepLevel(l, { type: 'PAUSE', now: 10_000 });
  l = stepLevel(l, { type: 'RESUME', now: 100_000 });
  l = guess(l, 'r-001', 115_000);
  assert.deepEqual([l.phase, l.timeMs, l.stars], ['solved', 25_000, 2]);
  let f = startLevel('r-001', 0);
  for (const id of ['r-002', 'r-003', 'r-004']) f = guess(f, id, 1000);
  assert.equal(f.phase, 'failed');
});

test('search: nothing under 2 letters, label prefix first, skips wrong picks', () => {
  const list: Answer[] = [{ id: 'a', label: 'Rabies' }, { id: 'b', label: 'Raccoon eyes' }, { id: 'c', label: 'Hemophilia B', aliases: ['Christmas disease'] }];
  assert.deepEqual(search(list, 'r'), []);
  assert.deepEqual(search(list, 'ra').map((a) => a.id), ['a', 'b']);
  assert.deepEqual(search(list, 'christ').map((a) => a.id), ['c']);
  assert.deepEqual(search(list, 'ra', ['a']).map((a) => a.id), ['b']);
});

test('names: up to 2 other names in brackets, only those count, a missing \'s does not matter', () => {
  const list: Answer[] = [
    { id: 'cd', label: 'Crohn disease', aliases: ['Regional enteritis'] },
    { id: 'mi', label: 'Myocardial infarction', aliases: ['MI', 'Heart attack', 'Coronary thrombosis'] },
    { id: 'se', label: "Otitis externa", aliases: ["Swimmer's ear"] },
  ];
  assert.equal(fullName(list[1]), 'Myocardial infarction (MI, Heart attack)');
  assert.equal(fullName(list[0]), 'Crohn disease (Regional enteritis)');
  for (const q of ["crohn's", 'crohns', 'crohn', "Crohn's disease"]) assert.deepEqual(search(list, q).map((a) => a.id), ['cd'], q);
  assert.deepEqual(search(list, 'heart att').map((a) => a.id), ['mi']);
  assert.deepEqual(search(list, 'coronary thr'), []);
  assert.deepEqual(search(list, 'swimmers ear').map((a) => a.id), ['se']);
  assert.deepEqual(search(list, 'swimmer ear').map((a) => a.id), ['se']);
});

test('photo scoring (RD5): 100, 80... by time, ties share, bonus up to 50, time out 0', () => {
  const s = scorePhoto([
    { seat: 0, solved: true, timeMs: 30_000, wrong: [] },
    { seat: 1, solved: true, timeMs: 10_000, wrong: ['x'] },
    { seat: 2, solved: true, timeMs: 30_000, wrong: [] },
    { seat: 3, solved: false, timeMs: 60_000, wrong: [] },
  ], 60_000);
  assert.deepEqual(s.map((x) => [x.rank, x.points]), [[2, 105], [1, 142], [2, 105], [null, 0]]);
});

test('offline: same picture in turn, 5 s lock after a wrong guess, hand-off line, then the next picture', () => {
  let r = startOffline([1, 0], ['r-001', 'r-002'], 60_000);
  r = stepOffline(r, { type: 'READY', now: 0 });
  r = stepOffline(r, { type: 'GUESS', answerId: 'r-005', now: 1000 });
  assert.equal(lockLeft(r, 2000), LOCK_MS - 1000);
  r = stepOffline(r, { type: 'GUESS', answerId: 'r-001', now: 3000 });
  assert.equal(r.phase, 'playing', 'locked guesses are ignored');
  r = stepOffline(r, { type: 'GUESS', answerId: 'r-001', now: 7000 });
  assert.deepEqual([r.phase, currentSeat(r)], ['handoff', 0]);
  assert.equal(previousLine(r, { 1: 'Omar' }, (ms) => `${ms / 1000}s`), 'Omar solved it in 7s');
  r = stepOffline(r, { type: 'READY', now: 10_000 });
  r = stepOffline(r, { type: 'TICK', now: 71_000 });
  assert.equal(r.phase, 'photoOver');
  r = stepOffline(r, { type: 'NEXT' });
  assert.deepEqual([r.phase, r.index, currentSeat(r)], ['handoff', 1, 1]);
  const rows = offlineRows(r, { 0: 'Me', 1: 'Omar' });
  assert.deepEqual(rows.map((x) => [x.seat, x.score]), [[1, 144], [0, 0]]);
});

test('offline: removing the player on turn drops their turn and hands to the next', () => {
  let r = startOffline([0, 1, 2], ['r-001'], 30_000);
  r = stepOffline(r, { type: 'READY', now: 0 });
  r = stepOffline(r, { type: 'GUESS', answerId: 'r-001', now: 2000 });
  r = stepOffline(r, { type: 'READY', now: 3000 });
  r = stepOffline(r, { type: 'REMOVE', seat: 1 });
  assert.deepEqual([r.phase, currentSeat(r)], ['handoff', 2]);
  r = stepOffline(r, { type: 'REMOVE', seat: 2 });
  assert.equal(r.removed.length, 1, 'at least 2 players stay');
});

test('a retry after a miss in the same session pays at most 1 star', () => {
  const session = [{ riddleId: 'r-001', solved: false }, { riddleId: 'r-002', solved: true }];
  assert.equal(retryCap(session, 'r-001'), 1);
  assert.equal(retryCap(session, 'r-002'), 3);
  assert.equal(retryCap([], 'r-001'), 3);
  const fast = guess(startLevel('r-001', 0, retryCap(session, 'r-001')), 'r-001', 5_000);
  assert.equal(fast.stars, 1);
  assert.equal(levelExp(fast.stars, 0), 4);
  assert.equal(guess(startLevel('r-001', 0), 'r-001', 5_000).stars, 3);
});
