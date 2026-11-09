/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { YOU } from '../../../bots/race/engine';
import type { Bot, BotType } from '../../../bots/types';
import type { PuzzleDef } from '../core';
import { CW_COUNTDOWN_MS, CW_REVEAL_MS, CwRace, nextAttempt, showdownStars } from '../rivals';
import { mindFor } from '../../../bots/brain';

const rival = (type: BotType, name: string): Bot => ({ id: `bot:${type}:${name}`, type, name, character: 'yara', level: 1, persona: 'cheer' });

/** A tiny grid: CAT across the top, CUP and ATE down from it, and PE along the bottom, fully crossed (so it comes along). */
const puzzle: PuzzleDef = {
  id: 'cw-t',
  level: 1,
  rows: 3,
  cols: 3,
  words: [
    { id: 'w1', answer: 'CAT', direction: 'across', start: { r: 0, c: 0 }, category: 'x', question: { kind: 'text', text: 'pet' } },
    { id: 'w2', answer: 'CUP', direction: 'down', start: { r: 0, c: 0 }, category: 'x', question: { kind: 'text', text: 'mug' } },
    { id: 'w3', answer: 'ATE', direction: 'down', start: { r: 0, c: 1 }, category: 'x', question: { kind: 'text', text: 'had lunch' } },
    { id: 'w4', answer: 'PE', direction: 'across', start: { r: 2, c: 0 }, category: 'x', question: { kind: 'text', text: 'gym class' } },
  ],
};
const make = (rivals: Bot[], items = [1], limitMs = 60_000) =>
  new CwRace({ playId: 'p1', items, you: { name: 'You', character: 'yara', team: null }, rivals, settings: {}, playerLevel: 1, puzzleOf: () => puzzle, limitMs });

test('crossword rivals: an attempt is seeded, and a Genius is quicker than a Freshman', () => {
  const g = mindFor(rival('genius', 'Omar'));
  const f = mindFor(rival('freshman', 'Lena'));
  const a = { seed: 's', n: 0, len: 6, gap: 0, progress: 0, limitMs: 600_000 };
  assert.deepEqual(nextAttempt(g, a), nextAttempt(g, a));
  const avg = (m: typeof g) => Array.from({ length: 40 }, (_, n) => nextAttempt(m, { ...a, n }).ms).reduce((x, y) => x + y, 0) / 40;
  assert.ok(avg(g) < avg(f));
  assert.ok(avg(g) > 20_000 && avg(f) < 160_000);
});

test('crossword race: your claim takes the word and the crossing word it completes; a repeat costs nothing', () => {
  const r = make([]);
  assert.equal(r.state(1000).phase, 'countdown');
  const t0 = CW_COUNTDOWN_MS + 1000;
  assert.equal(r.submit(t0, 'w1', 'CAR'), 'wrong');
  assert.equal(r.submit(t0 + 100, 'w1', 'CAR'), 'repeat');
  assert.equal(r.state(t0 + 100).players[0].hearts, 4);
  assert.equal(r.submit(t0 + 200, 'w1', 'CAT'), 'right');
  assert.equal(r.submit(t0 + 300, 'w1', 'CAT'), 'taken');
  assert.equal(r.submit(t0 + 400, 'w2', 'CUP'), 'right');
  assert.equal(r.submit(t0 + 500, 'w3', 'ATE'), 'right'); // PE is now fully showing: it comes along, auto
  const st = r.state(t0 + 600);
  assert.equal(st.claims!.length, 4);
  assert.equal(st.claims!.find((c) => c.word_id === 'w4')!.auto, true);
  assert.equal(st.players[0].score, 11);
  // The grid is full: the reveal, then done (one puzzle).
  assert.equal(st.phase, 'reveal');
  assert.equal(st.players[0].item_rank, 1);
  assert.equal(r.state(t0 + 500 + CW_REVEAL_MS + 1).phase, 'done');
  assert.equal(r.state(t0 + 500 + CW_REVEAL_MS + 1).my_items![0].points, 11);
});

test('crossword race: rivals claim words at their own pace, lose hearts, and the puzzle ends at time up', () => {
  const r = make([rival('genius', 'Omar'), rival('freshman', 'Lena')], [1], 120_000);
  const st = r.state(CW_COUNTDOWN_MS + 120_000 + 1);
  assert.ok(st.phase === 'reveal' || st.phase === 'done'); // time up, or the Genius filled the small grid before that
  const omar = st.players.find((p) => p.name === 'Omar')!;
  const lena = st.players.find((p) => p.name === 'Lena')!;
  assert.ok((st.claims?.length ?? 0) >= 1, 'someone claimed a word in two minutes');
  assert.ok(omar.score >= lena.score);
  for (const p of st.players) assert.ok((p.hearts ?? 0) <= 5 && (p.hearts ?? 0) >= 0);
  // The same match replays the same way.
  const again = make([rival('genius', 'Omar'), rival('freshman', 'Lena')], [1], 120_000).state(CW_COUNTDOWN_MS + 120_000 + 1);
  assert.deepEqual(again.claims, st.claims);
});

test('crossword race: a rival never takes the word you have open while another is free', () => {
  const r = make([rival('genius', 'Omar')], [1], 600_000);
  r.state(CW_COUNTDOWN_MS + 1);
  r.setOpen('w1');
  // Walk time forward until Omar's first claim lands.
  let st = r.state(CW_COUNTDOWN_MS + 1);
  for (let t = CW_COUNTDOWN_MS; t < 600_000 && !st.claims?.length; t += 1000) st = r.state(t);
  assert.ok(st.claims!.length >= 1);
  assert.notEqual(st.claims![0].word_id, 'w1');
});

test('crossword race: out of hearts, revive once, then decline leaves you watching', () => {
  const r = make([]);
  const t0 = CW_COUNTDOWN_MS + 1000;
  for (const a of ['AAA', 'BBB', 'CCC', 'DDD', 'EEE']) assert.equal(r.submit(t0, 'w1', a), 'wrong');
  assert.equal(r.state(t0).players[0].hearts, 0);
  assert.equal(r.submit(t0, 'w1', 'CAT'), 'ignored');
  assert.equal(r.revive(t0), true);
  assert.equal(r.state(t0).players[0].hearts, 1);
  assert.equal(r.revive(t0), false);
  assert.equal(r.submit(t0, 'w1', 'FFF'), 'wrong');
  r.decline(t0 + 10);
  // Everyone is out: the puzzle ends there.
  assert.equal(r.state(t0 + 20).phase, 'reveal');
  assert.equal(r.state(t0 + 20).players[0].done, true);
  assert.equal(showdownStars(1, 0), 0);
  assert.equal(showdownStars(2, 1), 2);
  assert.equal(YOU, 'you');
});
