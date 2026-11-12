/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  judge, soloExp, spinCombo, spinField, FIELDS, startSolo, startTurn, stepSolo, stepTurn, turnPoints, STYLES, STYLE_KEYS,
  type Answer, type Question, type Rng, type Turn,
} from '../core';
import { actor, canRedeem, startOffline, stepOffline, upgradeSaved, bossBonus, MAX_ACTS, BOSS_ITEMS, REDEMPTION_ITEMS, redemptionItems, type FullBank, type OfflineGame } from '../offline';
import { SAMPLE_BANK as bank } from '../data/samples';

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
    case 'closest': return q.answer;
    case 'order': return q.items.map((_, i) => i);
  }
};

/** Plays the turn to the end, every answer right (or all left to time out). */
function playTurn(t: Turn, right = true, now = 0): Turn {
  let x = t;
  const rng = seeded(9);
  for (let i = 0; i < 40 && x.phase !== 'over'; i++) {
    now += 1000;
    if (x.phase === 'reveal') x = stepTurn(x, { type: 'GO', now }, bank, rng);
    else if (x.phase === 'question') x = right ? stepTurn(x, { type: 'ANSWER', answer: rightAnswer(x.question), now }, bank, rng) : stepTurn(x, { type: 'TICK', now: now + 60_000 }, bank, rng);
    else if (x.phase === 'feedback') x = stepTurn(x, { type: 'TICK', now: now + 5000 }, bank, rng);
  }
  return x;
}

test('judge: each style, with all-or-nothing Rule 2 Out and Matching', () => {
  const q = (id: string) => bank.questions.find((x) => x.id === id)!;
  assert.equal(judge(q('mcq-1'), 0), true);
  assert.equal(judge(q('mcq-1'), 1), false);
  assert.equal(judge(q('tf-1'), false), true);
  assert.equal(judge(q('r2o-1'), [4, 2]), true);
  assert.equal(judge(q('r2o-1'), [2, 3]), false);
  assert.equal(judge(q('r2o-1'), [2, 2]), false);
  assert.equal(judge(q('match-1'), [0, 1, 2, 3, 4, 5]), true);
  assert.equal(judge(q('match-1'), [0, 1, 2, 3, 5, 4]), false);
  assert.equal(judge(q('lie-1'), 2), true);
  assert.equal(judge(q('mcq-1'), null), false);
});

test('wheels: counts weigh 40/35/25 and the same style+field pair re-spins once', () => {
  const rng = seeded(1);
  const n = [0, 0, 0, 0];
  for (let i = 0; i < 20000; i++) n[startTurn(bank, [], rng).count]++;
  assert.ok(Math.abs(n[1] / 20000 - 0.4) < 0.02 && Math.abs(n[3] / 20000 - 0.25) < 0.02);
  // A fixed rng lands on the same pair twice; the reroll is taken once and then accepted.
  const fixed = () => 0;
  const c = spinCombo(null, fixed);
  assert.deepEqual(spinCombo(c, fixed), c);
});

test('QS1: Clinical or Basic spins only that group of fields; Mixed spins both', () => {
  const rng = seeded(11);
  const group = (k: string) => FIELDS.find((f) => f.key === k)!.group;
  for (let i = 0; i < 300; i++) {
    assert.equal(group(spinField(rng, 'clinical')), 'clinical');
    assert.equal(group(spinField(rng, 'basic')), 'basic');
  }
  const mixed = new Set(Array.from({ length: 300 }, () => group(spinField(rng))));
  assert.equal(mixed.size, 2);
  const run = startSolo(bank, 50, [], rng, 'clinical');
  assert.equal(group(run.turn!.combo.field), 'clinical');
  const g = startOffline(3, 50, bank, rng, 'basic');
  assert.equal(g.mix, 'basic');
});

test('a turn asks Count questions and scores by style', () => {
  const t = playTurn(startTurn(bank, [], seeded(3)));
  assert.equal(t.phase, 'over');
  assert.equal(t.results.length, t.count);
  const raw = t.results.reduce((a, r) => a + STYLES[r.style].points, 0);
  assert.equal(turnPoints(t), raw);
  const missed = playTurn(startTurn(bank, [], seeded(3)), false);
  assert.equal(turnPoints(missed), 0);
  assert.ok(missed.results.every((r) => r.answer === null));
});

test('#39b: every question in a turn has the turn\'s style and field, with no new spin in between', () => {
  // The real bank has every style in every field, so the turn never has to borrow another kind of question.
  const real = JSON.parse(readFileSync('src/games/wheels/data/bank.json', 'utf8')) as FullBank;
  for (let seed = 1; seed <= 60; seed++) {
    const rng = seeded(seed);
    let t = stepTurn(startTurn(real, [], rng), { type: 'GO', now: 0 }, real, rng);
    const first = t.combo;
    let now = 0;
    while (t.phase !== 'over') {
      now += 100_000;
      t = stepTurn(t, t.phase === 'question' ? { type: 'ANSWER', answer: rightAnswer(t.question), now } : { type: 'TICK', now }, real, rng);
      assert.notEqual(t.phase, 'reveal', 'no second spin inside a turn');
      if (t.phase !== 'over') assert.deepEqual(t.combo, first);
    }
    assert.equal(t.results.length, t.count);
    assert.ok(t.results.every((r) => r.style === first.style && r.field === first.field), `seed ${seed}`);
  }
});

test('#39a: no Star window: the first wheels go straight to the question', () => {
  const rng = seeded(4);
  const t = stepTurn(startTurn(bank, [], rng), { type: 'GO', now: 1000 }, bank, rng);
  assert.equal(t.phase, 'question');
});

test('pause freezes the question timer', () => {
  const rng = seeded(5);
  let t = stepTurn(startTurn(bank, [], rng), { type: 'GO', now: 0 }, bank, rng);
  const until = t.until!;
  t = stepTurn(t, { type: 'PAUSE', now: 1000 }, bank, rng);
  t = stepTurn(t, { type: 'TICK', now: until + 10 }, bank, rng);
  assert.equal(t.phase, 'question');
  t = stepTurn(t, { type: 'RESUME', now: 11_000 }, bank, rng);
  assert.equal(t.until, until + 10_000);
});

test('Solo runs turns until the target; EXP is half the points rounded down (WC11)', () => {
  const rng = seeded(6);
  let s = startSolo(bank, 50, [], rng);
  let now = 0;
  for (let i = 0; i < 2000 && s.phase !== 'done'; i++) {
    now += 1000;
    const t = s.turn!;
    if (s.phase === 'turnOver') s = stepSolo(s, { type: 'NEXT' }, bank, rng);
    else if (t.phase === 'reveal') s = stepSolo(s, { type: 'GO', now }, bank, rng);
    else if (t.phase === 'question') s = stepSolo(s, { type: 'ANSWER', answer: rightAnswer(t.question), now }, bank, rng);
    else s = stepSolo(s, { type: 'TICK', now: now + 5000 }, bank, rng);
  }
  assert.equal(s.phase, 'done');
  assert.ok(s.score >= 50);
  assert.equal(soloExp(51), 25);
});

/** A bot that takes every Redemption offered and answers with a given hit rate. */
function drive(g0: OfflineGame, seed: number, hit = 0.6, maxSteps = 20000) {
  const rng = seeded(seed);
  const pick = seeded(seed + 1);
  let g = g0;
  let now = 0;
  for (let i = 0; i < maxSteps && g.phase !== 'done'; i++) {
    now += 500;
    void actor(g);
    switch (g.phase) {
      case 'redemptionOffer': g = stepOffline(g, { type: 'REDEEM', use: true }, bank, rng); break;
      case 'redemption': {
        const r = g.redemption!;
        const q = r.items[r.index];
        g = r.phase === 'reveal' ? stepOffline(g, { type: 'RED', e: { type: 'GO', now } }, bank, rng)
          : stepOffline(g, { type: 'RED', e: { type: 'ANSWER', value: q.style === 'tf' ? q.answer : true, now } }, bank, rng);
        break;
      }
      case 'turn': {
        const t = g.turn!;
        if (t.phase === 'reveal') g = stepOffline(g, { type: 'TURN', e: { type: 'GO', now } }, bank, rng);
        else if (t.phase === 'question') g = stepOffline(g, { type: 'TURN', e: { type: 'ANSWER', answer: pick() < hit ? rightAnswer(t.question) : null, now } }, bank, rng);
        else g = stepOffline(g, { type: 'TURN', e: { type: 'TICK', now: now + 5000 } }, bank, rng);
        break;
      }
      case 'boss': {
        const b = g.boss!;
        const seat = b.order[b.at];
        const k = (b.swipes[seat] ?? []).length;
        g = b.phase === 'ready' ? stepOffline(g, { type: 'BOSS', e: { type: 'GO', now } }, bank, rng)
          : stepOffline(g, { type: 'BOSS', e: { type: 'SWIPE', fits: pick() < 0.7 ? b.items[b.decks[seat][k]].fits : !b.items[b.decks[seat][k]].fits, now } }, bank, rng);
        break;
      }
      case 'turnOver': case 'bossOver': g = stepOffline(g, { type: 'NEXT' }, bank, rng); break;
    }
  }
  return g;
}

test('Offline: whole games finish, by target or at the Act X safety stop', () => {
  for (const seats of [2, 3, 4]) {
    for (const seed of [11, 12, 13]) {
      const g = drive(startOffline(seats, 100, bank, seeded(seed)), seed);
      assert.equal(g.phase, 'done', `${seats} players, seed ${seed}`);
      assert.ok(g.result!.winners.length >= 1);
      const top = Math.max(...g.active.map((s) => g.scores[s]));
      assert.ok(g.result!.winners.every((s) => g.scores[s] === top));
    }
  }
  // A low hit rate on 100 plays on past Act III (extra acts of 2 rounds) to the safety stop.
  const slow = drive(startOffline(3, 100, bank, seeded(21)), 21, 0.1);
  const bosses = slow.log.filter((l) => l.k === 'boss').length;
  assert.equal(slow.phase, 'done');
  assert.ok(bosses > 3 && bosses <= MAX_ACTS, `${bosses} Boss Rounds`);
  assert.ok(slow.log.filter((l) => l.k === 'boss').every((l) => l.k === 'boss' && l.bonus === Math.floor(bossBonus(slow.target) / l.winners.length)));
});

test('Offline: the game stops the moment someone reaches the target', () => {
  const g = drive(startOffline(2, 25, bank, seeded(31)), 31, 1);
  assert.equal(g.phase, 'done');
  assert.ok(g.result!.winners.every((s) => g.scores[s] >= 25));
  assert.ok(g.log.filter((l) => l.k === 'boss').length < 3);
});

test('#22: Redemption goes to last place (ties too), only in the final round of Act III, once a game', () => {
  const g0 = startOffline(3, 100, bank, seeded(41));
  const g = { ...g0, scores: [5, 5, 9] };
  const fin = { ...g, cycle: 2, round: 1 };
  assert.equal(canRedeem(g, 0), false); // first round
  assert.equal(canRedeem({ ...g, roundsPlayed: 2, round: 2 }, 0), false); // last round of Act I is not the final round
  assert.equal(canRedeem({ ...g, cycle: 2, round: 0 }, 0), false); // Act III, not its last round
  assert.equal(canRedeem(fin, 0), true); // tied lowest
  assert.equal(canRedeem(fin, 1), true);
  assert.equal(canRedeem(fin, 2), false); // not last
  assert.equal(canRedeem({ ...fin, redCycle: 2 }, 0), false); // used this game
});

test('#22: in real games Redemption is played at most once, and only in the final round', () => {
  for (const seats of [2, 3, 4]) {
    for (const seed of [61, 62, 63]) {
      const g = drive(startOffline(seats, 100, bank, seeded(seed)), seed, 0.3);
      assert.equal(g.phase, 'done');
      const reds = g.log.filter((l) => l.k === 'redemption').length;
      assert.ok(reds <= 1, `${seats} players seed ${seed}: ${reds} Redemptions`);
      assert.ok(g.redCycle == null || g.redCycle === 2);
    }
  }
});

test('#39a: the turn order runs every seat, and removing players still ends with the last one standing', () => {
  let g = startOffline(3, 100, bank, seeded(51));
  const rng = seeded(52);
  assert.equal(g.phase, 'turn');
  const first = actor(g)!;
  assert.equal(first, g.order[0]);
  g = stepOffline(g, { type: 'REMOVE', seat: first }, bank, rng);
  assert.equal(actor(g), g.order[1]);
  g = stepOffline(g, { type: 'REMOVE', seat: g.order[1] }, bank, rng);
  assert.equal(g.phase, 'done');
  assert.deepEqual(g.result!.winners, [g.order[2]]);
});

test('#39a: a game saved with tarot cards loads without them', () => {
  const g = startOffline(3, 100, bank, seeded(71));
  const old = {
    ...g, phase: 'initiation', hands: [['star'], ['world'], []], init: { at: 0, plays: 0 }, attacks: [], chain: null, skipped: [], sun: [], star: [],
    worldCycle: 0, log: [{ k: 'play', seat: 0, card: 'star' }, { k: 'turn', seat: 1, points: 4, sun: false }],
  } as unknown as OfflineGame;
  const n = upgradeSaved(old, bank, seeded(72));
  assert.equal(n.phase, 'turn');
  assert.equal(n.redCycle, 0);
  assert.ok(!('hands' in n) && !('chain' in n));
  assert.deepEqual(n.log.map((l) => l.k), ['turn']);
  assert.equal(upgradeSaved(g, bank, seeded(72)), g); // a new save is left alone
});

test('WC10: the real bank covers every style in every field, with Redemption and Boss sets per field', () => {
  const full = JSON.parse(readFileSync('src/games/wheels/data/bank.json', 'utf8')) as FullBank;
  for (const f of FIELDS) {
    for (const st of STYLE_KEYS) assert.ok(full.questions.some((q) => q.field === f.key && q.style === st), `${f.key} ${st}`);
    assert.ok(full.redemption.filter((q) => q.field === f.key).length >= REDEMPTION_ITEMS, `${f.key} redemption`);
    assert.ok(full.boss.some((b) => b.field === f.key && b.items.length === BOSS_ITEMS), `${f.key} boss`);
  }
  assert.equal(new Set([...full.questions, ...full.redemption].map((q) => q.id)).size, full.questions.length + full.redemption.length);
});

test('WC19: Redemption plays one written round in order, unplayed rounds first, never the last one again', () => {
  const full = JSON.parse(readFileSync('src/games/wheels/data/bank.json', 'utf8')) as FullBank;
  const rng = seeded(7);
  const used: number[] = [];
  for (let i = 0; i < 10; i++) {
    const { items, round } = redemptionItems(full, 'surgery', rng, used);
    assert.equal(items.length, REDEMPTION_ITEMS);
    assert.ok(items.every((q) => q.field === 'surgery' && q.round === round));
    assert.ok(!used.includes(round!));
    used.push(round!);
  }
  for (let i = 0; i < 20; i++) {
    const { round } = redemptionItems(full, 'surgery', rng, used);
    assert.notEqual(round, used[used.length - 1]);
    used.push(round!);
  }
});

test('Play on: a 50-point game keeps going after Act III until someone reaches 50', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const g = drive(startOffline(2, 50, bank, seeded(seed)), seed, 1);
    assert.equal(g.phase, 'done');
    assert.ok(g.result!.winners.every((s) => g.scores[s] >= 50), `seed ${seed}: ${g.scores.join('/')}`);
  }
});
