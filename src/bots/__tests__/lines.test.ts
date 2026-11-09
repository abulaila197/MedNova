/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { heardKind, linesFor, type Moment } from '../lines';
import { PERSONAS } from '../types';

const VOICES = ['good-luck', 'nice-one', 'so-close', 'hurry-up', 'well-played', 'oops', 'rematch', 'gg', 'thank-you', 'sorry', 'ready', 'help-me', 'give-gift', 'too-slow', 'all-youve-got', 'catch-me', 'too-easy', 'keep-up', 'better-luck'];

test('lines: only the 19 voice lines are used', () => {
  const moments: Moment[] = ['ready', 'kicked', 'start', 'right', 'wrong', 'overtake', 'fire', 'tilt', 'round', 'end', 'youRight', 'youWrong', 'heard'];
  for (const p of PERSONAS)
    for (const m of moments)
      for (const place of ['lead', 'mid', 'last'] as const)
        for (const l of linesFor(p, 'scholar', m, { place, heard: 'nice' })) if ('voice' in l) assert.ok(VOICES.includes(l.voice), `${p} ${m} ${l.voice}`);
});

test('lines: every personality reacts when ready, kicked, at the end in any place, and to what you send', () => {
  for (const p of PERSONAS) {
    assert.ok(linesFor(p, 'genius', 'ready').length, p);
    assert.ok(linesFor(p, 'genius', 'kicked').length, p);
    for (const place of ['lead', 'mid', 'last'] as const) assert.ok(linesFor(p, 'freshman', 'end', { place }).length, `${p} ${place}`);
    for (const heard of ['nice', 'taunt', 'sorry', 'other'] as const) assert.ok(linesFor(p, 'scholar', 'heard', { heard }).length, `${p} ${heard}`);
  }
});

test('lines: a Show-off leading brags; a Cheerleader cheers when you get one right', () => {
  const brag = linesFor('showoff', 'scholar', 'right', { place: 'lead' }).filter((l) => 'voice' in l).map((l) => (l as { voice: string }).voice);
  assert.ok(brag.includes('too-easy'));
  const cheer = linesFor('cheer', 'scholar', 'youRight').filter((l) => 'voice' in l).map((l) => (l as { voice: string }).voice);
  assert.ok(cheer.includes('nice-one'));
});

test('heard: what you send is read as nice, a taunt, sorry or other', () => {
  assert.equal(heardKind('voice', 'gg'), 'nice');
  assert.equal(heardKind('voice', 'too-slow'), 'taunt');
  assert.equal(heardKind('voice', 'oops'), 'sorry');
  assert.equal(heardKind('voice', 'rematch'), 'other');
  assert.equal(heardKind('sticker', 'x', 'Mic drop'), 'taunt');
  assert.equal(heardKind('sticker', 'x', 'Love it'), 'nice');
});
