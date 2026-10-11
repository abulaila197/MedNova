/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { draw, makeBank, SOLO_STYLES, type BankQ, type McqQ, type Rng, type StandingQ } from '../bank';
import {
  active, BALANCE, botMoves, CARD_TYPES, clueIndex, landsOf, makeBoard, maxMoves, pickVersusStyle, soloPoints, spyView, standings,
  startMatch, step, suggest, typedMatches, type Action, type Match, type SoloAnswers,
} from '../core';

const list = JSON.parse(readFileSync('src/games/conqueror/data/bank.json', 'utf8')) as BankQ[];
const bank = makeBank(list);

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

const people = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, color: '#000' }));

function game(n = 3, seed = 1) {
  const ctx = { bank, rng: seeded(seed) };
  let m = startMatch(people(n), 'mixed', ctx.rng);
  const go = (a: Action) => {
    const next = step(m, a, ctx);
    const ok = next !== m;
    m = next;
    return ok;
  };
  return { ctx, get m() { return m; }, set m(v: Match) { m = v; }, go };
}

/** The right answers for a player's solo tile. */
function rightSolo(m: Match, id: string): SoloAnswers {
  const t = m.solo[id];
  switch (t.style) {
    case 'mcq': return t.questions.map((q) => (q as McqQ).answer);
    case 'tf': return t.questions.map((q) => (q.style === 'tf' ? q.answer : false));
    case 'order': return t.questions[0].style === 'order' ? [...t.questions[0].items] : [];
    case 'match': return t.questions[0].style === 'match' ? t.questions[0].pairs.map(([, r]) => r) : [];
    default: return [];
  }
}

/** Plays both solo rounds with every player answering right and picking the first free question tile. */
function playSolo(g: ReturnType<typeof game>) {
  for (let r = 0; r < 2; r++) {
    for (const p of active(g.m)) {
      const tile = g.m.board.find((t) => !t.by && t.kind === 'question')!;
      assert.ok(g.go({ type: 'pick', player: p.id, tile: tile.n }));
    }
    assert.equal(g.m.phase, 'solo_play');
    for (const p of active(g.m)) assert.ok(g.go({ type: 'solo', player: p.id, answers: rightSolo(g.m, p.id) }));
  }
}

test('bank: 4,390 clean items in 8 styles (10 skipped, CQ18)', () => {
  assert.equal(list.length, 4390);
  const raw = JSON.stringify(list);
  assert.ok(!/fuck/i.test(raw));
  for (const q of bank.byStyle.mcq) {
    const bracketed = q.options.filter((o) => o.includes('('));
    assert.ok(!(bracketed.length === 1 && q.options[q.answer].includes('(')), q.id);
  }
  for (const q of bank.byStyle.rush) for (const a of q.answers) assert.ok((a.aliases ?? []).length <= 2 && !a.label.includes('('), q.id);
  for (const q of bank.byStyle.clue) assert.ok(!q.answer.label.includes('(') && q.clues.length === 4, q.id);
});

test('draw: options are shuffled, the answer moves with them, nothing repeats', () => {
  const used = new Set<string>();
  const rng = seeded(7);
  const qs = draw(bank, 'mcq', 200, 'mixed', used, rng);
  assert.equal(new Set(qs.map((q) => q.id)).size, 200);
  const firsts = qs.filter((q) => q.answer === 0).length;
  assert.ok(firsts < 100, `answer first ${firsts}/200`);
  for (const q of qs) {
    const src = bank.byStyle.mcq.find((x) => x.id === q.id)!;
    assert.equal(q.options[q.answer], src.options[src.answer]);
  }
  const ls = draw(bank, 'standing', 50, 'clinical', new Set(), rng) as StandingQ[];
  for (const q of ls) {
    const src = bank.byStyle.standing.find((x) => x.id === q.id)!;
    assert.deepEqual(q.answers.map((i) => q.options[i]).sort(), src.answers.map((i) => src.options[i]).sort());
    assert.ok(['medicine', 'surgery', 'pediatrics', 'obgyn'].includes(q.field));
  }
});

test('setup: 2 to 6 players, capital 30,000 and 2 outposts of 10,000 each', () => {
  assert.throws(() => startMatch(people(1), 'mixed', seeded(1)));
  assert.throws(() => startMatch(people(7), 'mixed', seeded(1)));
  const m = startMatch(people(6), 'mixed', seeded(1));
  assert.equal(m.landOrder.length, 18);
  for (const id of m.order) {
    const lands = landsOf(m, id);
    assert.deepEqual(lands.map((l) => [l.capital, l.troops]), [[true, 30000], [false, 10000], [false, 10000]]);
  }
});

test('board: 60 tiles, all 11 cards, 49 questions shared by the 4 styles', () => {
  const b = makeBoard(seeded(3));
  assert.equal(b.length, 60);
  assert.deepEqual(b.filter((t) => t.kind === 'card').map((t) => t.card).sort(), [...CARD_TYPES].sort());
  for (const s of SOLO_STYLES) assert.ok(b.filter((t) => t.style === s).length >= 12);
});

test('solo scoring: CQ5 table', () => {
  assert.deepEqual([3, 2, 1, 0].map((c) => soloPoints('mcq', c)), [2, 1, 'penalty', 'penalty']);
  assert.deepEqual([5, 4, 3, 2].map((c) => soloPoints('match', c)), [3, 2, 2, 'penalty']);
});

test('solo round: right answers earn reserve troops; a failed tile costs 1,000; card tiles give cards', () => {
  const g = game(2);
  const q = g.m.board.find((t) => t.kind === 'question')!;
  const c = g.m.board.find((t) => t.kind === 'card')!;
  assert.ok(g.go({ type: 'pick', player: 'p1', tile: q.n }));
  assert.ok(!g.go({ type: 'pick', player: 'p2', tile: q.n }), 'tile already taken');
  assert.ok(g.go({ type: 'pick', player: 'p2', tile: c.n }));
  assert.deepEqual(g.m.players.p2.cards, [c.card]);
  const style = g.m.solo.p1.style!;
  assert.ok(g.go({ type: 'solo', player: 'p1', answers: rightSolo(g.m, 'p1') }));
  assert.equal(g.m.players.p1.reserve, (style === 'mcq' || style === 'tf' ? 2 : 3) * 1000);
  assert.equal(g.m.round, 2);
  // Round 2: p1 fails, timeout scores it all wrong.
  const q2 = g.m.board.find((t) => !t.by && t.kind === 'question')!;
  g.go({ type: 'pick', player: 'p1', tile: q2.n });
  g.go({ type: 'timeout' }); // pick clock: p2 gets a random tile
  assert.ok(g.m.solo.p2);
  const before = g.m.players.p1.reserve;
  g.go({ type: 'timeout' }); // answer clock
  assert.equal(g.m.players.p1.reserve, before - 1000);
  assert.equal(g.m.phase, 'versus');
});

test('joker switches the tile style and is used up', () => {
  const g = game(2);
  g.m.players.p1.cards = ['joker'];
  const q = g.m.board.find((t) => t.kind === 'question' && t.style === 'mcq')!;
  g.go({ type: 'pick', player: 'p1', tile: q.n });
  g.go({ type: 'pick', player: 'p2', tile: g.m.board.find((t) => !t.by && t.kind === 'question')!.n });
  assert.ok(g.go({ type: 'joker', player: 'p1', style: 'order' }));
  assert.equal(g.m.solo.p1.style, 'order');
  assert.equal(g.m.solo.p1.questions[0].style, 'order');
  assert.deepEqual(g.m.players.p1.cards, []);
});

test('versus style is random but never twice in a row', () => {
  const rng = seeded(9);
  let last = pickVersusStyle(undefined, rng);
  const seen = new Set([last]);
  for (let i = 0; i < 200; i++) {
    const next = pickVersusStyle(last, rng);
    assert.notEqual(next, last);
    seen.add(next);
    last = next;
  }
  assert.equal(seen.size, 4);
});

test('typed answers: main name, 2 other names, small typos, no others', () => {
  const n = { label: 'Antidiuretic Hormone', aliases: ['ADH', 'Vasopressin'] };
  assert.ok(typedMatches('antidiuretic hormone', n));
  assert.ok(typedMatches('Vasopresin', n));
  assert.ok(typedMatches('adh', n));
  assert.ok(!typedMatches('aldosterone', n));
  assert.ok(typedMatches('Crohns disease', { label: "Crohn's disease" }));
  const chips = suggest(clueIndex(bank), 'vaso');
  assert.ok(chips.length >= 1 && chips.length <= 3);
  assert.deepEqual(suggest(clueIndex(bank), 'vas'), []);
});

/** Drives a match to the versus round of stage 1 with a chosen style. */
function toVersus(n: number, style: 'closest' | 'rush' | 'standing' | 'clue', seed = 1) {
  for (let s = seed; s < seed + 200; s++) {
    const g = game(n, s);
    playSolo(g);
    if (g.m.versus?.style === style) return g;
  }
  throw new Error('style not drawn');
}

test('versus payout: 1st 5 pts, 2nd 2 pts (CQ13)', () => {
  const g = toVersus(3, 'rush');
  const v = g.m.versus!;
  assert.equal(v.style, 'rush');
  const answers = v.style === 'rush' ? v.q.answers : [];
  const base = Object.fromEntries(g.m.order.map((id) => [id, g.m.players[id].reserve]));
  g.go({ type: 'rush', player: 'p2', text: answers[0].label, ms: 1000 });
  assert.ok(!g.go({ type: 'rush', player: 'p2', text: answers[0].label, ms: 1200 }), 'same answer twice');
  g.go({ type: 'rush', player: 'p2', text: answers[1].label, ms: 2000 });
  g.go({ type: 'rush', player: 'p3', text: answers[0].label, ms: 1500 });
  assert.ok(!g.go({ type: 'rush', player: 'p1', text: 'zzzz', ms: 100 }));
  g.go({ type: 'timeout' });
  assert.equal(g.m.phase, 'gap_cards');
  assert.deepEqual(g.m.lastVersus!.ranking.slice(0, 2), ['p2', 'p3']);
  assert.equal(g.m.players.p2.reserve - base.p2, 5000);
  assert.equal(g.m.players.p3.reserve - base.p3, 2000);
  assert.equal(g.m.players.p1.reserve - base.p1, 0);
});

test('last one standing: the bank decides right answers; when all are right the slowest loses a heart', () => {
  const g = toVersus(2, 'standing');
  const v = () => g.m.versus as Extract<Match['versus'], { style: 'standing' }>;
  const right = () => v().qs[v().index].answers;
  g.go({ type: 'standing', player: 'p1', picks: right(), ms: 2000 });
  g.go({ type: 'standing', player: 'p2', picks: right(), ms: 3000 });
  assert.deepEqual(v().hearts, { p1: 2, p2: 1 });
  g.go({ type: 'standing', player: 'p1', picks: right(), ms: 2000 });
  g.go({ type: 'standing', player: 'p2', picks: [5], ms: 1000 });
  assert.equal(g.m.phase, 'gap_cards');
  assert.deepEqual(g.m.lastVersus!.ranking, ['p1', 'p2']);
});

test('clue ladder: earlier clue scores more, -5 per wrong guess', () => {
  const g = toVersus(2, 'clue');
  const v = g.m.versus as Extract<Match['versus'], { style: 'clue' }>;
  g.go({ type: 'clue', player: 'p1', mystery: 0, text: 'nonsense answer', clue: 1, ms: 500 });
  g.go({ type: 'clue', player: 'p1', mystery: 0, text: v.qs[0].answer.label, clue: 2, ms: 9000 });
  g.go({ type: 'clue', player: 'p2', mystery: 0, text: v.qs[0].answer.label, clue: 3, ms: 17000 });
  g.go({ type: 'timeout' });
  assert.deepEqual(g.m.lastVersus!.ranking, ['p1', 'p2']); // 30 - 5 = 25 beats 20
});

/** A match in the Gap's move step, everyone's reserve set. */
function inMoves(n: number, reserve = 20000) {
  const g = toVersus(n, 'rush');
  g.go({ type: 'timeout' });
  for (const id of g.m.order) g.m.players[id].reserve = reserve;
  g.go({ type: 'timeout' }); // cards step over
  assert.equal(g.m.phase, 'gap_moves');
  return g;
}

const capitalOf = (m: Match, id: string) => landsOf(m, id).find((l) => l.capital)!.id;
const outpostOf = (m: Match, id: string) => landsOf(m, id).find((l) => !l.capital)!.id;

test('battle: defender wins ties; a single attacker captures with the surplus', () => {
  const g = inMoves(3);
  const o2 = outpostOf(g.m, 'p2');
  const o3 = outpostOf(g.m, 'p3');
  g.go({ type: 'moves', player: 'p1', moves: [{ from: null, to: o2, troops: 10000 }, { from: capitalOf(g.m, 'p1'), to: o3, troops: 15000 }] });
  g.go({ type: 'moves', player: 'p2', moves: [] });
  g.go({ type: 'moves', player: 'p3', moves: [] });
  assert.equal(g.m.lands[o2].owner, 'p2');
  assert.equal(g.m.lands[o2].troops, 0);
  assert.equal(g.m.lands[o3].owner, 'p1');
  assert.equal(g.m.lands[o3].troops, 5000);
  assert.equal(g.m.stage, 2);
});

test('a fallen capital eliminates its owner and their lands go neutral', () => {
  const g = inMoves(3, 40000);
  const cap = capitalOf(g.m, 'p3');
  g.go({ type: 'moves', player: 'p1', moves: [{ from: null, to: cap, troops: 40000 }] });
  g.go({ type: 'moves', player: 'p2', moves: [] });
  g.go({ type: 'moves', player: 'p3', moves: [] });
  assert.ok(g.m.players.p3.out);
  assert.equal(g.m.lands[cap].owner, 'p1');
  assert.equal(landsOf(g.m, 'p3').length, 0);
  assert.equal(g.m.landOrder.filter((l) => g.m.lands[l].owner === null).length, 2);
});

test('several attackers overwhelm a land: the top 2 play a Breaking Duel on bank true/false questions', () => {
  const g = inMoves(3);
  const o3 = outpostOf(g.m, 'p3');
  g.go({ type: 'moves', player: 'p1', moves: [{ from: null, to: o3, troops: 20000 }] });
  g.go({ type: 'moves', player: 'p2', moves: [{ from: null, to: o3, troops: 10000 }] });
  g.go({ type: 'moves', player: 'p3', moves: [] });
  assert.equal(g.m.phase, 'duel');
  const d = g.m.duels[0];
  assert.deepEqual([d.p1, d.p2, d.t1, d.t2], ['p1', 'p2', 20000 - 6667, 10000 - 3333]);
  assert.ok(d.questions.every((q) => q.style === 'tf' && bank.byStyle.tf.some((x) => x.id === q.id)));
  // p2 answers all right, p1 answers all wrong: p2 wins even with fewer troops.
  for (const q of d.questions) {
    g.go({ type: 'duel', player: 'p1', answer: !q.answer, ms: 1000 });
    g.go({ type: 'duel', player: 'p2', answer: q.answer, ms: 3000 });
  }
  assert.equal(g.m.lands[o3].owner, 'p2');
  assert.equal(g.m.lands[o3].troops, 6667);
  assert.equal(g.m.players.p1.reserve, 13333 - 6667);
});

test('cards: shield bounces attacks, trap halves the biggest force, Double attack and Ambush change move counts', () => {
  const g = toVersus(3, 'rush');
  g.go({ type: 'timeout' });
  for (const id of g.m.order) g.m.players[id].reserve = 20000;
  const o2 = outpostOf(g.m, 'p2');
  const o3 = outpostOf(g.m, 'p3');
  g.m.players.p2.cards = ['shield'];
  g.m.players.p3.cards = ['trap', 'ambush'];
  g.m.players.p1.cards = ['double_attack', 'spy'];
  assert.ok(!g.go({ type: 'card', player: 'p2', card: 'shield', land: o3 }), 'only own land');
  assert.ok(g.go({ type: 'card', player: 'p2', card: 'shield', land: o2 }));
  assert.ok(g.go({ type: 'card', player: 'p3', card: 'trap', land: o3 }));
  assert.ok(g.go({ type: 'card', player: 'p3', card: 'ambush', target: 'p1' }));
  assert.ok(g.go({ type: 'card', player: 'p1', card: 'double_attack' }));
  assert.ok(g.go({ type: 'card', player: 'p1', card: 'spy' }));
  assert.deepEqual(Object.keys(spyView(g.m, 'p1')!.reserves), ['p1', 'p2', 'p3']);
  assert.equal(spyView(g.m, 'p2'), null);
  g.go({ type: 'timeout' });
  assert.equal(maxMoves(g.m, 'p1'), 2);
  g.go({ type: 'moves', player: 'p1', moves: [{ from: null, to: o2, troops: 12000 }, { from: null, to: o3, troops: 8000 }] });
  g.go({ type: 'moves', player: 'p2', moves: [] });
  g.go({ type: 'moves', player: 'p3', moves: [] });
  assert.equal(g.m.lands[o2].owner, 'p2');
  assert.equal(g.m.players.p1.reserve, 12000);
  assert.equal(g.m.lands[o3].owner, 'p3');
  assert.equal(g.m.lands[o3].troops, 6000);
});

test('alliances: one ally, none with 2 players left, no attacking an ally, Betrayal takes a land', () => {
  const g = toVersus(3, 'rush');
  g.go({ type: 'timeout' });
  assert.ok(g.go({ type: 'propose', from: 'p1', to: 'p2' }));
  assert.ok(g.go({ type: 'respond', from: 'p1', to: 'p2', accept: true }));
  assert.ok(!g.go({ type: 'propose', from: 'p3', to: 'p1' }), 'p1 already has an ally');
  const o2 = outpostOf(g.m, 'p2');
  g.m.players.p1.cards = ['betrayal'];
  assert.ok(g.go({ type: 'card', player: 'p1', card: 'betrayal', land: o2 }));
  assert.equal(g.m.lands[o2].owner, 'p1');
  assert.equal(g.m.players.p1.ally, null);
  const h = game(2);
  playSolo(h);
  h.go({ type: 'timeout' });
  assert.ok(!h.go({ type: 'propose', from: 'p1', to: 'p2' }));
  const k = toVersus(3, 'rush', 50);
  k.go({ type: 'timeout' });
  k.go({ type: 'propose', from: 'p1', to: 'p2' });
  k.go({ type: 'respond', from: 'p1', to: 'p2', accept: true });
  k.m.players.p1.reserve = 5000;
  k.go({ type: 'timeout' });
  assert.ok(!k.go({ type: 'moves', player: 'p1', moves: [{ from: null, to: outpostOf(k.m, 'p2'), troops: 5000 }] }));
});

test('disconnect: the bot puts reserves on the weakest land; away 2 full stages = removed', () => {
  const g = inMoves(3, 7500);
  g.go({ type: 'connection', player: 'p3', connected: false });
  assert.deepEqual(botMoves(g.m, 'p3'), [{ from: null, to: outpostOf(g.m, 'p3'), troops: 7000 }]);
  g.go({ type: 'moves', player: 'p1', moves: [] });
  g.go({ type: 'moves', player: 'p2', moves: [] });
  assert.equal(g.m.stage, 2);
  assert.equal(g.m.lands[outpostOf(g.m, 'p3')].troops, 17000);
  // Stages 2 and 3 fully away.
  for (const stage of [2, 3]) {
    while (g.m.stage === stage) g.go({ type: 'timeout' });
  }
  assert.ok(g.m.players.p3.out);
  assert.equal(g.m.players.p3.outReason, 'away');
  assert.equal(landsOf(g.m, 'p3').length, 0);
});

test('win: last empire standing, or after stage 6 most lands then troops', () => {
  const g = inMoves(2, 40000);
  g.go({ type: 'moves', player: 'p1', moves: [{ from: null, to: capitalOf(g.m, 'p2'), troops: 40000 }] });
  g.go({ type: 'moves', player: 'p2', moves: [] });
  assert.equal(g.m.phase, 'over');
  assert.equal(g.m.winner, 'p1');
  const h = game(3, 4);
  let guard = 0;
  while (h.m.phase !== 'over' && guard++ < 500) h.go({ type: 'timeout' });
  assert.equal(h.m.stage, BALANCE.MAX_STAGES);
  assert.equal(h.m.winner, standings(h.m)[0].id);
});

test('versus payout (CQ22): nobody right means no payout, whatever the seat', () => {
  const g = toVersus(2, 'rush');
  const base = Object.fromEntries(g.m.order.map((id) => [id, g.m.players[id].reserve]));
  g.go({ type: 'timeout' });
  assert.equal(g.m.phase, 'gap_cards');
  assert.deepEqual(g.m.lastVersus!.points, {});
  for (const id of g.m.order) assert.equal(g.m.players[id].reserve, base[id]);
});

test('versus payout (CQ22): only players with a right answer are paid; 2nd with nothing gets nothing', () => {
  const g = toVersus(2, 'rush');
  const v = g.m.versus!;
  const answers = v.style === 'rush' ? v.q.answers : [];
  g.go({ type: 'rush', player: 'p2', text: answers[0].label, ms: 1000 });
  g.go({ type: 'timeout' });
  assert.deepEqual(g.m.lastVersus!.points, { p2: 5 });
});
