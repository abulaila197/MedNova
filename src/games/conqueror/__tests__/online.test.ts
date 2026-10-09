/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { makeBank, type BankQ, type McqQ, type Rng } from '../bank';
import { active, BALANCE, type Match } from '../core';
import { makeMap } from '../map';
import { dueOf, HOLD_MS, startOnline, stepOnline, type OnlineConqueror, type PhoneAction } from '../online';
import { envelopeFor, SECRET, viewFor } from '../view';

const bank = makeBank(JSON.parse(readFileSync('src/games/conqueror/data/bank.json', 'utf8')) as BankQ[]);

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
const people = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` }));

/** What a busy player sends in each phase: right solo answers, a guess, and an attack on a rival. */
function actionFor(m: Match, id: string): PhoneAction | null {
  const p = m.players[id];
  if (p.out) return null;
  switch (m.phase) {
    case 'solo_pick': {
      if (m.solo[id]) return null;
      const t = m.board.find((x) => !x.by);
      return t ? { type: 'pick', tile: t.n } : null;
    }
    case 'solo_play': {
      const t = m.solo[id];
      if (!t || t.card || t.result) return null;
      const q = t.questions;
      const answers =
        t.style === 'mcq' ? q.map((x) => (x as McqQ).answer) : t.style === 'tf' ? q.map((x) => x.style === 'tf' && x.answer)
          : t.style === 'order' && q[0].style === 'order' ? q[0].items : q[0].style === 'match' ? q[0].pairs.map((x) => x[1]) : [];
      return { type: 'solo', answers };
    }
    case 'versus': {
      const v = m.versus!;
      if (v.style === 'closest') {
        const at = v.items.findIndex((_, i) => !v.guesses[id]?.[i]);
        return at < 0 ? null : { type: 'closest', item: at, value: v.items[at].answer };
      }
      if (v.style === 'standing') return v.hearts[id] > 0 && !v.answers[id] ? { type: 'standing', picks: v.qs[v.index].answers } : null;
      if (v.style === 'clue') {
        const at = v.qs.findIndex((_, i) => (v.solved[id] ?? [])[i] == null);
        return at < 0 ? null : { type: 'clue', mystery: at, text: v.qs[at].answer.label };
      }
      const left = v.q.answers.find((a) => !(v.found[id] ?? []).some((f) => f.label === a.label));
      return left && (v.found[id] ?? []).length < 3 ? { type: 'rush', text: left.label } : null;
    }
    case 'gap_cards':
      return m.gap.ready.includes(id) ? null : { type: 'ready' };
    case 'gap_moves': {
      if (m.gap.moves[id]) return null;
      const rival = m.landOrder.find((l) => m.lands[l].owner && m.lands[l].owner !== id && m.lands[l].owner !== p.ally);
      const mine = m.landOrder.filter((l) => m.lands[l].owner === id).sort((a, b) => m.lands[b].troops - m.lands[a].troops)[0];
      const moves = rival && mine && m.lands[mine].troops > 2000 ? [{ from: mine, to: rival, troops: Math.floor(m.lands[mine].troops / 2000) * 1000 }] : [];
      return { type: 'moves', moves };
    }
    case 'duel': {
      const d = m.duels[m.duelIndex];
      const mineA = d.p1 === id ? d.a1 : d.p2 === id ? d.a2 : null;
      return mineA && mineA.length < d.questions.length ? { type: 'duel', answer: d.questions[mineA.length].answer, ms: 1000 } : null;
    }
    default:
      return null;
  }
}

function playOut(n: number, seed: number, busy: (id: string) => boolean, away: string[] = [], peaceful = false) {
  const rng = seeded(seed);
  let now = 1_000_000;
  let o: OnlineConqueror = startOnline(people(n), 'mixed', rng, now);
  const phases = new Set<string>();
  for (let i = 0; i < 20_000 && o.m.phase !== 'over'; i++) {
    phases.add(o.m.phase);
    const before = o;
    if (o.started <= now)
      for (const id of o.m.order) {
        if (!busy(id)) continue;
        const a0 = actionFor(o.m, id);
        const a = peaceful && a0?.type === 'moves' ? { type: 'moves', moves: [] } : a0;
        if (a) {
          now += 200;
          o = stepOnline(o, a, id, away, bank, rng, now);
        }
      }
    if (o === before) {
      const due = dueOf(o);
      now = Math.max(now + 100, due ?? now + 100, o.started);
      o = stepOnline(o, null, null, away, bank, rng, now);
    }
  }
  return { o, phases, now };
}

test('online: a whole match plays to the end with every phone playing', () => {
  for (const seed of [1, 2, 3]) {
    const { o, phases } = playOut(4, seed, () => true);
    assert.equal(o.m.phase, 'over', `seed ${seed}`);
    assert.ok(o.m.winner);
    for (const ph of ['solo_pick', 'solo_play', 'versus', 'gap_cards', 'gap_moves']) assert.ok(phases.has(ph), ph);
  }
});

test('online: idle phones never stall the war, every phase has a clock', () => {
  const { o } = playOut(3, 9, () => false);
  assert.equal(o.m.phase, 'over');
  assert.equal(o.m.stage, BALANCE.MAX_STAGES);
});

test('online: nobody can act during the screens between phases', () => {
  const now = 5_000;
  const o = startOnline(people(2), 'mixed', seeded(4), now);
  assert.equal(o.holds[0].kind, 'start');
  const tile = o.m.board[0].n;
  assert.equal(stepOnline(o, { type: 'pick', tile }, 'p1', [], bank, seeded(1), now + 100).m.solo.p1, undefined);
  const later = stepOnline(o, { type: 'pick', tile }, 'p1', [], bank, seeded(1), now + HOLD_MS.start + 100);
  assert.equal(later.m.solo.p1?.tile, tile);
});

test('view: rivals\' secrets and right answers stay on the server', () => {
  const rng = seeded(6);
  let o = startOnline(people(3), 'mixed', rng, 0);
  let now = HOLD_MS.start + 10;
  for (const id of o.m.order) o = stepOnline(o, actionFor(o.m, id)!, id, [], bank, rng, (now += 10));
  assert.equal(o.m.phase, 'solo_play');
  const v = viewFor(o.m, 'p1');
  for (const t of v.board) if (!t.by) assert.ok(!t.card && !t.style);
  const mine = v.solo.p1;
  if (!mine.card) for (const q of mine.questions) assert.ok(q.style !== 'mcq' || q.answer === SECRET);
  assert.deepEqual(v.solo.p2.questions, []);
  assert.equal(v.players.p2.reserve, SECRET);
  const env = envelopeFor(o, 'p2');
  assert.equal(env.m.me, 'p2');
});

test('online: a player who is away is played by the bot, and removed after 2 stages away (CQ12)', () => {
  const { o } = playOut(3, 12, (id) => id !== 'p3', ['p3'], true);
  assert.equal(o.m.phase, 'over');
  assert.ok(o.m.players.p3.out);
  assert.equal(o.m.players.p3.outReason, 'away');
  assert.equal(active(o.m).some((p) => p.id === 'p3'), false);
});

test('map: every player count gets 3 lands each, ids in the engine\'s order, each with a spot on its land', () => {
  for (let n = 2; n <= 6; n++)
    for (const seed of [1, 77, 4242]) {
      const map = makeMap(seed, n);
      assert.equal(map.lands.length, 3 * n);
      map.lands.forEach((l, i) => {
        assert.equal(l.id, `land_${i + 1}`);
        assert.equal(l.seat, Math.floor(i / 3));
        assert.equal(l.capital, i % 3 === 0);
        assert.ok(l.d.length > 10);
      });
    }
});
