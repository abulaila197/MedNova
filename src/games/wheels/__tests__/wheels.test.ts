/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { deal, mirrorSwap, playable, react, reactions, startChain, type Card } from '../cards';
import {
  judge, soloExp, spinCombo, spinField, FIELDS, startSolo, startTurn, stepSolo, stepTurn, turnPoints, STAR_WINDOW_MS, STYLES, STYLE_KEYS,
  type Answer, type Question, type Rng, type Turn,
} from '../core';
import { actor, canRedeem, startOffline, stepOffline, BOSS_BONUS, BOSS_ITEMS, REDEMPTION_ITEMS, type FullBank, type OfflineGame } from '../offline';
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
  }
};

/** Plays the turn to the end, every answer right (or all left to time out). */
function playTurn(t: Turn, right = true, now = 0): Turn {
  let x = t;
  const rng = seeded(9);
  for (let i = 0; i < 40 && x.phase !== 'over'; i++) {
    now += 1000;
    if (x.phase === 'reveal') x = stepTurn(x, { type: 'GO', now }, bank, rng);
    else if (x.phase === 'star') x = stepTurn(x, { type: 'KEEP', now }, bank, rng);
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

test('a turn asks Count questions, scores by style and the Sun doubles it', () => {
  const t = playTurn(startTurn(bank, [], seeded(3), { sun: true }));
  assert.equal(t.phase, 'over');
  assert.equal(t.results.length, t.count);
  const raw = t.results.reduce((a, r) => a + STYLES[r.style].points, 0);
  assert.equal(turnPoints(t), raw * 2);
  const missed = playTurn(startTurn(bank, [], seeded(3)), false);
  assert.equal(turnPoints(missed), 0);
  assert.ok(missed.results.every((r) => r.answer === null));
});

test('WC5: the Star opens a 3 s window after the first wheels; a re-spin keeps the style', () => {
  const rng = seeded(4);
  let t = startTurn(bank, [], rng, { star: true });
  t = stepTurn(t, { type: 'GO', now: 1000 }, bank, rng);
  assert.equal(t.phase, 'star');
  assert.equal(t.until, 1000 + STAR_WINDOW_MS);
  const style = t.combo.style;
  t = stepTurn(t, { type: 'STAR', now: 2000 }, bank, rng);
  assert.equal(t.phase, 'reveal');
  assert.equal(t.combo.style, style);
  t = stepTurn(t, { type: 'GO', now: 3000 }, bank, rng);
  assert.equal(t.phase, 'question');
  // Window runs out on its own: straight to the question.
  let u = stepTurn(startTurn(bank, [], rng, { star: true }), { type: 'GO', now: 0 }, bank, rng);
  u = stepTurn(u, { type: 'TICK', now: STAR_WINDOW_MS }, bank, rng);
  assert.equal(u.phase, 'question');
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

test('cards: 2 unique each, the rest out of the game', () => {
  const hands = deal(3, seeded(7));
  assert.equal(new Set(hands.flat()).size, 6);
  assert.ok(hands.every((h) => h.length === 2));
});

const H = (...hs: Card[][]) => hs;

test('reaction chain (spec 8.4): Magician, Mirror, then the sender Hermits it: nobody hurt', () => {
  const active = [0, 1, 2];
  let c = startChain({ by: 0, card: 'tower', target: 1 }, H(['hermit'], ['magician'], ['mirror']), active);
  assert.deepEqual(reactions(c, active), ['magician']);
  c = react(c, 'magician', active, 2);
  assert.equal(c.holder, 2);
  c = react(c, 'mirror', active);
  assert.equal(c.holder, 0);
  assert.deepEqual(reactions(c, active), ['hermit']); // no Mirror once back at the sender
  c = react(c, 'hermit', active);
  assert.deepEqual(c.result, { victim: null });
  assert.deepEqual(c.hands, [[], [], []]);
});

test('reaction chain: undefended sender takes the bounce; Magician user may Hermit it first', () => {
  const active = [0, 1, 2];
  let c = startChain({ by: 0, card: 'tower', target: 1 }, H([], ['magician'], ['mirror']), active);
  c = react(react(c, 'magician', active, 2), 'mirror', active);
  assert.deepEqual(c.result, { victim: 0 }); // sender holds nothing: lands without asking
  let d = startChain({ by: 0, card: 'tower', target: 1 }, H([], ['magician', 'hermit'], ['mirror']), active);
  d = react(react(d, 'magician', active, 2), 'mirror', active);
  assert.equal(d.holder, 1);
  assert.equal(d.cleanup, true);
  d = react(d, 'hermit', active);
  assert.deepEqual(d.result, { victim: null });
});

test('Magician needs a third player; Mirror does not answer a Moon', () => {
  const c = startChain({ by: 0, card: 'tower', target: 1 }, H([], ['magician']), [0, 1]);
  assert.deepEqual(c.result, { victim: 1 });
  const m = startChain({ by: 0, card: 'moon', target: 1 }, H([], ['mirror'], []), [0, 1, 2]);
  assert.deepEqual(m.result, { victim: 1 });
});

test('WC4: Mirror swap gives the picked card for a random one; empty hands cannot be picked', () => {
  const hands = H(['mirror', 'sun'], ['tower', 'moon'], []);
  assert.ok(playable(hands, 0, [0, 1, 2]).includes('mirror'));
  const { hands: after, got } = mirrorSwap(hands, 0, 1, 'sun', seeded(8));
  assert.ok(got === 'tower' || got === 'moon');
  assert.deepEqual(after[0], [got]);
  assert.ok(after[1].includes('sun') && after[1].length === 2);
  assert.ok(!playable(H(['mirror', 'sun'], [], []), 0, [0, 1, 2]).includes('mirror'));
  assert.ok(!playable(H(['mirror'], ['tower'], []), 0, [0, 1, 2]).includes('mirror')); // nothing to give
});

/** A bot that plays every card at the next seat and answers with a given hit rate. */
function drive(g0: OfflineGame, seed: number, hit = 0.6, maxSteps = 20000) {
  const rng = seeded(seed);
  const pick = seeded(seed + 1);
  let g = g0;
  let now = 0;
  for (let i = 0; i < maxSteps && g.phase !== 'done'; i++) {
    now += 500;
    const me = actor(g)!;
    const next = g.active[(g.active.indexOf(me) + 1) % g.active.length];
    switch (g.phase) {
      case 'initiation': {
        const card = playable(g.hands, me, g.active)[0];
        if (card === 'star' || card === 'sun') g = stepOffline(g, { type: 'PLAY', play: { card } }, bank, rng);
        else if (card === 'tower' || card === 'moon') g = stepOffline(g, { type: 'PLAY', play: { card, target: next } }, bank, rng);
        else if (card === 'mirror') {
          const target = g.active.find((s) => s !== me && g.hands[s].length)!;
          g = stepOffline(g, { type: 'PLAY', play: { card, target, give: g.hands[me].find((c) => c !== 'mirror')! } }, bank, rng);
        } else g = stepOffline(g, { type: 'PASS' }, bank, rng);
        break;
      }
      case 'reaction': {
        const opts = reactions(g.chain!, g.active);
        const to = g.active.find((s) => s !== g.chain!.attack.by && s !== g.chain!.holder);
        g = stepOffline(g, { type: 'REACT', choice: opts[0] ?? null, to }, bank, rng);
        break;
      }
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
        else if (t.phase === 'star') g = stepOffline(g, { type: 'TURN', e: { type: 'STAR', now } }, bank, rng);
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

test('Offline: whole games finish, by target or after Boss Round 3', () => {
  for (const seats of [2, 3, 4]) {
    for (const seed of [11, 12, 13]) {
      const g = drive(startOffline(seats, 100, bank, seeded(seed)), seed);
      assert.equal(g.phase, 'done', `${seats} players, seed ${seed}`);
      assert.ok(g.result!.winners.length >= 1);
      const top = Math.max(...g.active.map((s) => g.scores[s]));
      assert.ok(g.result!.winners.every((s) => g.scores[s] === top));
    }
  }
  // A low hit rate on 100 runs all three cycles and three Boss Rounds.
  const slow = drive(startOffline(3, 100, bank, seeded(21)), 21, 0.1);
  assert.equal(slow.log.filter((l) => l.k === 'boss').length, 3);
  assert.ok(slow.log.filter((l) => l.k === 'boss').every((l) => l.k === 'boss' && l.bonus === Math.floor(BOSS_BONUS / l.winners.length)));
});

test('Offline: the game stops the moment someone reaches the target', () => {
  const g = drive(startOffline(2, 50, bank, seeded(31)), 31, 1);
  assert.equal(g.phase, 'done');
  assert.ok(g.result!.winners.every((s) => g.scores[s] >= 50));
  assert.ok(g.log.filter((l) => l.k === 'boss').length < 3);
});

test('WC2/WC3: The World is offered to the lowest (ties too), after a round, once a cycle', () => {
  const g0 = startOffline(3, 100, bank, seeded(41));
  const g = { ...g0, hands: [['world'], [], []] as Card[][], scores: [5, 5, 9] };
  assert.equal(canRedeem(g, 0), false); // no round played yet
  assert.equal(canRedeem({ ...g, roundsPlayed: 1 }, 0), true); // tied lowest
  assert.equal(canRedeem({ ...g, roundsPlayed: 1, scores: [9, 5, 5] }, 0), false);
  assert.equal(canRedeem({ ...g, roundsPlayed: 1, worldCycle: 0 }, 0), false);
  assert.equal(canRedeem({ ...g, roundsPlayed: 3, cycle: 1, worldCycle: 0 }, 0), true);
});

test('Offline: a Moon removes the turn; the last player left wins', () => {
  let g = startOffline(3, 100, bank, seeded(51));
  g = { ...g, hands: [['moon'], [], []], init: { at: -1, plays: 0 } };
  g = { ...g, order: [0, 1, 2], phase: 'initiation', init: { at: 0, plays: 0 } };
  const rng = seeded(52);
  g = stepOffline(g, { type: 'PLAY', play: { card: 'moon', target: 1 } }, bank, rng);
  assert.deepEqual(g.skipped, [1]);
  assert.equal(g.phase, 'turn');
  assert.equal(actor(g), 0);
  g = stepOffline(g, { type: 'REMOVE', seat: 0 }, bank, rng);
  assert.equal(actor(g), 2); // seat 1 is skipped, seat 0 left
  g = stepOffline(g, { type: 'REMOVE', seat: 2 }, bank, rng);
  assert.equal(g.phase, 'done');
  assert.deepEqual(g.result!.winners, [1]);
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
