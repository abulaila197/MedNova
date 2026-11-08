/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { finishClock, keyedStore, secondsOn, settleClock, startClock, turnPhase, type QClock } from '../qclock';
import { nudgeDue, SUPPER_MS, tmnShown, type TState } from '../shown';

/** The question clock as the round page ran it before: set up and moved on while drawing, at the drawn time. */
function oldClock() {
  let c: { q: number; since: number; sent: Record<number, true> } | null = null;
  return {
    draw(n: number, done: (q: number) => boolean, limit: number, startAt: number, now: number) {
      if (!c) {
        let first = 0;
        while (first < n && done(first)) first++;
        c = { q: first, since: first === 0 ? Math.min(now, startAt) : now, sent: {} };
      }
      while (c.q < n && (done(c.q) || c.sent[c.q])) {
        c.q++;
        c.since = now;
      }
      const left = c.q < n ? Math.max(0, (limit - (now - c.since)) / 1000) : 0;
      return { q: c.q, left, expired: c.q < n && left <= 0 };
    },
    finish(q: number, limit: number, now: number) {
      const ms = Math.max(0, Math.min(limit, now - c!.since));
      c!.sent[q] = true;
      c!.q = q + 1;
      c!.since = now;
      return ms;
    },
  };
}

/** A small seeded random, so a failure can be replayed. */
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

test('question clocks: same question, seconds left, run-outs and answer times as when they moved while drawing', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rand = rng(seed);
    const n = 1 + Math.floor(rand() * 6);
    const limit = 4000 + Math.floor(rand() * 4) * 3000;
    const t0 = 1_000_000;
    const startAt = t0 - Math.floor(rand() * 3000) + (rand() < 0.2 ? 5000 : 0);
    // Some questions already done on the server (a reload mid-round), and some that the server marks done later.
    const done = new Set<number>();
    for (let q = 0; q < n; q++) if (rand() < 0.15) done.add(q);
    const isDone = (q: number) => done.has(q);
    const old = oldClock();
    let c: QClock | null = null;
    const sentOld: number[] = [];
    const sentNew: number[] = [];
    for (let now = t0; now < t0 + n * limit + 4000; now += 250) {
      if (rand() < 0.03) done.add(Math.floor(rand() * n));
      // Before: the screen drew every tick. Now: the layout effect sets the clock up and moves it on.
      const a = old.draw(n, isDone, limit, startAt, now);
      c = settleClock(c ?? startClock(n, isDone, now, startAt), n, isDone, now);
      const left = secondsOn(c, n, limit, now);
      assert.deepEqual({ q: c.q, left, expired: c.q < n && left <= 0 }, a, `seed ${seed} at ${now - t0}`);
      // A run-out or a tap sends the question on.
      if (a.expired || (a.q < n && rand() < 0.08)) {
        const q = a.q;
        sentOld.push(old.finish(q, limit, now));
        const f = finishClock(c, q, limit, now);
        c = f.clock;
        sentNew.push(f.ms);
      }
    }
    assert.deepEqual(sentNew, sentOld, `seed ${seed}`);
  }
});

test('Chain of Trust: my turn and its run-out are read the same way as before', () => {
  for (const turnAt of [0, 1000, 5000]) {
    for (const lim of [4000, 10000]) {
      for (let now = 0; now < 20000; now += 125) {
        const myTurn = now >= turnAt;
        const left = myTurn ? Math.max(0, (lim - (now - turnAt)) / 1000) : 0;
        const late = myTurn && left <= 0;
        const ph = turnPhase(now, turnAt, lim);
        assert.equal(ph > 0, myTurn);
        assert.equal(ph === 2, late);
      }
    }
  }
});

test('keyed store: keeps values per key and wakes followers only on a change', () => {
  const s = keyedStore<{ step: number }>();
  let woke = 0;
  const off = s.subscribe(() => woke++);
  const v = { step: 1 };
  s.set('1', v);
  s.set('1', v);
  assert.equal(woke, 1);
  assert.equal(s.get('1'), v);
  assert.equal(s.get('2'), undefined);
  off();
  s.set('1', { step: 2 });
  assert.equal(woke, 1);
});

test('online screen: wakes on every tick while a nudge is due, and when the Last Supper closes', () => {
  const players = ['a', 'b', 'c'].map((id) => ({ id }));
  const st = (due: number | null, started: number) =>
    ({ now: 0, phase: 'case', due, state: { started, view: { players } } }) as unknown as TState;
  for (const me of ['a', 'b', 'c']) {
    for (const s of [st(10_000, 0), st(null, 0), st(50_000, 20_000)]) {
      let prev: unknown = Symbol('none');
      let prevDraw = '';
      for (let sv = 0; sv < 60_000; sv += 250) {
        const key = tmnShown(sv, s, me);
        // Before, the screen read the nudge and the Last Supper window on every tick.
        const draw = JSON.stringify([nudgeDue(s, sv, me) ? sv : null, sv < s.state!.started + SUPPER_MS]);
        if (draw !== prevDraw) assert.notEqual(key, prev, `${me} at ${sv}`);
        prev = key;
        prevDraw = draw;
      }
    }
  }
  // Before the year starts (no envelope) the phone nudges on every tick, and never once the match is done.
  const pre = { now: 0, phase: 'countdown', due: null, state: null } as TState;
  assert.equal(tmnShown(1000, pre, 'a'), 1000);
  assert.equal(nudgeDue({ ...pre, phase: 'done' }, 1000, 'a'), false);
});
