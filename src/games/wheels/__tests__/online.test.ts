/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { playable, targetsFor } from '../cards';
import { judge, type Answer, type Question, type Rng } from '../core';
import { decodeKeys, encodeKeys } from '../keys';
import { actor, type FullBank } from '../offline';
import { dueOf, onlineRanks, ONLINE_MS, startOnline, stepOnline, type Move, type OnlineWheels, type Outside } from '../online';

const full = JSON.parse(readFileSync('src/games/wheels/data/bank.json', 'utf8')) as FullBank;
const keys = encodeKeys(full);
const slim = decodeKeys(keys);

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

const rightAnswer = (q: Question): Answer => {
  switch (q.style) {
    case 'mcq': case 'riddle': case 'reverse': return q.answer;
    case 'tf': return q.answer;
    case 'lie': return q.lie;
    case 'r2o': return [...q.out];
    case 'match': return q.pairs.map((_, i) => i);
  }
};
const wrongAnswer = (q: Question): Answer => (q.style === 'tf' ? !q.answer : q.style === 'r2o' || q.style === 'match' ? [] : 99);

test('the answer keys judge every question exactly like the full bank', () => {
  assert.equal(slim.questions.length, full.questions.length);
  full.questions.forEach((q, i) => {
    const k = slim.questions[i];
    assert.equal(k.style, q.style);
    assert.equal(k.field, q.field);
    assert.equal(judge(k, rightAnswer(q)), true, q.id);
    assert.equal(judge(k, wrongAnswer(q)), false, q.id);
  });
  full.redemption.forEach((q, i) => {
    const k = slim.redemption[i];
    assert.deepEqual([k.field, k.round, k.difficulty, k.style === 'tf' && k.answer], [q.field, q.round, q.difficulty, q.style === 'tf' && q.answer]);
  });
  full.boss.forEach((b, i) => {
    assert.equal(slim.boss[i].field, b.field);
    assert.deepEqual(slim.boss[i].items.map((x) => x.fits), b.items.map((x) => x.fits));
  });
  assert.ok(JSON.stringify(keys).length < 16_000);
});

/** Plays a whole online game. `idle` seats never touch their phone; the server's deadlines carry them. */
function playOut(seed: number, seats: number, idle: (seat: number) => boolean, dropAt?: { seat: number; at: number }) {
  const rng = seeded(seed);
  let now = 1_000_000;
  let o: OnlineWheels = startOnline(seats, 50, 'mixed', keys.v, slim, rng, now);
  const swipes: Outside['swipes'] = {};
  const dropped: number[] = [];
  const phases = new Set<string>();
  const waits: Record<string, number> = {};
  for (let i = 0; i < 20_000 && o.g.phase !== 'done'; i++) {
    const g = o.g;
    phases.add(g.phase);
    if (dropAt && i === dropAt.at) dropped.push(dropAt.seat);
    const who = actor(g);
    let m: Move | null = null;
    if (who != null && !idle(who)) {
      if (g.phase === 'initiation') {
        const can = playable(g.hands, who, g.active).filter((c) => c !== 'mirror');
        const c = can[0];
        if (c === 'star' || c === 'sun') m = { type: 'PLAY', play: { card: c } };
        else if (c === 'tower' || c === 'moon') m = { type: 'PLAY', play: { card: c, target: targetsFor(g.hands, who, c, g.active)[0] } };
        else m = { type: 'PASS' };
      } else if (g.phase === 'reaction') m = { type: 'REACT', choice: null };
      else if (g.phase === 'redemptionOffer') m = { type: 'REDEEM', use: true };
      else if (g.phase === 'turn' && g.turn) {
        const t = g.turn;
        m = t.phase === 'reveal' ? { type: 'GO' } : t.phase === 'star' ? { type: 'KEEP' } : t.phase === 'question' ? { type: 'ANSWER', answer: rightAnswer(t.question) } : null;
      } else if (g.phase === 'redemption' && g.redemption) {
        const r = g.redemption;
        const q = r.items[r.index];
        m = r.phase === 'reveal' ? { type: 'GO' } : q && q.style === 'tf' ? { type: 'CALL', value: q.answer } : null;
      }
    }
    if (g.phase === 'boss' && g.boss?.phase === 'playing') {
      // Everyone swipes at once; idle seats swipe nothing.
      for (const s of g.active) if (!idle(s)) swipes[s] = g.boss.decks[s].map((ix) => g.boss!.items[ix].fits);
    }
    if (g.phase !== 'boss') for (const k of Object.keys(swipes)) delete swipes[Number(k)];
    const before = o;
    if (m && who != null) {
      now += 300;
      o = stepOnline(o, m, who, { dropped, swipes }, slim, rng, now);
    }
    if (!m || o === before) {
      const due = dueOf(o);
      now = Math.max(now + 50, due ?? now + 50);
      o = stepOnline(o, { type: 'TICK' }, null, { dropped, swipes }, slim, rng, now);
    }
    if (o.key !== before.key && o.deadline != null) waits[o.g.phase] = o.deadline - now;
  }
  return { o, phases, waits };
}

test('a whole online game plays to the end with every phone playing', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const { o, phases } = playOut(seed, 3, () => false);
    assert.equal(o.g.phase, 'done', `seed ${seed}`);
    assert.ok(o.g.result!.winners.length >= 1);
    assert.ok(phases.has('initiation') && phases.has('turn'));
    const ranks = onlineRanks(o.g);
    for (const w of o.g.result!.winners) assert.equal(ranks[w], 1);
  }
});

test('idle phones never stall the show: every wait has a deadline', () => {
  for (const seed of [7, 8, 9]) {
    const { o, phases, waits } = playOut(seed, 4, () => true);
    assert.equal(o.g.phase, 'done', `seed ${seed}`);
    assert.ok(phases.has('boss') && phases.has('bossOver'));
    assert.ok(o.g.log.every((l) => l.k !== 'turn' || l.points === 0), 'nobody answered, no turn scored');
    if (waits.reaction != null) assert.equal(waits.reaction, ONLINE_MS.react);
    assert.equal(waits.initiation, ONLINE_MS.init);
  }
});

test('WC21: an unanswered attack lands after 15 s', () => {
  const rng = seeded(11);
  const now = 5_000_000;
  // Seat 0 plays The Tower on seat 1; the others pass, and seat 1 never answers.
  for (let seed = 0; seed < 200; seed++) {
    let o = startOnline(3, 50, 'mixed', keys.v, slim, seeded(seed), now);
    const g = o.g;
    const who = actor(g);
    if (g.phase !== 'initiation' || who == null || !g.hands[who].includes('tower')) continue;
    const target = targetsFor(g.hands, who, 'tower', g.active)[0];
    o = stepOnline(o, { type: 'PLAY', play: { card: 'tower', target } }, who, { dropped: [], swipes: {} }, slim, rng, now + 100);
    let t = now + 100;
    while (o.g.phase === 'initiation') {
      const a = actor(o.g)!;
      t += 100;
      o = stepOnline(o, { type: 'PASS' }, a, { dropped: [], swipes: {} }, slim, rng, t);
    }
    if (o.g.phase !== 'reaction') continue;
    assert.equal(o.deadline, t + ONLINE_MS.react);
    const held = stepOnline(o, { type: 'TICK' }, null, { dropped: [], swipes: {} }, slim, rng, t + ONLINE_MS.react - 1);
    assert.equal(held.g.phase, 'reaction');
    const landed = stepOnline(o, { type: 'TICK' }, null, { dropped: [], swipes: {} }, slim, rng, t + ONLINE_MS.react);
    assert.notEqual(landed.g.phase, 'reaction');
    assert.ok(landed.g.log.some((l) => l.k === 'hit' && l.card === 'tower') || landed.g.log.some((l) => l.k === 'cancel'));
    return;
  }
  assert.fail('no seed dealt The Tower to the first player');
});

test('only the seat whose turn it is can move', () => {
  const o = startOnline(3, 50, 'mixed', keys.v, slim, seeded(3), 1000);
  const who = actor(o.g)!;
  const other = [0, 1, 2].find((s) => s !== who)!;
  assert.equal(stepOnline(o, { type: 'PASS' }, other, { dropped: [], swipes: {} }, slim, seeded(1), 1100), o);
  assert.notEqual(stepOnline(o, { type: 'PASS' }, who, { dropped: [], swipes: {} }, slim, seeded(1), 1100), o);
});

test('WC23: the Boss Round is everyone at once, scored from each phone’s swipes', () => {
  const { o } = playOut(21, 2, () => false);
  assert.equal(o.g.phase, 'done');
  const bossLogs = o.g.log.filter((l) => l.k === 'boss');
  assert.ok(bossLogs.length >= 1);
  for (const l of bossLogs) if (l.k === 'boss') for (const p of Object.values(l.points)) assert.equal(p, 60);
});

test('a player who leaves is taken out, and the last one standing wins', () => {
  const { o } = playOut(5, 2, () => false, { seat: 1, at: 30 });
  assert.equal(o.g.phase, 'done');
  assert.deepEqual(o.g.result!.winners, [0]);
  assert.deepEqual(onlineRanks(o.g), [1, 2]);
});
