/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rank } from '../../engine/standings';
import { currentCase, currentSeat, dpTieBreak, offlineRows, startOffline, stepOffline, timeLeft, TURN_MS } from '../offline';

const ids = ['a', 'b', 'c', 'd', 'e', 'f'];

test('offline: each player has their own case each round, in the shuffled order', () => {
  const r = startOffline([2, 0, 1], 2, ids);
  assert.equal(r.phase, 'handoff');
  assert.equal(currentSeat(r), 2);
  assert.deepEqual([r.cases['0:2'], r.cases['0:0'], r.cases['0:1'], r.cases['1:2']], ['a', 'b', 'c', 'd']);
  assert.equal(new Set(Object.values(r.cases)).size, 6);
});

test('offline: 90 s turn, clock waits for Ready, pause stops it, time up closes the turn', () => {
  let r = startOffline([0, 1], 1, ids);
  assert.equal(timeLeft(r, 999_999), TURN_MS);
  r = stepOffline(r, { type: 'READY', now: 1_000 });
  r = stepOffline(r, { type: 'PAUSE', now: 31_000 });
  assert.equal(timeLeft(r, 500_000), 60_000);
  r = stepOffline(r, { type: 'RESUME', now: 500_000 });
  r = stepOffline(r, { type: 'TICK', now: 559_000 });
  assert.equal(r.phase, 'playing');
  r = stepOffline(r, { type: 'TICK', now: 560_000 });
  assert.equal(r.phase, 'turnOver');
  assert.equal(r.results[0].outcome, 'timed_out');
  assert.equal(r.results[0].points, 0);
});

test('offline: solo scoring, turns rotate, game ends after the last round', () => {
  let r = startOffline([0, 1], 2, ids);
  const play = (accepted: boolean, at: number) => {
    r = stepOffline(r, { type: 'READY', now: at });
    r = stepOffline(r, accepted ? { type: 'GUESS', answerId: 'x', accepted: true, now: at + 10_000 } : { type: 'SKIP', now: at + 5_000 });
    r = stepOffline(r, { type: 'NEXT', now: at + 20_000 });
  };
  play(true, 0); // seat 0: 100 + 20
  assert.equal(currentSeat(r), 1);
  play(false, 100_000);
  assert.equal(r.round, 1);
  assert.equal(currentCase(r), 'c');
  play(true, 200_000);
  play(true, 300_000);
  assert.equal(r.phase, 'done');
  const rows = offlineRows(r, { 0: 'You', 1: 'Sam' });
  assert.deepEqual(rows.map((x) => x.score), [240, 120]);
});

test('offline: removing the player on turn skips them; the owner and the last two stay', () => {
  let r = startOffline([0, 1, 2], 2, ids);
  r = stepOffline(r, { type: 'READY', now: 0 });
  r = stepOffline(r, { type: 'SKIP', now: 1 });
  r = stepOffline(r, { type: 'NEXT', now: 2 });
  assert.equal(currentSeat(r), 1);
  r = stepOffline(r, { type: 'REMOVE', seat: 1, now: 3 });
  assert.equal(currentSeat(r), 2);
  assert.equal(r.phase, 'handoff');
  assert.equal(stepOffline(r, { type: 'REMOVE', seat: 2, now: 4 }), r);
});

test('offline ties: total time first (rule 13), then more speed bonus, then fewer wrong guesses', () => {
  const rows = [
    { seat: 0, name: 'A', score: 100, timeMs: 50_000, speed: 10, wrong: 2 },
    { seat: 1, name: 'B', score: 100, timeMs: 50_000, speed: 10, wrong: 1 },
    { seat: 2, name: 'C', score: 100, timeMs: 40_000, speed: 0, wrong: 5 },
  ];
  const m = new Map(rows.map((x) => [x.seat, x]));
  const st = rank(rows, (a, b) => dpTieBreak(m.get(a.seat)!, m.get(b.seat)!));
  assert.deepEqual(st.map((x) => x.name), ['C', 'B', 'A']);
});
