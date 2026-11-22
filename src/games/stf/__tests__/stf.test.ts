/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { YOU } from '../../../bots/race/engine';
import type { Bot, BotType } from '../../../bots/types';
import { mindFor } from '../../../bots/brain';
import { rng } from '../../../bots/rng';
import { STF, caseExp, casePoints, doubleWrong, gameScore, lock, rankRows, shownOf, startCase, takeFifty, takeHighlight, timeUp, type Case } from '../core';
import { currentSeat, offlineStandings, scoreOf, startOffline, stepOffline } from '../offline';
import { StfRace, planCase, runAt } from '../rivals';
import CASES_JSON from '../data/cases.json';

const CASES = CASES_JSON as Case[];
const FIELDS = ['cardiology', 'dermatology', 'ent', 'emergency', 'endocrine', 'gastro', 'genetics', 'heme', 'infectious', 'nephro', 'neuro', 'obgyn', 'ophtho', 'ortho', 'peds', 'psych', 'pulm', 'rheum', 'surgery', 'ethics', 'safety', 'flow', 'anatomy', 'physiology', 'biochemistry', 'pathology', 'pharmacology', 'microbiology', 'histology', 'embryology'];

test('the bank: every case has a story, 4 choices with fixes and reasons, and a highlight inside the story', () => {
  assert.ok(CASES.length >= 1);
  const ids = new Set<string>();
  for (const c of CASES) {
    assert.ok(!ids.has(c.id), `${c.id} twice`);
    ids.add(c.id);
    assert.ok(FIELDS.includes(c.f), `${c.id} field ${c.f}`);
    assert.ok([1, 2, 3].includes(c.lv));
    assert.equal(c.a.length, 4, c.id);
    assert.ok(c.s.includes(c.h), `${c.id} highlight not in story`);
    for (const k of ['o', 'x', 'w'] as const) assert.equal(new Set(c.a.map((a) => a[k])).size, 4, `${c.id} repeats ${k}`);
  }
});

// Yazan 2026-11-17: the right choice's length must not give it away. In each field and stage it is the longest in at
// most 30% of cases and the shortest in at most 35%, and it is never 10% or more longer than every other choice.
test('the bank: the right choice is not given away by its length', () => {
  const tally = new Map<string, { n: number; long: number; short: number }>();
  for (const c of CASES) {
    for (const k of ['o', 'x'] as const) {
      const [right, ...rest] = c.a.map((a) => a[k].length);
      const t = tally.get(`${c.f} ${k}`) ?? { n: 0, long: 0, short: 0 };
      t.n += 1;
      if (right >= Math.max(...rest)) t.long += 1;
      if (right < Math.min(...rest)) t.short += 1;
      tally.set(`${c.f} ${k}`, t);
      assert.ok(right < 1.1 * Math.max(...rest), `${c.id} ${k}: right choice stands out by length`);
    }
  }
  for (const [key, t] of tally) {
    assert.ok(t.long <= 0.3 * t.n, `${key}: right choice longest in ${t.long} of ${t.n}`);
    assert.ok(t.short <= 0.35 * t.n, `${key}: right choice shortest in ${t.short} of ${t.n}`);
  }
});

const hard = CASES[0].id;
const run0 = () => startCase(rng('c'));

test('two stages: stage 2 always comes, one try each, then the case is done', () => {
  let r = run0();
  assert.equal(r.stage, 1);
  r = lock(r, 2);
  assert.equal(r.stage, 2);
  assert.equal(r.pick1, 2);
  r = lock(r, 0);
  assert.equal(r.stage, 'done');
  assert.equal(lock(r, 1), r);
  assert.equal(lock(run0(), 7).stage, 1);
});

test('points: +3 a right stage, -3 both wrong, hard both right +2; EXP drops the bonus; a game never ends below 0', () => {
  const both = lock(lock(run0(), 0), 0);
  const first = lock(lock(run0(), 0), 1);
  const second = lock(lock(run0(), 3), 0);
  const none = lock(lock(run0(), 1), 2);
  assert.equal(casePoints(2, both), 6);
  assert.equal(casePoints(3, both), STF.maxPoints);
  assert.equal(casePoints(3, first), 3);
  assert.equal(casePoints(1, second), 3);
  assert.equal(casePoints(3, none), -3);
  assert.ok(doubleWrong(none) && !doubleWrong(first));
  assert.equal(caseExp(8), 6);
  assert.equal(caseExp(-3), 0);
  assert.equal(gameScore([-3, -3, 3]), 0);
  assert.equal(gameScore([8, -3]), 5);
});

test('time up: what is not locked is wrong', () => {
  const r = timeUp(lock(run0(), 0));
  assert.equal(r.stage, 'done');
  assert.equal(r.pick2, -1);
  assert.ok(r.timeUp);
  assert.equal(casePoints(1, r), 3);
  assert.equal(casePoints(1, timeUp(run0())), -3);
});

test('help: 50/50 takes 2 wrong choices from the open stage once; highlight once', () => {
  let r = takeFifty(run0(), rng('f'));
  assert.equal(shownOf(r, 1).length, 2);
  assert.ok(shownOf(r, 1).includes(0));
  assert.equal(shownOf(r, 2).length, 4);
  assert.equal(takeFifty(r, rng('g')), r);
  const hidden = r.fifty!.hide[0];
  assert.equal(lock(r, hidden), r);
  r = takeHighlight(r);
  assert.ok(r.highlight);
  assert.equal(takeHighlight(r), r);
});

test('ranks: points, then fewer double-wrongs, then faster; equal shares the place', () => {
  const r = rankRows([
    { id: 'a', points: 6, doubles: 1, ms: 9 },
    { id: 'b', points: 6, doubles: 0, ms: 20 },
    { id: 'c', points: 9, doubles: 2, ms: 50 },
    { id: 'd', points: 6, doubles: 1, ms: 9 },
  ]);
  assert.deepEqual(Object.fromEntries(r.map((x) => [x.id, x.rank])), { c: 1, b: 2, a: 3, d: 3 });
});

test('pass the phone: everyone answers in secret, then all reveal; scores never go below 0', () => {
  let s = startOffline([hard, hard], [0, 1, 2], rng('off'));
  const order: number[] = [];
  for (let k = 0; k < 3; k++) {
    order.push(currentSeat(s));
    assert.equal(s.phase, 'handoff');
    s = stepOffline(s, { type: 'READY' });
    const right = order[k] === 0;
    s = stepOffline(s, { type: 'LOCK', pick: right ? 0 : 1 });
    if (k < 2) assert.equal(s.phase, 'playing');
    s = stepOffline(s, { type: 'LOCK', pick: right ? 0 : 2 });
  }
  assert.deepEqual([...order].sort(), [0, 1, 2]);
  assert.equal(s.phase, 'reveal');
  const lv = CASES[0].lv;
  assert.equal(scoreOf(s, 0), lv === 3 ? 8 : 6);
  assert.equal(scoreOf(s, 1), 0);
  assert.equal(s.players[1].doubles, 1);
  s = stepOffline(s, { type: 'NEXT' });
  assert.equal(s.index, 1);
  assert.equal(s.phase, 'handoff');
  s = stepOffline(s, { type: 'FINISH' });
  assert.equal(s.phase, 'done');
  assert.equal(offlineStandings(s, { 0: 'A', 1: 'B', 2: 'C' }).length, 3);
});

const rival = (type: BotType, name: string): Bot => ({ id: `bot:${type}:${name}`, type, name, character: 'yara', level: 1, persona: 'cheer' });

test('rivals: plans are seeded and stage 2 comes after stage 1', () => {
  for (const type of ['freshman', 'scholar', 'genius'] as BotType[]) {
    const m = mindFor(rival(type, 'x'), 5);
    const a = planCase(m, hard, 'seed').plan;
    assert.deepEqual(planCase(m, hard, 'seed').plan, a);
    assert.ok(a.at2 > a.at1);
    assert.equal(runAt(a, a.at1).stage, 2);
    assert.equal(runAt(a, a.at2).stage, 'done');
  }
});

test('race: you lock both stages, the rivals finish, the reveal waits for Next', () => {
  const rivals = [rival('genius', 'Gia'), rival('freshman', 'Fen')];
  const race = new StfRace({ playId: 'p1', items: [1, 2], you: { name: 'You', character: 'yara', team: null }, rivals, settings: {}, playerLevel: 5, cases: [hard, hard], limitMs: 0 });
  assert.equal(race.state(0).phase, 'countdown');
  const t0 = 3_000;
  assert.equal(race.state(t0).phase, 'case');
  assert.ok(race.lock(t0 + 1000, 0));
  assert.equal(race.state(t0 + 1000).players.find((p) => p.user_id === YOU)?.greens, 1);
  assert.ok(race.lock(t0 + 2000, 0));
  // Rivals still going finish within 6 s (Genius 1-2 s, Freshman 5-6 s), then the reveal.
  assert.equal(race.state(t0 + 2000).phase, 'case');
  const st = race.state(t0 + 8000);
  assert.equal(st.phase, 'reveal');
  assert.equal(st.me?.points, casePoints(CASES[0].lv, race.runOfCase(0)!));
  // The reveal card shows your closed run on the case just played.
  assert.equal(race.caseNow(), hard);
  assert.equal(race.mine()?.stage, 'done');
  assert.deepEqual(race.mine(), race.runOfCase(0));
  assert.equal(race.state(t0 + 30_000).phase, 'reveal');
  assert.ok(race.next(t0 + 30_000));
  assert.equal(race.state(t0 + 30_000).phase, 'case');
  assert.equal(race.state(t0 + 30_000).index, 1);
});

test('race with a clock: time up closes the case, unlocked stages are wrong', () => {
  const race = new StfRace({ playId: 'p2', items: [1], you: { name: 'You', character: 'yara', team: null }, rivals: [rival('freshman', 'Fen')], settings: {}, playerLevel: 1, cases: [hard], limitMs: 1_000 });
  race.state(3_000);
  const st = race.state(4_000);
  assert.equal(st.phase, 'reveal');
  assert.equal(st.me?.points, STF.bothWrong);
  assert.equal(st.players.find((p) => p.user_id === YOU)?.score, 0);
  race.next(5_000);
  assert.equal(race.state(5_000).phase, 'done');
});

test('knowledge row: Clinical, Basic sciences and Mixed pick their own cases and fields (2026-11-22)', async () => {
  const { poolOf, fieldMenu, FIELDS } = await import('../data');
  const groupOf = (f: string) => FIELDS.find((x) => x.key === f)!.group;
  const clin = poolOf(null, 'clinical');
  const basic = poolOf(null, 'basic');
  assert.ok(clin.length > 0 && basic.length > 0);
  assert.ok(clin.every((c) => groupOf(c.f) !== 'Basic science'));
  assert.ok(basic.every((c) => groupOf(c.f) === 'Basic science'));
  assert.equal(poolOf(null, 'mixed').length, clin.length + basic.length);
  // Ticks from the other knowledge are dropped, so the pool never goes empty after switching.
  assert.equal(poolOf(['anatomy'], 'clinical').length, clin.length);
  assert.ok(poolOf(['anatomy'], 'basic').every((c) => c.f === 'anatomy'));
  assert.deepEqual(fieldMenu('basic').groups.map((g) => g.title), ['Basic science']);
});
