/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { judge, type Answer, type Question, type Rng } from '../core';
import { bossBonus, roundsIn, type FullBank } from '../offline';
import { asSoloGame, canRedeem, missedPoints, soloBossBonus, startSoloGame, stepSoloGame, type SoloGame } from '../solo';

const bank = JSON.parse(readFileSync('src/games/wheels/data/bank.json', 'utf8')) as FullBank;

function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const right = (q: Question): Answer => {
  switch (q.style) {
    case 'tf': return q.answer;
    case 'lie': return q.lie;
    case 'r2o': return [...q.out];
    case 'match': return q.pairs.map((_, i) => i);
    case 'order': return q.items.map((_, i) => i);
    default: return q.answer;
  }
};

/** Plays the current turn to its end: every answer right, or every question left to time out. */
function playTurn(g: SoloGame, ok: boolean, rng: Rng, now = { t: 0 }): SoloGame {
  for (let i = 0; i < 40 && g.run.phase === 'turn'; i++) {
    const t = g.run.turn!;
    now.t += 200_000;
    if (t.phase === 'reveal') g = stepSoloGame(g, { type: 'RUN', e: { type: 'GO', now: now.t } }, bank, rng);
    else if (t.phase === 'question') g = ok
      ? stepSoloGame(g, { type: 'RUN', e: { type: 'ANSWER', answer: right(t.question), now: now.t } }, bank, rng)
      : stepSoloGame(g, { type: 'RUN', e: { type: 'TICK', now: now.t } }, bank, rng);
    else g = stepSoloGame(g, { type: 'RUN', e: { type: 'TICK', now: now.t } }, bank, rng);
  }
  return g;
}

test('judge: Closest Number counts within 10%, Put in Order is all or nothing', () => {
  const c = bank.questions.find((q) => q.style === 'closest' && q.answer >= 50)! as Extract<Question, { style: 'closest' }>;
  assert.equal(judge(c, c.answer), true);
  assert.equal(judge(c, c.answer * 1.09), true);
  assert.equal(judge(c, c.answer * 0.91), true);
  assert.equal(judge(c, c.answer * 1.2), false);
  assert.equal(judge(c, null), false);
  const o = bank.questions.find((q) => q.style === 'order')! as Extract<Question, { style: 'order' }>;
  const n = o.items.length;
  assert.equal(judge(o, o.items.map((_, i) => i)), true);
  assert.equal(judge(o, [1, 0, ...o.items.slice(2).map((_, i) => i + 2)]), false);
  assert.ok(n >= 3);
});

test('Solo Boss bonus: every 4 Boss points is +1, up to a fifth of the target', () => {
  assert.equal(soloBossBonus(50, 3), 0);
  assert.equal(soloBossBonus(50, 8), 2);
  assert.equal(soloBossBonus(50, 60), bossBonus(50));
  assert.equal(soloBossBonus(25, 60), bossBonus(25));
  assert.equal(soloBossBonus(50, -5), 0);
});

test('Solo: the act ends with a Boss Round after its turns, then the next act starts at turn 1', () => {
  const rng = seeded(4);
  let g = startSoloGame(bank, 50, rng);
  for (let turn = 1; turn <= roundsIn(0); turn++) {
    assert.equal(g.inAct, turn);
    g = playTurn(g, false, rng);
    assert.equal(g.run.phase, 'turnOver');
    g = stepSoloGame(g, { type: 'RUN', e: { type: 'NEXT' } }, bank, rng);
  }
  assert.equal(g.stage, 'boss');
  g = stepSoloGame(g, { type: 'BOSS', e: { type: 'GO', now: 1 } }, bank, rng);
  // Swipe every item right.
  for (const it of g.boss!.items) g = stepSoloGame(g, { type: 'BOSS', e: { type: 'SWIPE', fits: it.fits, now: 2 } }, bank, rng);
  assert.equal(g.stage, 'bossOver');
  assert.equal(g.extra?.k, 'boss');
  assert.equal(g.run.score, g.extra!.points);
  assert.ok(g.extra!.points > 0 && g.extra!.points <= bossBonus(50));
  g = stepSoloGame(g, { type: 'ON' }, bank, rng);
  assert.deepEqual([g.stage, g.act, g.inAct, g.run.phase], ['run', 1, 1, 'turn']);
});

test('Solo Redemption: once a game, after a miss, wins back at most the missed points', () => {
  const rng = seeded(11);
  let g = startSoloGame(bank, 50, rng);
  g = playTurn(g, false, rng);
  const missed = missedPoints(g);
  assert.ok(missed > 0 && canRedeem(g));
  const before = g.run.score;
  g = stepSoloGame(g, { type: 'REDEEM' }, bank, rng);
  assert.equal(g.stage, 'redemption');
  assert.equal(canRedeem(g), false);
  // Answer every call right.
  for (let i = 0; i < 40 && g.stage === 'redemption'; i++) {
    const r = g.redemption!;
    if (r.phase === 'reveal') g = stepSoloGame(g, { type: 'RED', e: { type: 'GO', now: 1 } }, bank, rng);
    else { const q = r.items[r.index]; g = stepSoloGame(g, { type: 'RED', e: { type: 'ANSWER', value: q.style === 'tf' ? q.answer : true, now: 2 } }, bank, rng); }
  }
  assert.equal(g.stage, 'redOver');
  assert.equal(g.run.score - before, Math.min(g.extra!.of, missed));
  g = stepSoloGame(g, { type: 'ON' }, bank, rng);
  assert.equal(g.stage, 'run');
  // Never again this game.
  g = stepSoloGame(g, { type: 'RUN', e: { type: 'NEXT' } }, bank, rng);
  g = playTurn(g, false, rng);
  assert.equal(canRedeem(g), false);
});

test('Solo: a run saved before acts came carries on as act I', () => {
  const rng = seeded(2);
  const g = startSoloGame(bank, 25, rng);
  const old = asSoloGame(g.run);
  assert.deepEqual([old.stage, old.act, old.inAct, old.redUsed], ['run', 0, 1, false]);
});
