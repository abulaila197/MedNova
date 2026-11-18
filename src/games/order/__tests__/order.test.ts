/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ORDER, cardOf, full, move, placeStep, poolOf, removeDecoy, runExp, runPoints, speedOf, startRun, submit, timeUp, type QRun } from '../core';
import { CATEGORIES, QUESTIONS, categoryMenu, questionById } from '../data';
import { startOffline, stepOffline } from '../offline';
import { OrderRace, planQuestion, progressAt } from '../rivals';
import { mindFor } from '../../../bots/brain';
import type { Bot } from '../../../bots/types';

const seq = (xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};
const q0 = QUESTIONS[0];
/** Puts every step in its right slot. */
const solve = (run: QRun) => q0.steps.reduce((r, _s, i) => move(r, i, i), run);

test('the bank: 320 questions, 40 a category, 4 to 7 steps, 3 decoys up to 5 steps and 2 above, a note on every line', () => {
  assert.equal(QUESTIONS.length, 320);
  for (const c of CATEGORIES) assert.equal(QUESTIONS.filter((q) => q.cat === c).length, 40, c);
  const ids = new Set<string>();
  for (const q of QUESTIONS) {
    assert.ok(!ids.has(q.id), `${q.id} twice`);
    ids.add(q.id);
    assert.ok(q.steps.length >= 4 && q.steps.length <= 7, q.q);
    assert.equal(q.decoys.length, q.steps.length <= 5 ? 3 : 2, q.q);
    const texts = [...q.steps, ...q.decoys].map((s) => s.t);
    assert.equal(new Set(texts).size, texts.length, `${q.q}: a repeated box`);
    for (const s of [...q.steps, ...q.decoys]) {
      assert.ok(s.t && s.n, q.q);
      assert.ok(s.t.length <= 60, s.t);
    }
  }
  assert.equal(categoryMenu(5).total(['Anatomy']), 40);
});

test('a new run: every card in the pool, never already in order, empty slots', () => {
  for (let k = 0; k < 30; k++) {
    const run = startRun(q0, Math.random);
    assert.equal(run.order.length, q0.steps.length + q0.decoys.length);
    assert.equal(poolOf(run).length, run.order.length);
    assert.ok(run.slots.every((s) => s == null));
    assert.ok(!run.order.slice(0, q0.steps.length).every((c, i) => c === i));
  }
});

test('drag and drop: into a slot, swap on a filled slot, back to the pool', () => {
  let run = startRun(q0, Math.random);
  run = move(run, 0, 2);
  assert.equal(run.slots[2], 0);
  // Pool card onto a filled slot: the one there goes back to the pool.
  run = move(run, 1, 2);
  assert.equal(run.slots[2], 1);
  assert.ok(poolOf(run).includes(0));
  // Slot card onto a filled slot: the two swap.
  run = move(run, 0, 4);
  run = move(run, 0, 2);
  assert.equal(run.slots[2], 0);
  assert.equal(run.slots[4], 1);
  // Back to the pool.
  run = move(run, 0, 'pool');
  assert.equal(run.slots[2], null);
  assert.ok(poolOf(run).includes(0));
  // Same place: nothing changes.
  assert.equal(move(run, 1, 4), run);
});

test('submit: all or nothing, 3 tries, a wrong try says nothing more', () => {
  let run = startRun(q0, Math.random);
  assert.equal(submit(run), run, 'not with empty slots');
  run = solve(run);
  // Swap two: wrong.
  const wrongOrder = move(run, 0, 1);
  let r = submit(wrongOrder);
  assert.equal(r.wrong, 1);
  assert.equal(r.done, false);
  assert.deepEqual(r.slots, wrongOrder.slots, 'the slots stay as they were');
  r = submit(submit(r));
  assert.equal(r.wrong, 3);
  assert.equal(r.done, true);
  assert.equal(r.solved, false);
  assert.equal(runPoints(r, 1000), 0);
  // Right on try 2.
  const two = submit(solve(submit(wrongOrder)));
  assert.ok(two.solved && two.done);
  assert.equal(runPoints(two, 0), 70 + 20);
  assert.equal(runPoints(submit(run), ORDER.turnMs), 100);
  assert.equal(speedOf(45_000), 10);
  assert.equal(runExp(120), 12);
  // A decoy in a slot is wrong.
  const n = q0.steps.length;
  const withDecoy = submit(move(run, n, 0));
  assert.equal(withDecoy.wrong, 1);
});

test('helpers: Place a step fixes one right step; Remove a decoy takes one away; once each', () => {
  let run = startRun(q0, Math.random);
  run = move(run, 1, 0);
  const placed = placeStep(run, seq([0]));
  assert.equal(placed.slots[0], 0, 'step 1 placed in slot 1');
  assert.ok(placed.fixed.includes(0));
  assert.equal(placed.slots.filter((c) => c === 1).length, 0, 'the card that was there went back to the pool');
  assert.equal(move(placed, 0, 3), placed, 'a fixed step cannot move');
  assert.equal(move(placed, 2, 0), placed, 'nothing can be dropped on a fixed slot');
  assert.equal(placeStep(placed, seq([0])), placed, 'once a question');
  const n = q0.steps.length;
  let d = move(placed, n, 3);
  d = removeDecoy(q0, d, seq([0]));
  assert.equal(d.gone.length, 1);
  assert.ok(d.gone[0] >= n);
  assert.ok(!d.slots.includes(d.gone[0]), 'out of its slot too');
  assert.ok(!poolOf(d).includes(d.gone[0]));
  assert.equal(removeDecoy(q0, d, seq([0])), d);
  assert.ok(full(solve(d)));
  assert.equal(cardOf(q0, n).t, q0.decoys[0].t);
  assert.ok(timeUp(d).done && timeUp(d).timeUp);
});

test('Pass the phone: own question each turn, 90 s, then the result and the next player', () => {
  const ids = QUESTIONS.slice(0, 4).map((q) => q.id);
  let r = startOffline(ids, [0, 1], 2, seq([0.1]));
  assert.equal(r.phase, 'handoff');
  r = stepOffline(r, { type: 'READY' }, seq([0.3]));
  const first = r.turn!;
  assert.equal(r.phase, 'playing');
  const q = questionById.get(first.id)!;
  let run = first.run;
  for (let i = 0; i < q.steps.length; i++) r = stepOffline(r, { type: 'MOVE', card: i, to: i });
  run = r.turn!.run;
  assert.ok(full(run));
  r = stepOffline(r, { type: 'SUBMIT', ms: 30_000 });
  assert.equal(r.phase, 'result');
  assert.equal(r.players[first.seat].points[0], 100 + speedOf(30_000));
  r = stepOffline(r, { type: 'NEXT' });
  assert.equal(r.phase, 'handoff');
  r = stepOffline(r, { type: 'READY' });
  assert.notEqual(r.turn!.id, first.id, 'each player gets their own question');
  r = stepOffline(r, { type: 'TIMEUP' });
  assert.equal(r.phase, 'result');
  assert.ok(r.turn!.run.timeUp);
  r = stepOffline(r, { type: 'NEXT' });
  assert.equal(r.round, 1);
  r = stepOffline(stepOffline(r, { type: 'READY' }), { type: 'TIMEUP' });
  r = stepOffline(stepOffline(stepOffline(r, { type: 'NEXT' }), { type: 'READY' }), { type: 'TIMEUP' });
  r = stepOffline(r, { type: 'NEXT' });
  assert.equal(r.phase, 'done');
});

const bot = (id: string, type: Bot['type']): Bot => ({ id, type, name: id === 'b1' ? 'Sara' : 'Omar', character: 'yara' }) as Bot;

test('rivals: seeded plans fill slots over time, then try up to 3 times', () => {
  const p1 = planQuestion(mindFor(bot('b1', 'genius')), q0.id, 'x:0').plan;
  const p2 = planQuestion(mindFor(bot('b1', 'genius')), q0.id, 'x:0').plan;
  assert.deepEqual(p1, p2);
  assert.equal(p1.fills.length, q0.steps.length);
  for (let i = 1; i < p1.fills.length; i++) assert.ok(p1.fills[i] >= p1.fills[i - 1]);
  assert.ok(p1.tries.length >= 1 && p1.tries.length <= 3);
  assert.ok(p1.tries[0] > p1.fills[p1.fills.length - 1]);
  assert.equal(progressAt(p1, 0).filled, 0);
  assert.equal(progressAt(p1, Infinity).filled, q0.steps.length);
});

test('vs rivals: the same question, close when you are done and the rivals finish, then the next', () => {
  const ids = QUESTIONS.slice(0, 2).map((q) => q.id);
  const race = new OrderRace({ playId: 'p1', items: [1, 2], you: { name: 'You', character: 'yara', team: null }, rivals: [bot('b1', 'genius'), bot('b2', 'freshman')], settings: {}, playerLevel: 1, ids });
  assert.equal(race.state(0).phase, 'countdown');
  let st = race.state(3_000);
  assert.equal(st.phase, 'case');
  const q = questionById.get(ids[0])!;
  for (let i = 0; i < q.steps.length; i++) race.move(4_000, i, i);
  assert.ok(race.submit(10_000));
  st = race.state(10_000);
  // Everyone done within the hurry window (Freshman 5-6 s).
  st = race.state(17_000);
  assert.equal(st.phase, 'reveal');
  const me = st.players.find((p) => p.user_id === 'you');
  assert.equal(me?.item_points, 100 + speedOf(7_000));
  assert.ok(race.next(18_000));
  assert.equal(race.state(18_000).phase, 'case');
  // Time up on the second.
  st = race.state(18_000 + ORDER.turnMs + 10);
  assert.equal(st.phase, 'reveal');
  assert.ok(race.runOf(1)!.run.timeUp);
});
