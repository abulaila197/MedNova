/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Bot, BotType } from '../../../bots/types';
import { mindFor } from '../../../bots/brain';
import { rng } from '../../../bots/rng';
import { TTT, casePoints, gameScore, isRight, lock, rankRows, shownOf, startCase, takeFifty, timeUp, type Case } from '../core';
import { currentSeat, offlineStandings, scoreOf, startOffline, stepOffline } from '../offline';
import { TttRace, planCase, runAt } from '../rivals';
import CASES_JSON from '../data/cases.json';

const CASES = CASES_JSON as Case[];
const FIELDS = ['cardiology', 'dermatology', 'ent', 'emergency', 'endocrine', 'gastro', 'genetics', 'heme', 'infectious', 'nephro', 'neuro', 'obgyn', 'ophtho', 'ortho', 'peds', 'psych', 'pulm', 'rheum', 'surgery', 'firstaid'];
const KINDS = ['worked', 'side', 'overdose', 'antidote', 'stopped', 'interaction', 'nogo', 'procedure', 'later', 'pregnancy', 'prevented', 'failed', 'next', 'scene'];

test('the bank: every case has a story, a question, 4 different choices with reasons, a clue and a Learn card', () => {
  assert.ok(CASES.length >= 20);
  const ids = new Set<string>();
  for (const c of CASES) {
    assert.ok(!ids.has(c.id), `${c.id} twice`);
    ids.add(c.id);
    assert.ok(FIELDS.includes(c.f), `${c.id} field ${c.f}`);
    assert.ok(KINDS.includes(c.k), `${c.id} kind ${c.k}`);
    assert.ok([1, 2, 3].includes(c.lv));
    assert.equal(c.a.length, 4, c.id);
    assert.equal(new Set(c.a.map((a) => a.o.toLowerCase())).size, 4, `${c.id} repeats a choice`);
    for (const k of ['q', 's', 't', 'c', 'p', 'lq', 'la'] as const) assert.ok(c[k], `${c.id} misses ${k}`);
    assert.ok(c.a.every((a) => a.o && a.w), c.id);
    assert.ok(![c.s, c.c, c.q, c.lq, c.la, ...c.a.flatMap((a) => [a.o, a.w])].some((x) => /[[\]]|https?:/.test(x)), `${c.id} has brackets or a link`);
  }
  for (const f of FIELDS) assert.ok(CASES.some((c) => c.f === f), `no case in ${f}`);
});

const one = CASES[0];
const run0 = () => startCase(rng('c'));

test('one try a case: the first lock closes it', () => {
  let r = run0();
  assert.equal(r.done, false);
  assert.deepEqual([...r.order].sort(), [0, 1, 2, 3]);
  r = lock(r, 2);
  assert.ok(r.done);
  assert.equal(r.pick, 2);
  assert.equal(lock(r, 0), r);
  assert.equal(lock(run0(), 7).done, false);
});

test('points: easy 2, medium 3, hard 4 when right; wrong scores 0', () => {
  const right = lock(run0(), 0);
  const wrong = lock(run0(), 1);
  assert.ok(isRight(right) && !isRight(wrong));
  assert.equal(casePoints(1, right), 2);
  assert.equal(casePoints(2, right), 3);
  assert.equal(casePoints(3, right), 4);
  assert.equal(casePoints(3, wrong), 0);
  assert.equal(gameScore([2, 0, 4]), 6);
});

test('time up: no answer counts as wrong', () => {
  const r = timeUp(run0());
  assert.ok(r.done && r.timeUp);
  assert.equal(r.pick, -1);
  assert.equal(casePoints(3, r), 0);
  const locked = lock(run0(), 0);
  assert.equal(timeUp(locked), locked);
});

test('50/50: takes 2 wrong choices once; a taken choice cannot be locked', () => {
  const r = takeFifty(run0(), rng('f'));
  assert.equal(shownOf(r).length, 2);
  assert.ok(shownOf(r).includes(0));
  assert.equal(takeFifty(r, rng('g')), r);
  assert.equal(lock(r, r.fifty![0]), r);
  assert.equal(TTT.fiftyCost, 2);
});

test('ranks: points, then faster; equal shares the place', () => {
  const r = rankRows([
    { id: 'a', points: 6, ms: 9 },
    { id: 'b', points: 6, ms: 20 },
    { id: 'c', points: 9, ms: 50 },
    { id: 'd', points: 6, ms: 9 },
  ]);
  assert.deepEqual(Object.fromEntries(r.map((x) => [x.id, x.rank])), { c: 1, a: 2, d: 2, b: 4 });
});

test('pass the phone: everyone answers in secret, then all reveal', () => {
  let s = startOffline([one.id, one.id], [0, 1, 2], rng('off'));
  const order: number[] = [];
  for (let k = 0; k < 3; k++) {
    order.push(currentSeat(s));
    assert.equal(s.phase, 'handoff');
    s = stepOffline(s, { type: 'READY' });
    assert.equal(s.phase, 'playing');
    s = stepOffline(s, { type: 'LOCK', pick: order[k] === 0 ? 0 : 1 });
  }
  assert.deepEqual([...order].sort(), [0, 1, 2]);
  assert.equal(s.phase, 'reveal');
  assert.equal(scoreOf(s, 0), TTT.points[one.lv]);
  assert.equal(scoreOf(s, 1), 0);
  s = stepOffline(s, { type: 'NEXT' });
  assert.equal(s.index, 1);
  assert.equal(s.phase, 'handoff');
  s = stepOffline(s, { type: 'FINISH' });
  assert.equal(s.phase, 'done');
  assert.equal(offlineStandings(s, { 0: 'A', 1: 'B', 2: 'C' }).length, 3);
});

const rival = (type: BotType, name: string): Bot => ({ id: `bot:${type}:${name}`, type, name, character: 'yara', level: 1, persona: 'cheer' });

test('rivals: plans are seeded and lock once', () => {
  for (const type of ['freshman', 'scholar', 'genius'] as BotType[]) {
    const m = mindFor(rival(type, 'x'), 5);
    const a = planCase(m, one.id, 'seed').plan;
    assert.deepEqual(planCase(m, one.id, 'seed').plan, a);
    assert.equal(runAt(a, a.at - 1).done, false);
    assert.ok(runAt(a, a.at).done);
  }
});

test('race: you lock, the rivals hurry to finish, the reveal waits for Next', () => {
  const rivals = [rival('genius', 'Gia'), rival('freshman', 'Fen')];
  const race = new TttRace({ playId: 'p1', items: [1, 2], you: { name: 'You', character: 'yara', team: null }, rivals, settings: {}, playerLevel: 5, cases: [one.id, one.id], limitMs: 0 });
  assert.equal(race.state(0).phase, 'countdown');
  const t0 = 3_000;
  assert.equal(race.state(t0).phase, 'case');
  assert.ok(race.lock(t0 + 1000, 0));
  assert.equal(race.lock(t0 + 1100, 1), false);
  // Rivals still going finish within 6 s (Genius 1-2 s, Freshman 5-6 s), then the reveal.
  assert.equal(race.state(t0 + 1000).phase, 'case');
  const st = race.state(t0 + 8000);
  assert.equal(st.phase, 'reveal');
  assert.equal(st.me?.points, TTT.points[one.lv]);
  assert.ok(race.mine()?.done);
  assert.equal(race.state(t0 + 30_000).phase, 'reveal');
  assert.ok(race.next(t0 + 30_000));
  assert.equal(race.state(t0 + 30_000).phase, 'case');
  assert.equal(race.state(t0 + 30_000).index, 1);
});

test('race with a clock: time up closes the case as wrong', () => {
  const race = new TttRace({ playId: 'p2', items: [1], you: { name: 'You', character: 'yara', team: null }, rivals: [rival('freshman', 'Fen')], settings: {}, playerLevel: 1, cases: [one.id], limitMs: 1_000 });
  race.state(3_000);
  const st = race.state(4_000);
  assert.equal(st.phase, 'reveal');
  assert.equal(st.me?.points, 0);
  race.next(5_000);
  assert.equal(race.state(5_000).phase, 'done');
});
