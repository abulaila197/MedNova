/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { offlineRecap as dpRecap, startOffline as dpStart, type TurnResult } from '../offline';
import { offlineRecap as smRecap, startOffline as smStart } from '../../streak/offline';
import { offlineRecap as rdRecap, startOffline as rdStart } from '../../riddler/offline';
import { offlineRecap as nmRecap, startOffline as nmStart } from '../../medicordle/offline';

const play = { seats: [{ seat: 0, name: 'You' }, { seat: 1, name: 'Sara', color: '#a48bff' }, { seat: 2, name: 'Omar' }], settings: {} };
const teams = {
  seats: [{ seat: 0, name: 'You', team: 0 }, { seat: 1, name: 'Sara', team: 1 }, { seat: 2, name: 'Omar', team: 1 }],
  settings: { teams: [{ id: 0, name: 'Team Cyan', color: '#6fd6ff' }, { id: 1, name: 'Team Violet', color: '#a48bff' }] },
};
const dp = (seat: number, outcome: TurnResult['outcome'], points: number): TurnResult => ({ seat, round: 0, caseId: 'x', outcome, cluesShown: 3, timeMs: 1000, wrong: [], reveals: 0, cluePoints: 0, speedBonus: 0, points });
const texts = (xs: { text: string }[]) => xs.map((x) => x.text);

test('recap DP: only what happened since this player last played, then the lead change', () => {
  const r = { ...dpStart([0, 1, 2], 2, ['a', 'b', 'c', 'd', 'e', 'f']), results: [dp(0, 'right', 80), dp(1, 'right', 100), dp(2, 'timed_out', 0)] };
  assert.deepEqual(texts(dpRecap(r, 0, play)), ['Sara solved the case · +100', 'Omar ran out of time', 'Sara takes the lead']);
  assert.equal(dpRecap(r, 0, play)[0].color, '#a48bff');
  // Sara's own turn and earlier are left out; the lead didn't change since she played.
  assert.deepEqual(texts(dpRecap(r, 1, play)), ['Omar ran out of time']);
  // First turn of the match: nothing has happened yet.
  assert.deepEqual(dpRecap({ ...r, results: [] }, 0, play), []);
});

test('recap DP: with teams on, the lead change names the team (average score)', () => {
  const r = { ...dpStart([0, 1, 2], 2, ['a', 'b', 'c', 'd', 'e', 'f']), results: [dp(0, 'right', 60), dp(1, 'right', 100), dp(2, 'skipped', 0)] };
  // Team Violet averages 50 < Team Cyan 60: no lead change.
  assert.deepEqual(texts(dpRecap(r, 0, teams)), ['Sara solved the case · +100', 'Omar missed the case']);
  const r2 = { ...r, results: [dp(0, 'right', 60), dp(1, 'right', 100), dp(2, 'right', 90)] };
  assert.equal(dpRecap(r2, 0, teams).at(-1)?.text, 'Team Violet takes the lead');
});

test('recap Streak: each finished round with score and best streak', () => {
  const r = { ...smStart([0, 1, 2], ['q'], 60), results: [{ seat: 0, score: 10, maxStreak: 4, correct: 4, answers: [] }, { seat: 1, score: 28, maxStreak: 7, correct: 7, answers: [] }] };
  assert.deepEqual(texts(smRecap(r, 0, play)), ['Sara scored 28 · best streak 7', 'Sara takes the lead']);
  assert.deepEqual(smRecap(r, 1, play), []);
});

test('recap Riddler: solves and time-outs with no answers, "everyone else", lead from scored pictures', () => {
  const clock = (ms: number) => `${Math.round(ms / 1000)} s`;
  let r = rdStart([0, 1, 2], ['p1', 'p2'], 60_000);
  // Picture 1 scored: Sara fastest. Picture 2 in progress: Sara and Omar have solved it, You are last.
  r = {
    ...r, index: 1, turn: 0,
    results: [{ riddleId: 'p1', scores: [
      { seat: 0, solved: true, timeMs: 30_000, rank: 2, rankPoints: 80, timeBonus: 25, points: 105, wrong: 0 },
      { seat: 1, solved: true, timeMs: 10_000, rank: 1, rankPoints: 100, timeBonus: 42, points: 142, wrong: 0 },
      { seat: 2, solved: false, timeMs: 60_000, rank: null, rankPoints: 0, timeBonus: 0, points: 0, wrong: 1 },
    ] }],
    turns: [{ seat: 1, solved: true, timeMs: 12_000, wrong: [] }, { seat: 2, solved: true, timeMs: 20_000, wrong: [] }],
  };
  assert.deepEqual(texts(rdRecap(r, 0, play, clock)), [
    'Sara solved it in 10 s', 'Omar ran out of time', 'Sara solved it in 12 s', 'Omar solved it in 20 s',
    'Everyone else has solved this picture', 'Sara takes the lead',
  ]);
});

test('recap Medicordle: close line at two-thirds green, word winners, lead in words won', () => {
  const answers: Record<string, string> = { w1: 'ANEMIA', w2: 'SEPSIS' };
  let r = nmStart('classic', [0, 1, 2], ['w1', 'w2'], 20_000, () => 0.5);
  r = {
    ...r, index: 1, turns: [{ seat: 1, word: 'SEPTIC', timeMs: 1 }],
    results: [{ wordId: 'w1', winner: 2, turns: [{ seat: 0, word: 'ANGINA', timeMs: 1 }, { seat: 1, word: 'ANEMIC', timeMs: 1 }, { seat: 2, word: 'ANEMIA', timeMs: 1 }] }],
  };
  // Green counts the whole shared board. ANGINA leaves 3 green; ANEMIC lifts it to 6 (close, threshold 4).
  // SEPTIC on SEPSIS gives 4 green on the new word: close again.
  assert.deepEqual(texts(nmRecap(r, 0, play, (id) => answers[id])), ['Sara made it close · 6 of 6 green', 'Omar won word 1 on row 3', 'Sara made it close · 4 of 6 green', 'Omar takes the lead']);
  // Omar's own win is his last turn, so only Sara's new close line is news to him.
  assert.deepEqual(texts(nmRecap(r, 2, play, (id) => answers[id])), ['Sara made it close · 4 of 6 green']);
});
