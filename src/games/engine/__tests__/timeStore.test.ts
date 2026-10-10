/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { second, timeStore } from '../timeStore';

test('timeStore: records every tick, wakes the screen only when the shown value changes', () => {
  const st = timeStore(0);
  let wakes = 0;
  const off = st.subscribe(() => wakes++);
  assert.equal(st.set(150, second(150)), true); // first value
  assert.equal(st.set(300, second(300)), false);
  assert.equal(st.get(), 300); // a redraw for another reason still reads the latest time
  assert.equal(st.set(999, second(999)), false);
  assert.equal(st.set(1050, second(1050)), true);
  assert.equal(wakes, 2);
  off();
  st.set(2100, second(2100));
  assert.equal(wakes, 2);
});

test('timeStore: second() changes whenever a countdown (ceil) or stopwatch (floor) display does', () => {
  // Ticks 150 ms apart, at an offset that never lands on a whole second.
  for (let ms = 30_037; ms > 0; ms -= 150) {
    const next = ms - 150;
    const shownChanges = Math.ceil(ms / 1000) !== Math.ceil(next / 1000) || Math.floor(ms / 1000) !== Math.floor(next / 1000);
    assert.equal(second(ms) !== second(next), shownChanges, `at ${ms}`);
  }
});
