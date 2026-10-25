/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { FEEDBACK_MS, grade, layoutFor, mixQueue, nearestSeats, POINTS, startRound, stepRound, timeLeft, TIME_S, type Question, type Response } from '../core';

const Q: Question[] = [
  { id: 'm', style: 'mcq', field: 'medicine', kind: 'clinical', prompt: 'p', choices: ['a', 'b', 'c', 'd'], answer: 2 },
  { id: 't', style: 'tf', field: 'anatomy', kind: 'basic', prompt: 'p', answer: false },
  { id: 'r', style: 'r2o', field: 'medicine', kind: 'clinical', prompt: 'p', items: ['a', 'b', 'c', 'd', 'e', 'f'], out: [0, 5] },
  { id: 'x', style: 'match', field: 'anatomy', kind: 'basic', prompt: 'p', pairs: [['a', '1'], ['b', '2'], ['c', '3'], ['d', '4']] },
  { id: 'o', style: 'order', field: 'anatomy', kind: 'basic', prompt: 'p', items: ['1', '2', '3', '4', '5'] },
  { id: 'c', style: 'closest', field: 'anatomy', kind: 'basic', prompt: 'p', answer: 200, unit: 'bones' },
];
const bank = (id: string) => Q.find((q) => q.id === id);
const fixed = () => 0.3;

test('QP3: points by type, part points for Match and Order', () => {
  assert.deepEqual(grade(Q[0], { style: 'mcq', pick: 2 }), { points: 2, right: true });
  assert.deepEqual(grade(Q[0], { style: 'mcq', pick: 1 }), { points: 0, right: false });
  assert.deepEqual(grade(Q[1], { style: 'tf', value: false }), { points: 1, right: true });
  assert.equal(grade(Q[2], { style: 'r2o', picks: [5, 0] }).points, 3);
  assert.equal(grade(Q[2], { style: 'r2o', picks: [0, 1] }).points, 0);
  assert.deepEqual(grade(Q[3], { style: 'match', map: [0, 1, 3, 2] }), { points: 2, right: false });
  assert.deepEqual(grade(Q[3], { style: 'match', map: [0, 1, 2, 3] }), { points: 4, right: true });
  assert.deepEqual(grade(Q[4], { style: 'order', seq: [0, 1, 2, 4, 3] }), { points: 2, right: false }); // 3 of 5 = 2.4
  assert.equal(grade(Q[4], { style: 'order', seq: [0, 1, 2, 3, 4] }).points, 4);
  assert.equal(grade(Q[0], null).points, 0);
});

test('QP6: Solo Closest number counts within 10%; Pass and Online give it to the nearest (ties share)', () => {
  assert.equal(grade(Q[5], { style: 'closest', value: 220 }).points, 2);
  assert.equal(grade(Q[5], { style: 'closest', value: 221 }).points, 0);
  assert.deepEqual(nearestSeats(200, [{ seat: 0, value: 150 }, { seat: 1, value: 230 }, { seat: 2, value: 170 }]), [1, 2]);
  assert.deepEqual(nearestSeats(200, [{ seat: 0, value: null }]), []);
});

test('Order and Match never start already solved', () => {
  for (let i = 0; i < 50; i++) {
    const l = layoutFor(Q[4], Math.random);
    assert.ok(l.some((v, k) => v !== k));
  }
});

test('QP2: each question has its own timer; time up counts as no answer, then the next question', () => {
  let r = startRound(['m', 't'], 0, bank, fixed);
  assert.equal(r.remainingMs, TIME_S.mcq * 1000);
  r = stepRound(r, { type: 'TICK', now: TIME_S.mcq * 1000 }, bank, fixed);
  assert.equal(r.phase, 'feedback');
  assert.equal(r.answers[0].outcome, 'wrong');
  r = stepRound(r, { type: 'TICK', now: TIME_S.mcq * 1000 + FEEDBACK_MS.wrong }, bank, fixed);
  assert.deepEqual([r.phase, r.index, r.remainingMs], ['playing', 1, TIME_S.tf * 1000]);
  const now = TIME_S.mcq * 1000 + FEEDBACK_MS.wrong + 3000;
  r = stepRound(r, { type: 'ANSWER', response: { style: 'tf', value: false }, now }, bank, fixed);
  assert.equal(r.score, POINTS.tf);
  r = stepRound(r, { type: 'TICK', now: now + FEEDBACK_MS.right }, bank, fixed);
  assert.equal(r.phase, 'over');
});

test('pause keeps the clock; helpers: skip and +10 s, Remove 2 off (QP9)', () => {
  let r = startRound(['m', 't'], 0, bank, fixed);
  r = stepRound(r, { type: 'PAUSE', now: 5000 }, bank, fixed);
  assert.equal(timeLeft(r, 99_000), 20_000);
  r = stepRound(r, { type: 'RESUME', now: 100_000 }, bank, fixed);
  assert.equal(stepRound(r, { type: 'HELPER', kind: 'remove', now: 101_000 }, bank, fixed), r);
  r = stepRound(r, { type: 'HELPER', kind: 'time', now: 102_000 }, bank, fixed);
  assert.equal(timeLeft(r, 102_000), 28_000);
  r = stepRound(r, { type: 'HELPER', kind: 'skip', now: 103_000 }, bank, fixed);
  assert.equal(r.answers[0].outcome, 'skipped');
  r = stepRound(r, { type: 'TICK', now: 110_000 }, bank, fixed);
});

test('Mixed takes about half of each and stops at the asked count', () => {
  const q = mixQueue(['c1', 'c2', 'c3'], ['b1', 'b2', 'b3'], 4, () => 0.2);
  assert.equal(q.length, 4);
});

test('the real bank: every question is well formed and its right answer scores full points', () => {
  const real = JSON.parse(readFileSync(join(process.cwd(), 'src/games/parade/data/bank.json'), 'utf8')) as Question[];
  assert.ok(real.length > 6000);
  const full: Record<string, (q: Question) => Response> = {
    mcq: (q) => ({ style: 'mcq', pick: (q as { answer: number }).answer }),
    reverse: (q) => ({ style: 'reverse', pick: (q as { answer: number }).answer }),
    tf: (q) => ({ style: 'tf', value: (q as { answer: boolean }).answer }),
    r2o: (q) => ({ style: 'r2o', picks: (q as { out: number[] }).out }),
    match: (q) => ({ style: 'match', map: (q as { pairs: unknown[] }).pairs.map((_, i) => i) }),
    order: (q) => ({ style: 'order', seq: (q as { items: unknown[] }).items.map((_, i) => i) }),
    closest: (q) => ({ style: 'closest', value: (q as { answer: number }).answer }),
  };
  const bad = real.filter((q) => {
    if (!q.prompt || !['clinical', 'basic'].includes(q.kind)) return true;
    if ((q.style === 'mcq' || q.style === 'reverse') && (q.choices.length < 2 || q.answer < 0 || q.answer >= q.choices.length)) return true;
    if (q.style === 'r2o' && (q.out.length !== 2 || q.out.some((i) => i >= q.items.length))) return true;
    if (q.style === 'match' && q.pairs.length < 2) return true;
    if (q.style === 'order' && q.items.length < 2) return true;
    if (q.style === 'closest' && !Number.isFinite(q.answer)) return true;
    return grade(q, full[q.style](q)).points !== POINTS[q.style];
  });
  assert.deepEqual(bad.map((q) => q.id), []);
});

test('QP10 Pass the phone: same questions in each turn, Closest number held, then nearest wins (ties share)', async () => {
  const { startOffline, stepOffline, settleClosest, offlineRows } = await import('../offline');
  let rng = 0;
  const seq = () => ((rng = (rng * 9301 + 49297) % 233280) / 233280);
  let run = startOffline([1, 0, 2], ['m', 'c', 't'], seq);
  assert.deepEqual(run.queues.map((q) => [...q].sort()), [['c', 'm', 't'], ['c', 'm', 't'], ['c', 'm', 't']]);
  const guess: Record<number, number> = { 1: 230, 0: 150, 2: 170 };
  let now = 0;
  for (let turn = 0; turn < 3; turn++) {
    run = stepOffline(run, { type: 'READY', now }, bank);
    run = stepOffline(run, { type: 'TICK', now: (now += 3000) }, bank);
    assert.equal(run.phase, 'playing');
    while (run.phase === 'playing' && run.round) {
      const q = bank(run.round.queue[run.round.index])!;
      const response: Response = q.style === 'closest' ? { style: 'closest', value: guess[run.order[turn]] } : q.style === 'tf' ? { style: 'tf', value: false } : { style: 'mcq', pick: 2 };
      if (run.round.phase === 'playing') run = stepOffline(run, { type: 'ROUND', e: { type: 'ANSWER', response, now: (now += 1000) } }, bank);
      if (q.style === 'closest' && run.round) assert.equal(run.round.answers[run.round.answers.length - 1].held, true);
      run = stepOffline(run, { type: 'TICK', now: (now += FEEDBACK_MS.wrong) }, bank);
    }
    assert.equal(run.phase, 'turnOver');
    assert.equal(run.results[turn].score, POINTS.mcq + POINTS.tf); // Closest not counted yet
    run = stepOffline(run, { type: 'NEXT' }, bank);
  }
  assert.equal(run.phase, 'done');
  const settled = settleClosest(run.results, bank);
  const by = Object.fromEntries(settled.map((x) => [x.seat, x.score]));
  assert.deepEqual(by, { 1: 5, 0: 3, 2: 5 });
  assert.deepEqual(offlineRows(run, {}, bank).map((x) => x.score), [5, 3, 5]);
});
