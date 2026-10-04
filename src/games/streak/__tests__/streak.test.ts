/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { teamLap, teamStandings } from '../../shell/teams';
import { FEEDBACK_MS, maxScore, mixQueue, soloExp, startRound, stepRound, timeLeft, type Round } from '../core';
import { currentSeat, offlineRows, startOffline, stepOffline, COUNTDOWN_MS } from '../offline';

// Every question's right choice is index 0; the display order doesn't matter to the reducer.
const ans = () => 0;
const seq = (n: number) => Array.from({ length: n }, (_, i) => `q${i}`);
const fixed = () => 0.5;
const answer = (r: Round, choice: number, now: number) => stepRound(stepRound(r, { type: 'ANSWER', choice, now }, ans, fixed), { type: 'TICK', now: now + 2000 }, ans, fixed);

test('streak scoring (SM3): the Nth right in a row scores N, a wrong resets to 0', () => {
  let r = startRound(seq(10), 60, 0, fixed);
  r = answer(r, 0, 1000);
  r = answer(r, 0, 4000);
  r = answer(r, 0, 7000);
  assert.deepEqual([r.score, r.streak], [6, 3]);
  r = answer(r, 2, 10_000);
  assert.deepEqual([r.score, r.streak, r.maxStreak], [6, 0, 3]);
  r = answer(r, 0, 13_000);
  assert.equal(r.score, 7);
  assert.equal(r.answers.length, 5);
});

test('the clock stops during feedback and a miss shows longer', () => {
  let r = startRound(seq(5), 60, 0, fixed);
  r = stepRound(r, { type: 'ANSWER', choice: 3, now: 10_000 }, ans, fixed);
  assert.equal(r.phase, 'feedback');
  assert.equal(r.feedback?.untilMs, 10_000 + FEEDBACK_MS.wrong);
  assert.equal(timeLeft(r, 99_000), 50_000);
  r = stepRound(r, { type: 'TICK', now: 10_000 + FEEDBACK_MS.wrong }, ans, fixed);
  assert.equal(r.phase, 'playing');
  assert.equal(r.index, 1);
});

test('time up ends the round; running out of questions ends it too', () => {
  let r = startRound(seq(5), 60, 0, fixed);
  r = stepRound(r, { type: 'TICK', now: 60_000 }, ans, fixed);
  assert.deepEqual([r.phase, r.endReason], ['over', 'time']);
  let s = startRound(seq(1), 60, 0, fixed);
  s = answer(s, 0, 1000);
  assert.deepEqual([s.phase, s.endReason], ['over', 'questions']);
});

test('helpers (SM4): remove 2 wrong once per question, skip keeps the streak, +10 s', () => {
  let r = startRound(seq(5), 60, 0, fixed);
  r = answer(r, 0, 1000);
  r = stepRound(r, { type: 'HELPER', kind: 'remove', now: 3000 }, ans, fixed);
  assert.equal(r.removed.length, 2);
  assert.ok(!r.removed.includes(0));
  const again = stepRound(r, { type: 'HELPER', kind: 'remove', now: 3500 }, ans, fixed);
  assert.equal(again, r);
  assert.equal(stepRound(r, { type: 'ANSWER', choice: r.removed[0], now: 3600 }, ans, fixed), r);
  r = stepRound(r, { type: 'HELPER', kind: 'skip', now: 4000 }, ans, fixed);
  assert.deepEqual([r.index, r.streak, r.score], [2, 1, 1]);
  assert.equal(r.answers[1].outcome, 'skipped');
  const left = timeLeft(r, 5000);
  r = stepRound(r, { type: 'HELPER', kind: 'time', now: 5000 }, ans, fixed);
  assert.equal(timeLeft(r, 5000), left + 10_000);
});

test('pause stops the clock, even mid-feedback', () => {
  let r = startRound(seq(5), 60, 0, fixed);
  r = stepRound(r, { type: 'PAUSE', now: 20_000 }, ans, fixed);
  assert.equal(timeLeft(r, 90_000), 40_000);
  r = stepRound(r, { type: 'RESUME', now: 90_000 }, ans, fixed);
  assert.equal(timeLeft(r, 95_000), 35_000);
  r = stepRound(r, { type: 'ANSWER', choice: 0, now: 95_000 }, ans, fixed);
  r = stepRound(r, { type: 'PAUSE', now: 95_500 }, ans, fixed);
  r = stepRound(r, { type: 'RESUME', now: 200_000 }, ans, fixed);
  assert.equal(r.phase, 'feedback');
  assert.equal(r.feedback?.untilMs, 200_500);
});

test('Solo EXP (SM12) is half the score; mixed is about half and half', () => {
  assert.equal(soloExp(55), 27);
  assert.ok(maxScore(60) > 1000);
  let n = 0;
  const rng = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
  const q = mixQueue(seq(500).map((x) => `c${x}`), seq(500).map((x) => `b${x}`), rng);
  const firstHundred = q.slice(0, 100).filter((x) => x.startsWith('c')).length;
  assert.ok(firstHundred > 35 && firstHundred < 65);
  assert.equal(new Set(q).size, 1000);
});

test('offline (SM5): each player plays their own round in turn, then standings', () => {
  let r = startOffline([1, 0], seq(10), 60);
  assert.equal(currentSeat(r), 1);
  r = stepOffline(r, { type: 'READY', now: 0 }, ans, fixed);
  assert.equal(r.phase, 'countdown');
  r = stepOffline(r, { type: 'TICK', now: COUNTDOWN_MS }, ans, fixed);
  assert.equal(r.phase, 'playing');
  // no helpers offline
  assert.equal(stepOffline(r, { type: 'ROUND', e: { type: 'HELPER', kind: 'time', now: 4000 } }, ans, fixed), r);
  r = stepOffline(r, { type: 'ROUND', e: { type: 'ANSWER', choice: 0, now: 4000 } }, ans, fixed);
  r = stepOffline(r, { type: 'TICK', now: 6000 }, ans, fixed);
  r = stepOffline(r, { type: 'TICK', now: 70_000 }, ans, fixed);
  assert.equal(r.phase, 'turnOver');
  assert.equal(r.results[0].score, 1);
  r = stepOffline(r, { type: 'NEXT' }, ans, fixed);
  assert.equal(currentSeat(r), 0);
  r = stepOffline(r, { type: 'READY', now: 80_000 }, ans, fixed);
  r = stepOffline(r, { type: 'TICK', now: 80_000 + COUNTDOWN_MS }, ans, fixed);
  r = stepOffline(r, { type: 'TICK', now: 200_000 }, ans, fixed);
  r = stepOffline(r, { type: 'NEXT' }, ans, fixed);
  assert.equal(r.phase, 'done');
  const rows = offlineRows(r, { 0: 'You', 1: 'Sara' });
  assert.deepEqual(rows.map((x) => [x.seat, x.score]), [[1, 1], [0, 0]]);
});

test('offline: removing the player on turn skips to the next; at least 2 stay', () => {
  let r = startOffline([0, 1, 2], seq(10), 60);
  r = stepOffline(r, { type: 'NEXT' }, ans, fixed);
  assert.equal(r.turn, 0);
  r = stepOffline(r, { type: 'REMOVE', seat: 0 }, ans, fixed);
  assert.equal(currentSeat(r), 1);
  assert.equal(stepOffline(r, { type: 'REMOVE', seat: 1 }, ans, fixed), r);
});

test('teams (TM5): teams alternate, players in order; uneven teams finish the lap', () => {
  const seats = [
    { seat: 0, name: 'A1', team: 0 }, { seat: 1, name: 'B1', team: 1 }, { seat: 2, name: 'A2', team: 0 },
    { seat: 3, name: 'A3', team: 0 }, { seat: 4, name: 'B2', team: 1 },
  ];
  const teams = [{ id: 0, name: 'Team Cyan', color: '#6fd6ff' }, { id: 1, name: 'Team Violet', color: '#a48bff' }];
  assert.deepEqual(teamLap(seats, teams), [0, 1, 2, 4, 3]);
  const st = [
    { seat: 0, name: 'A1', score: 10, timeMs: 0, rank: 1 }, { seat: 1, name: 'B1', score: 9, timeMs: 0, rank: 2 },
    { seat: 2, name: 'A2', score: 2, timeMs: 0, rank: 4 }, { seat: 3, name: 'A3', score: 0, timeMs: 0, rank: 5 },
    { seat: 4, name: 'B2', score: 3, timeMs: 0, rank: 3 },
  ];
  // TM3: average, so the bigger team isn't favoured
  const avg = teamStandings(st, seats, teams);
  assert.deepEqual(avg.map((x) => [x.name, x.score, x.rank]), [['Team Violet', 6, 1], ['Team Cyan', 4, 2]]);
  const sum = teamStandings(st, seats, teams, 'sum');
  assert.deepEqual(sum.map((x) => [x.name, x.score]), [['Team Cyan', 12], ['Team Violet', 12]]);
  assert.deepEqual(sum.map((x) => x.rank), [1, 1]);
});
