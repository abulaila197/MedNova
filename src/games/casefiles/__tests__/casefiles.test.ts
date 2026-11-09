/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { invFile, scoreDd, scoreRun, snapshot, stageOf, startRun, status, stepRun, timeBonus, type CaseDef, type Run, type RunEvent } from '../core';
import { finishedLines, rankOffline, ready, startOffline, stepOffline } from '../offline';

const CASE: CaseDef = {
  id: 'MP-1', title: 'Test', personal: 'p', incident: 'i', background: 'b',
  exam: [{ title: 'General', body: 'e1' }, { title: 'Abdominal', body: 'e2' }],
  investigations: [{ title: 'Laboratory', body: '', reports: [] }, { title: 'Imaging', body: '', reports: [] }],
  treatment: 't', discharge: 'd', answers: ['x', 'a', 'b', 'c', 'd'], final: 'x',
};
const run = (r: Run, ...es: RunEvent[]) => es.reduce((a, e) => stepRun(CASE, a, e), r);
const toProvisional = (r: Run) =>
  run(r,
    { type: 'OPEN', file: 'personal' }, { type: 'OPEN', file: 'incident' }, { type: 'OPEN', file: 'background' },
    { type: 'SUBMIT_DD', ids: ['a', 'b', 'x', 'b'] }, { type: 'REQUEST_EXAM' }, { type: 'VIEW_EXAM', page: 1 },
    { type: 'SUBMIT_FILTER', ids: ['b', 'x', 'q'] }, { type: 'REQUEST_INV' },
    { type: 'OPEN', file: invFile(0) }, { type: 'OPEN', file: invFile(1) });

test('gating (CF1): history before the list, exam before the filter, all tests before the provisional', () => {
  let r = startRun('MP-1', 0);
  assert.equal(status(CASE, r).canDd, false);
  r = run(r, { type: 'SUBMIT_DD', ids: ['a'] });
  assert.equal(r.dd, null);
  r = run(r, { type: 'OPEN', file: 'personal' }, { type: 'OPEN', file: 'incident' }, { type: 'OPEN', file: 'background' }, { type: 'OPEN', file: 'exam' });
  assert.equal(r.opened.includes('exam'), false);
  r = run(r, { type: 'SUBMIT_DD', ids: ['a', 'b', 'c', 'd', 'e', 'f'] });
  assert.deepEqual(r.dd, ['a', 'b', 'c', 'd', 'e']);
  assert.equal(status(CASE, r).canFilter, false);
  r = run(r, { type: 'REQUEST_EXAM' }, { type: 'VIEW_EXAM', page: 0 }, { type: 'SUBMIT_FILTER', ids: ['b'] }, { type: 'REQUEST_INV' }, { type: 'OPEN', file: invFile(0) });
  assert.equal(status(CASE, r).canProvisional, false);
  r = run(r, { type: 'OPEN', file: invFile(1) });
  assert.equal(status(CASE, r).canProvisional, true);
  assert.equal(stageOf(r), 'Investigations');
});

test('scoring (#67): both lists against the doctor\'s list, each name once; provisional 20, time bonus over 5 min when solved', () => {
  assert.deepEqual(scoreDd(['b'], ['b', 'x', 'q']), { right: 1, wrong: 2, points: 6 });
  assert.equal(scoreDd(['b'], ['q', 'r', 's', 't', 'u']).points, 0);
  // A name in both lists counts once, right or wrong.
  assert.deepEqual(scoreDd(['b', 'c'], ['b', 'q'], ['b', 'c', 'q']), { right: 2, wrong: 1, points: 18 });
  assert.deepEqual(scoreDd(['b'], null, ['b']), { right: 1, wrong: 0, points: 10 });
  assert.equal(timeBonus(150_000), 5);
  let r = toProvisional(startRun('MP-1', 0));
  r = run(r, { type: 'SUBMIT_PROVISIONAL', id: 'x', now: 60_000 });
  assert.equal(r.finalMs, 60_000);
  const s = scoreRun(CASE, r);
  // First list a, b, x and narrowed b, x, q: a, b and x right once each (+30), q wrong (-2). The final scores like any right name (#66).
  assert.deepEqual([s.dd, s.provisional, s.redemption, s.time, s.total, s.stamp], [28, 20, 0, 8, 56, 'SOLVED']);
  assert.equal(status(CASE, r).canRedemption, false);
});

test('wrong provisional: treatment, one redemption, then discharge; sealed in multiplayer (CF8)', () => {
  let r = toProvisional(startRun('MP-1', 0));
  r = run(r, { type: 'SUBMIT_PROVISIONAL', id: 'b', now: 100_000 });
  assert.equal(r.finalMs, null);
  assert.equal(status(CASE, r).unlocked.treatment, false);
  r = run(r, { type: 'RELEASE_TREATMENT' }, { type: 'OPEN', file: 'treatment' });
  r = run(r, { type: 'PAUSE', now: 110_000 }, { type: 'RESUME', now: 500_000 }, { type: 'SUBMIT_REDEMPTION', id: 'x', now: 520_000 });
  assert.equal(r.finalMs, 130_000);
  const s = scoreRun(CASE, r);
  assert.deepEqual([s.provisional, s.redemption, s.time, s.stamp], [0, 10, 6, 'SOLVED']);
  assert.equal(status(CASE, r).unlocked.discharge, true);
  assert.equal(status(CASE, r, true).unlocked.discharge, false);
  r = run(r, { type: 'CLOSE' });
  assert.equal(r.phase, 'done');
  // both wrong: closed, no time bonus
  let w = toProvisional(startRun('MP-1', 0));
  w = run(w, { type: 'SUBMIT_PROVISIONAL', id: 'b', now: 1 }, { type: 'RELEASE_TREATMENT' }, { type: 'OPEN', file: 'treatment' }, { type: 'SUBMIT_REDEMPTION', id: 'a', now: 2 });
  assert.deepEqual([scoreRun(CASE, w).stamp, scoreRun(CASE, w).time], ['CLOSED', 0]);
  assert.equal(snapshot(CASE, startRun('MP-1', 0), 5_000).elapsedMs, 5_000);
});

test('offline (CF8, CF10): same case in turn, sealed discharge, finished lines without scores, ranking', () => {
  let o = startOffline('MP-1', [0, 1]);
  o = ready(o, 0);
  const play = (x: typeof o, id: string, at: number) => {
    const es: RunEvent[] = [
      { type: 'OPEN', file: 'personal' }, { type: 'OPEN', file: 'incident' }, { type: 'OPEN', file: 'background' },
      { type: 'SUBMIT_DD', ids: ['b'] }, { type: 'REQUEST_EXAM' }, { type: 'VIEW_EXAM', page: 0 },
      { type: 'SUBMIT_FILTER', ids: ['b'] }, { type: 'REQUEST_INV' }, { type: 'OPEN', file: invFile(0) }, { type: 'OPEN', file: invFile(1) },
      { type: 'SUBMIT_PROVISIONAL', id, now: at }, { type: 'RELEASE_TREATMENT' }, { type: 'OPEN', file: 'treatment' },
    ];
    return es.reduce((a, e) => stepOffline(CASE, a, e), x);
  };
  o = play(o, 'x', 72_000);
  assert.equal(status(CASE, o.run!, true).unlocked.discharge, false);
  o = stepOffline(CASE, o, { type: 'OPEN', file: 'discharge' });
  assert.equal(o.run!.opened.includes('discharge'), false);
  o = stepOffline(CASE, o, { type: 'CLOSE' });
  assert.equal(o.phase, 'handoff');
  assert.deepEqual(finishedLines(o, (s) => ['Sara', 'Omar'][s]), ['Sara finished the case in 1:12']);
  o = ready(o, 100_000);
  o = play(o, 'x', 130_000);
  o = stepOffline(CASE, o, { type: 'CLOSE' });
  assert.equal(o.phase, 'done');
  const r = rankOffline(CASE, o);
  assert.deepEqual(r.map((x) => [x.seat, x.rank]), [[1, 1], [0, 2]]);
});

test('every doctor\'s list name is one disease from the master list, each once, the final included (#65, #67)', async () => {
  const cases = (await import('../data/cases.json')).default as CaseDef[];
  const labels = new Set(((await import('../data/diagnoses.json')).default as { label: string }[]).map((d) => d.label));
  for (const c of cases) {
    for (const x of c.answers) assert.ok(labels.has(x) && !/ or /.test(x), `${c.id}: ${x}`);
    assert.equal(new Set(c.answers).size, c.answers.length, `${c.id}: duplicate name`);
    assert.ok(c.answers.includes(c.final) && labels.has(c.final), `${c.id}: final`);
  }
});

// ---- Case showdown (vs rivals, G5) ----
import { mindFor as mindForRival } from '../../../bots/brain';
import { casePlan, parseWork, stageAt } from '../rivals';

const CASE0 = CASE;
const CASES = [CASE, { ...CASE, id: 'MP-2', answers: ['y', 'a', 'b'], final: 'y' }, { ...CASE, id: 'MP-3', answers: ['z', 'c'], final: 'z' }];
const POOL0 = ['Gastroenteritis', 'Kidney stone', 'Diverticulitis', 'Cholecystitis', 'Pancreatitis', 'Pyelonephritis'];
const rivalOf = (type: 'genius' | 'scholar' | 'freshman') => mindForRival({ id: `bot:${type}:T`, type, name: 'T', persona: 'cheer' });

test('case showdown: a rival files sensible lists, a diagnosis and points, the same way every time', () => {
  const a = { seed: 'm1:0', limitMs: 600_000, gap: 0, progress: 0, pool: POOL0 };
  const p = casePlan(rivalOf('scholar'), CASE0, a);
  const w = parseWork(p.answer)!;
  assert.ok(w.first.length >= 1 && w.first.length <= 5);
  assert.ok(w.dd.length >= 1 && w.dd.length <= 5);
  assert.ok(w.dd.every((x) => w.first.includes(x)));
  assert.ok(w.at.exam < w.at.inv && w.at.inv < w.at.prov && w.at.prov <= w.at.done);
  assert.equal(p.points, w.points);
  if (p.doneAt != null) assert.equal(p.solved, w.prov === CASE0.final || w.redeem === CASE0.final);
  assert.deepEqual(casePlan(rivalOf('scholar'), CASE0, a), p);
  assert.equal(stageAt(w, 0, false), 'History');
  assert.equal(stageAt(w, w.at.exam, false), 'Examination');
  assert.equal(stageAt(w, w.at.prov, false), 'Treatment');
  assert.equal(stageAt(w, w.at.prov, true), 'Finished');
});

test('case showdown: a Genius solves more cases and scores more than a Freshman over many seeds', () => {
  const sum = (type: 'genius' | 'freshman') => {
    let pts = 0;
    let solved = 0;
    for (let i = 0; i < 60; i++) {
      const p = casePlan(rivalOf(type), CASES[i % CASES.length], { seed: `m${i}:0`, limitMs: 600_000, gap: 0, progress: 0.5, pool: POOL0 });
      pts += p.points ?? 0;
      if (p.solved) solved++;
    }
    return { pts, solved };
  };
  const g = sum('genius');
  const f = sum('freshman');
  assert.ok(g.solved > f.solved, `genius ${g.solved} vs freshman ${f.solved}`);
  assert.ok(g.pts > f.pts);
  assert.ok(f.solved >= 5);
});

test('case showdown: a rival out of time still earns what it filed, never ends the case, and gets no time bonus', () => {
  // Find a seed where the rival runs out of time (decide says no time), then check the points.
  for (let i = 0; i < 400; i++) {
    const p = casePlan(rivalOf('freshman'), CASE0, { seed: `late${i}:0`, limitMs: 300_000, gap: 0, progress: 0, pool: POOL0 });
    if (p.doneAt != null) continue;
    const w = parseWork(p.answer)!;
    assert.equal(p.solved, false);
    assert.equal(w.redeem, null); // the last call comes at the end, after time up
    assert.ok(w.at.done > 300_000);
    assert.ok((p.points ?? 0) <= 50 + 20); // lists and maybe a diagnosis, no time bonus
    return;
  }
  assert.fail('no late rival found');
});
