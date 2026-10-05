/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { invFile, scoreDd, scoreRun, snapshot, stageOf, startRun, status, stepRun, timeBonus, type CaseDef, type Run, type RunEvent } from '../core';
import { finishedLines, rankOffline, ready, startOffline, stepOffline } from '../offline';

const CASE: CaseDef = {
  id: 'MP-1', title: 'Test', personal: 'p', incident: 'i', background: 'b',
  exam: [{ title: 'General', body: 'e1' }, { title: 'Abdominal', body: 'e2' }],
  investigations: [{ title: 'Laboratory', body: '', reports: [] }, { title: 'Imaging', body: '', reports: [] }],
  treatment: 't', discharge: 'd', dd1: ['a', 'b', 'c', 'd', 'x'], dd2: [['b']], final: 'x',
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

test('scoring (CF7): filtered list vs DD2 only, provisional 20, time bonus over 5 min when solved', () => {
  assert.deepEqual(scoreDd([['b']], ['b', 'x', 'q']), { right: 1, wrong: 2, points: 6 });
  assert.equal(scoreDd([['b']], ['q', 'r', 's', 't', 'u']).points, 0);
  // Either name fills a slot; the second name for the same slot neither scores nor costs.
  assert.deepEqual(scoreDd([['b', 'c'], ['d']], ['c', 'b', 'd']), { right: 2, wrong: 0, points: 20 });
  assert.equal(timeBonus(150_000), 5);
  let r = toProvisional(startRun('MP-1', 0));
  r = run(r, { type: 'SUBMIT_PROVISIONAL', id: 'x', now: 60_000 });
  assert.equal(r.finalMs, 60_000);
  const s = scoreRun(CASE, r);
  // The final ('x') in the filtered list neither scores nor costs: 'b' +10, 'q' -2.
  assert.deepEqual([s.dd, s.provisional, s.redemption, s.time, s.total, s.stamp], [8, 20, 0, 8, 36, 'SOLVED']);
  assert.equal(scoreRun({ ...CASE, parent: 'q' }, r).dd, 10);
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
