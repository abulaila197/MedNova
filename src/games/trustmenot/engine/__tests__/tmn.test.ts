/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { botActions, type BotStyle } from '../bots';
import { createGame, jewelLoss, living, step } from '../game';
import { awards, epilogue, ranking } from '../reveal';
import * as R from '../rules';
import type { Game, QuestionPools, Setup } from '../types';
import { viewFor } from '../view';

const pools: QuestionPools = { 1: [], 2: [], 3: [], 4: [] };
for (const d of [1, 2, 3, 4] as const) for (let i = 0; i < 200; i++) pools[d].push({ id: `d${d}-${i}`, answer: i % 3 });

const COLORS = ['#c0473a', '#3a7bc0', '#4f9a4f', '#c09a3a', '#8a4fc0', '#3ab0b0'];
const setup = (n: number, seed = 1): Setup => ({
  seed, field: 'clinical', pools,
  players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: COLORS[i] })),
});

/** Plays a whole game with bots; checks the invariants after every action. */
function playOut(n: number, seed: number, styles?: BotStyle[]): Game {
  let g = createGame(setup(n, seed));
  const st = styles ?? Array.from({ length: n }, (_, i) => ({ skill: 0.55 + ((seed * 31 + i * 17) % 30) / 100, betrays: true }));
  let guard = 0;
  while (g.phase !== 'over' && guard++ < 500) {
    if (g.phase !== 'opening') {
      for (const [i, p] of g.players.entries()) {
        for (const a of botActions(g, p.id, st[i], seed * 101 + i)) {
          g = step(g, a);
          check(g);
        }
      }
    }
    g = step(g, { type: 'ADVANCE' });
    check(g);
  }
  assert.equal(g.phase, 'over', 'game finished');
  return g;
}

function check(g: Game) {
  assert.ok(g.wallet >= 0, `wallet ${g.wallet} >= 0`);
  for (const p of g.players) {
    assert.ok(p.health >= 0 && p.health <= 100, `health ${p.health} in 0-100`);
    assert.ok(p.jewels >= 0, `jewels ${p.jewels} >= 0`);
    assert.ok(p.effects.length <= R.MAX_EFFECTS, 'at most 3 effects');
    if (!p.alive) assert.equal(p.health, 0);
  }
}

test('a new game: wallet 25 per player, 6 jewels each, a 12-month plan with the fixed finale', () => {
  const g = createGame(setup(4));
  assert.equal(g.wallet, 100);
  assert.ok(g.players.every((p) => p.jewels === 6 && p.health === 100));
  assert.equal(g.plan.length, 12);
  assert.ok(R.OPENING_COIN.includes(g.plan[0]) && R.OPENING_JEWEL.includes(g.plan[1]) && R.DAMAGE_CONTROL.includes(g.plan[2]));
  assert.deepEqual(g.plan.slice(9), ['whisperer', 'wager', 'chain']);
  assert.equal(new Set(g.plan.slice(2, 9)).size, 7, 'no repeats in months 3-9');
  assert.equal(new Set(g.deck.flat().map((q) => q.id)).size, 120, 'no question repeats in a game');
  assert.throws(() => createGame(setup(2)));
});

test('jewel rounding: nearest, at least 1, never more than half, Lock box keeps 2', () => {
  const p = createGame(setup(3)).players[0];
  p.jewels = 6;
  assert.equal(jewelLoss(p, 0.1), 1);
  p.jewels = 10;
  assert.equal(jewelLoss(p, 0.9), 5);
  p.jewels = 3;
  p.lockBox = true;
  assert.equal(jewelLoss(p, 0.5), 1);
  assert.equal(jewelLoss(p, 0.5), 0);
});

test('paying with jewels drops the change into the wallet; wallet buys need a majority', () => {
  let g = createGame(setup(3));
  g = step(g, { type: 'ADVANCE' }); // opening -> gap 1
  const before = g.wallet;
  g = step(g, { type: 'BUY_FOOD', player: 'p0', meal: 'basic', pay: 'jewels' }); // 5 coins -> 1 jewel, 5 change
  assert.equal(g.players[0].jewels, 5);
  assert.equal(g.wallet, before + 5);
  g = step(g, { type: 'BUY_FOOD', player: 'p1', meal: 'basic', pay: 'wallet' });
  const req = g.requests[0];
  g = step(g, { type: 'ADVANCE' }); // -> gap 2
  g = step(g, { type: 'VOTE', player: 'p0', request: req.id, approve: true });
  g = step(g, { type: 'VOTE', player: 'p2', request: req.id, approve: false });
  // 1-1 tie, no ghosts: the request fails and heat rises.
  g = step(g, { type: 'ADVANCE' });
  assert.equal(g.requests[0].status, 'refused');
  assert.equal(g.heat, 1);
  assert.equal(g.players[1].meal, null);
});

test('help requests need everyone; donations are used first', () => {
  let g = createGame(setup(3));
  g = step(g, { type: 'ADVANCE' });
  g.players[0].effects.push({ id: 'snakebite', since: 1 });
  g = step(g, { type: 'TREAT', player: 'p0', effect: 'snakebite', how: 'help' });
  const req = g.requests[0];
  g = step(g, { type: 'ADVANCE' });
  g = step(g, { type: 'VOTE', player: 'p1', request: req.id, approve: true, donate: 1 });
  g = step(g, { type: 'VOTE', player: 'p2', request: req.id, approve: true });
  const wallet = g.wallet;
  g = step(g, { type: 'ADVANCE' });
  assert.equal(g.requests[0].status, 'approved');
  assert.equal(g.players[0].effects.length, 0);
  assert.equal(g.players[1].jewels, 5);
  assert.equal(g.wallet, wallet - (req.cost - 10));
});

test('a poisoned gift poisons on accept; refusing returns the gift but the extra 2 jewels are gone', () => {
  let g = createGame(setup(3));
  g = step(g, { type: 'ADVANCE' });
  g = step(g, { type: 'GIFT', player: 'p0', to: 'p1', jewels: 1, poisoned: true });
  assert.equal(g.players[0].jewels, 3);
  const v = viewFor(g, 'p1');
  assert.equal(v.gifts[0].poisoned, false, 'the receiver cannot see the poison');
  assert.equal(viewFor(g, 'p2').players[0].jewels, undefined, 'jewel counts are hidden');
  const refused = step(g, { type: 'GIFT_REPLY', player: 'p1', gift: g.gifts[0].id, accept: false });
  assert.equal(refused.players[0].jewels, 4);
  const accepted = step(g, { type: 'GIFT_REPLY', player: 'p1', gift: g.gifts[0].id, accept: true });
  assert.equal(accepted.players[1].jewels, 7);
  assert.ok(accepted.players[1].effects.some((e) => e.id === 'poisoned'));
});

test('illegal actions change nothing', () => {
  const g = createGame(setup(3));
  assert.equal(step(g, { type: 'SELL', player: 'p0', jewels: 1 }), g, 'no selling outside the Gap');
  const g1 = step(g, { type: 'ADVANCE' });
  assert.equal(step(g1, { type: 'SELL', player: 'p0', jewels: 99 }), g1);
  assert.equal(step(g1, { type: 'MERCY', player: 'p0' }), g1, 'Mercy only at 15% or less');
});

test('every size plays 12 months to the end with no broken numbers', () => {
  for (let n = 3; n <= 6; n++) for (let seed = 1; seed <= 6; seed++) {
    const g = playOut(n, seed);
    for (const p of g.players) epilogue(g, p.id);
    awards(g);
    ranking(g);
  }
});

test('bot economy: about half the camp survives on average (§1 target)', () => {
  const results: Record<number, number> = {};
  for (let n = 3; n <= 6; n++) {
    let alive = 0;
    const games = 20;
    for (let seed = 1; seed <= games; seed++) alive += living(playOut(n, 1000 + seed)).length;
    results[n] = alive / games;
  }
  console.log('average survivors by camp size:', results);
  // Rule book target ~half; accept a third to three quarters of the camp until tuning at build.
  for (let n = 3; n <= 6; n++) assert.ok(results[n] >= n / 3 && results[n] <= (n * 3) / 4, `survivors for ${n}: ${results[n]}`);
});

test('the same seed and actions replay to the same game', () => {
  const a = playOut(4, 77);
  const b = playOut(4, 77);
  assert.deepEqual(a, b);
});


test('§7.3: Chain of Trust answers count for EXP (a solo round) but never feed Learn', () => {
  assert.equal(R.ROUNDS.chain.mode, 'linked');
  assert.equal(R.countsAsSolo(R.ROUNDS.chain.mode), true);
  assert.equal(R.feedsLearn(R.ROUNDS.chain.mode), false);
  for (const id of ['pickpocket', 'lean', 'hero'] as const) {
    assert.equal(R.countsAsSolo(R.ROUNDS[id].mode), true);
    assert.equal(R.feedsLearn(R.ROUNDS[id].mode), true);
  }
  assert.equal(R.countsAsSolo(R.ROUNDS.hands.mode), false);
  assert.equal(R.feedsLearn(R.ROUNDS.hands.mode), false);
});

test('awards: ties go to the faster player, not the seat; Best Doctor needs half the most answers', () => {
  const g = createGame(setup(3));
  const [a, b, c] = g.players;
  a.answered = 10; a.correct = [8, 0]; a.totalMs = 50_000;
  b.answered = 10; b.correct = [8, 0]; b.totalMs = 40_000;
  c.answered = 2; c.correct = [2, 0]; c.totalMs = 1_000; // 100% on too few answers
  assert.equal(awards(g)['best-doctor'], b.id);
});
