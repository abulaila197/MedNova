/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clock } from '../clock';

test('clock: time taken rounds down, a countdown rounds up, pad gives 00:42', () => {
  assert.equal(clock(72_900), '1:12');
  assert.equal(clock(59_500, { down: true }), '1:00');
  assert.equal(clock(400, { down: true }), '0:01');
  assert.equal(clock(0, { down: true }), '0:00');
  assert.equal(clock(-5000), '0:00');
  assert.equal(clock(42_000, { pad: true }), '00:42');
});
