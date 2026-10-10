/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DESIGN_W, drawHeight, frameFit } from '../fit';

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('fit: Android counts the navigation bar the window leaves out, so phones fill the width', () => {
  // Galaxy S21 with 3-button navigation: window 360x752, screen 360x800.
  assert.equal(drawHeight({ width: 360, height: 752 }, { width: 360, height: 800 }, true), 800);
  const s21 = frameFit({ width: 360, height: 752 }, { width: 360, height: 800 }, true);
  close(s21.K, 360 / DESIGN_W);
  assert.equal(s21.frameW, 360);
  const big = frameFit({ width: 412, height: 867 }, { width: 412, height: 915 }, true);
  assert.equal(big.frameW, 412);
  // The same window on iOS (whole screen already) keeps the column, as before.
  assert.ok(frameFit({ width: 360, height: 752 }, { width: 360, height: 752 }, false).frameW < 360);
});

test('fit: split screen keeps the window height', () => {
  assert.equal(drawHeight({ width: 360, height: 380 }, { width: 360, height: 800 }, true), 380);
  assert.equal(drawHeight({ width: 180, height: 800 }, { width: 360, height: 800 }, true), 800);
});

test('fit: tall phones fill the width, short 16:9 phones and tablets get a centred column', () => {
  const tall = frameFit({ width: 390, height: 844 }, { width: 390, height: 844 }, false);
  close(tall.K, 390 / DESIGN_W);
  assert.equal(tall.frameW, 390);
  const se = frameFit({ width: 375, height: 667 }, { width: 375, height: 667 }, false);
  assert.ok(se.frameW < 375);
  close(se.K, 667 / 615);
  const pad = frameFit({ width: 820, height: 1180 }, { width: 820, height: 1180 }, false);
  assert.ok(pad.frameW < 820);
  // A tablet never fills the width, even when its shape would.
  assert.ok(frameFit({ width: 600, height: 1300 }, { width: 600, height: 1300 }, false).frameW < 600);
});
