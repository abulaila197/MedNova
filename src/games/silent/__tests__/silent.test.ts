/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { countWords, guesserPoints, hintPlan, hintStage, hintView, lettersToReveal, pickWords, type Word } from '../core';
import { buildPlan, currentTurn, offlineRecap, offlineRows, startOffline, stealTeamOf, stepOffline, timeLeft, type OfflineEvent, type OfflineRun } from '../offline';
import { soloLeft, startSolo, stepSolo } from '../solo';

const POOL: Word[] = Array.from({ length: 12 }, (_, i) => ({ id: `w${i}`, name: i === 0 ? 'Myocardial infarction' : `Disease number ${i}`, field: i % 2 ? 'Cardiology' : 'Neurology', aliases: [] }));
const step = (r: OfflineRun, e: OfflineEvent) => stepOffline(r, e, POOL);

test('hint ladder (SA5): words, field at 30%, blanks at 40%, letters by 90%, stretched to the turn', () => {
  const w = POOL[0];
  for (const turn of [60_000, 90_000, 120_000]) {
    const p = hintPlan(w, turn, 7);
    assert.equal(p.fieldAt, turn * 0.3);
    assert.equal(p.lettersAt, turn * 0.4);
    assert.equal(p.times[p.times.length - 1], turn * 0.9);
    assert.deepEqual(hintView(w, p, 0), { words: 2, field: null, mask: null });
    assert.equal(hintView(w, p, p.fieldAt).field, 'Cardiology' === w.field ? 'Cardiology' : w.field);
    assert.equal(hintView(w, p, p.lettersAt).mask, '__________ __________');
    const end = hintView(w, p, turn).mask!;
    assert.equal(end.replace(/_/g, '').replace(' ', '').length, lettersToReveal(20));
    assert.equal(hintStage(p, turn), 3);
  }
  assert.equal(countWords('Hand-foot-and-mouth disease'), 2);
  assert.equal(lettersToReveal(1), 0);
  assert.equal(lettersToReveal(40), 8);
});

test('guesser points (SA7): 100 to 20 by time, +25 before the field', () => {
  assert.equal(guesserPoints(0, 60_000, 18_000), 125);
  assert.equal(guesserPoints(18_000, 60_000, 18_000), 76);
  assert.equal(guesserPoints(60_000, 60_000, 18_000), 20);
  assert.equal(guesserPoints(45_000, 90_000, 27_000), 60);
});

test('word picking avoids this match, then recent words, and can limit fields', () => {
  const [a, s] = pickWords(POOL, 1, { count: 3, used: ['w1', 'w2'], recent: ['w3'] });
  assert.equal(new Set(a.map((w) => w.id)).size, 3);
  assert.ok(a.every((w) => !['w1', 'w2', 'w3'].includes(w.id)));
  const [b] = pickWords(POOL, s, { count: 4, used: [], recent: [], fields: ['Neurology'] });
  assert.ok(b.every((w) => w.field === 'Neurology'));
});

test('plan (SA6, TMG-SA): individuals in order; teams alternate and uneven teams perform equally often', () => {
  assert.deepEqual(buildPlan([{ seat: 0 }, { seat: 1 }], null, 2).map((t) => t.seat), [0, 1, 0, 1]);
  const p = buildPlan([{ seat: 0, team: 0 }, { seat: 1, team: 0 }, { seat: 2, team: 1 }, { seat: 3, team: 2 }], [0, 1, 2], 1);
  assert.deepEqual(p.map((t) => `${t.team}:${t.seat}`), ['0:0', '1:2', '2:3', '0:1', '1:2', '2:3']);
});

test('offline individuals: pick in 10 s or get the first, Got it names the guesser, performer gets half', () => {
  let r = startOffline({ plan: buildPlan([{ seat: 0 }, { seat: 1 }, { seat: 2 }], null, 1), teams: null, turnMs: 60_000, seed: 's' });
  r = step(r, { type: 'READY', now: 0 });
  assert.equal(r.options.length, 3);
  r = step(r, { type: 'KIND', kind: 'acting' });
  r = step(r, { type: 'TICK', now: 10_000 });
  assert.deepEqual([r.phase, r.wordId, r.kind], ['performing', r.options[0], 'acting']);
  r = step(r, { type: 'PAUSE', now: 15_000 });
  r = step(r, { type: 'RESUME', now: 500_000 });
  assert.equal(timeLeft(r, 500_000), 55_000);
  r = step(r, { type: 'GOT_IT', now: 500_000 });
  assert.equal(r.phase, 'whoGot');
  assert.equal(step(r, { type: 'CREDIT', seat: 0 }).phase, 'whoGot', 'the performer cannot guess their own turn');
  r = step(r, { type: 'CREDIT', seat: 2 });
  assert.deepEqual([r.phase, r.scores[2], r.scores[0]], ['reveal', 118, 59]);
  r = step(r, { type: 'NEXT' });
  assert.deepEqual([r.phase, currentTurn(r).seat], ['handoff', 1]);
  r = step(r, { type: 'READY', now: 0 });
  assert.ok(!r.options.includes(r.turns[0].wordId), 'a word never repeats in a match');
  r = step(r, { type: 'PICK', wordId: r.options[1], now: 0 });
  r = step(r, { type: 'TICK', now: 60_000 });
  assert.deepEqual([r.phase, r.turns[1].outcome], ['reveal', 'missed']);
  r = step(step(r, { type: 'NEXT' }), { type: 'REMOVE', seat: 2 });
  assert.equal(r.phase, 'done', 'removing the last performer ends the match');
  const rows = offlineRows(r, { 0: 'A', 1: 'B', 2: 'C' }, () => undefined);
  assert.deepEqual(rows.map((x) => [x.seat, x.score]), [[0, 59], [1, 0]]);
});

test('offline teams: the team scores the guess; time up gives the next team one steal worth 10', () => {
  const seats = [{ seat: 0, team: 0 }, { seat: 1, team: 1 }, { seat: 2, team: 2 }];
  let r = startOffline({ plan: buildPlan(seats, [0, 1, 2], 1), teams: [0, 1, 2], turnMs: 90_000, seed: 't' });
  assert.equal(stealTeamOf(r, 2), 0);
  r = step(r, { type: 'READY', now: 0 });
  r = step(r, { type: 'PICK', wordId: r.options[0], now: 0 });
  r = step(r, { type: 'GOT_IT', now: 45_000 });
  assert.deepEqual([r.phase, r.teamScores[0]], ['reveal', 60]);
  r = step(step(r, { type: 'NEXT' }), { type: 'READY', now: 0 });
  r = step(r, { type: 'PICK', wordId: r.options[0], now: 0 });
  r = step(r, { type: 'TICK', now: 90_000 });
  assert.equal(r.phase, 'stealing');
  r = step(r, { type: 'STEAL', success: true });
  assert.deepEqual([r.turns[1].outcome, r.turns[1].stealTeam, r.teamScores[2]], ['stolen', 2, 10]);
  const rows = offlineRows(r, {}, (s) => seats[s].team);
  assert.deepEqual(rows.map((x) => x.score), [60, 0, 10]);
  const play = { seats: seats.map((x) => ({ ...x, name: `P${x.seat}` })), settings: { teams: [{ id: 0, name: 'Cyan', color: '#0ff' }, { id: 1, name: 'Violet', color: '#a0f' }, { id: 2, name: 'Rose', color: '#f0a' }] } };
  const recap = offlineRecap(r, 2, play, (id) => ['Cyan', 'Violet', 'Rose'][id], (ms) => `${ms / 1000}s`);
  assert.deepEqual(recap.map((x) => x.text), ["P0's drawing was guessed in 45s", "P1's drawing was stolen by Rose", 'Cyan takes the lead']);
});

test('solo (SA2): 60 s, reveal, did you know it, retry keeps the disease, finish', () => {
  let r = startSolo(POOL, { seed: 'x', fields: ['Neurology'], now: 0 });
  const first = r.wordId;
  assert.equal(soloLeft(r, 20_000), 40_000);
  r = stepSolo(r, { type: 'TICK', now: 60_000 }, POOL);
  r = stepSolo(r, { type: 'KNEW', knew: true }, POOL);
  assert.deepEqual(r.done, [{ wordId: first, knew: true, timeMs: 60_000 }]);
  r = stepSolo(r, { type: 'RETRY', now: 0 }, POOL);
  assert.deepEqual([r.phase, r.wordId, r.done.length], ['drawing', first, 0]);
  r = stepSolo(stepSolo(r, { type: 'REVEAL', now: 5_000 }, POOL), { type: 'NEXT', now: 0 }, POOL);
  assert.notEqual(r.wordId, first);
  assert.equal(POOL.find((w) => w.id === r.wordId)!.field, 'Neurology');
  r = stepSolo(r, { type: 'FINISH' }, POOL);
  assert.equal(r.phase, 'done');
});
