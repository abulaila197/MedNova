/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { coloursOf, wordPlan } from '../../games/medicordle/rivals';
import { mindFor } from '../brain';
import { BotRace, orderPoints, YOU, type Rules } from '../race/engine';
import { cluePlan, rangePlan } from '../race/plans';
import type { Bot, BotType } from '../types';

const rival = (type: BotType, name: string): Bot => ({ id: `bot:${type}:${name}`, type, name, character: 'yara', level: 1, persona: 'cheer' });

/** A simple race: each rival solves at a fixed time given by its name's position. */
const rules = (at: Record<string, number | null>): Rules => ({
  limitMs: 10_000,
  revealMs: 2_000,
  lockMs: 1_000,
  countdownMs: 3_000,
  maxPoints: 100,
  plan: (b) => ({ doneAt: at[b.name], solved: at[b.name] != null, wrongAt: [] }),
  points: ({ rank, solved }) => (solved && rank ? orderPoints(rank) : 0),
  answerOf: () => 'x',
});
const race = (at: Record<string, number | null>, items = 2) =>
  new BotRace({ playId: 'p1', items: Array.from({ length: items }, (_, i) => i + 1), you: { name: 'You', character: 'yara', team: null }, rivals: Object.keys(at).map((n) => rival('scholar', n)), rules: rules(at), settings: {}, playerLevel: 1 });

test('race: countdown, then the question, rivals solving on time, then the reveal and the next', () => {
  const r = race({ Omar: 2_000, Lena: 5_000 });
  assert.equal(r.state(1_000).phase, 'countdown');
  let st = r.state(3_500);
  assert.equal(st.phase, 'case');
  assert.equal(st.index, 0);
  st = r.state(5_500); // 2.5 s in: Omar has solved, Lena not yet
  assert.equal(st.players.find((p) => p.name === 'Omar')!.solved, true);
  assert.equal(st.players.find((p) => p.name === 'Lena')!.solved, false);
  // You solve at 4 s in: 2nd. Lena at 5 s: everyone is done, so the reveal starts at once.
  r.solve(7_000);
  st = r.state(8_100);
  assert.equal(st.phase, 'reveal');
  assert.equal(st.me!.rank, 2);
  assert.equal(st.me!.points, 80);
  assert.equal(st.players.find((p) => p.name === 'Omar')!.score, 100);
  st = r.state(10_100);
  assert.equal(st.phase, 'case');
  assert.equal(st.index, 1);
});

test('race: time up closes a question; nobody solving scores nothing; the match ends after the last reveal', () => {
  const r = race({ Omar: null }, 1);
  assert.equal(r.state(3_000 + 9_999).phase, 'case');
  const st = r.state(3_000 + 10_000);
  assert.equal(st.phase, 'reveal');
  assert.equal(st.players.every((p) => p.score === 0), true);
  assert.equal(r.state(3_000 + 12_000).phase, 'done');
  assert.equal(st.my_items!.length, 1);
  assert.equal(st.my_items![0].solved_ms, null);
});

test('race: a wrong guess locks you, a repeat is ignored, and a tie goes to you', () => {
  const r = race({ Omar: 4_000 }, 1);
  assert.equal(r.wrong(4_000, 'a'), 'wrong');
  assert.equal(r.wrong(4_500, 'b'), 'ignored'); // locked for 1 s
  assert.equal(r.wrong(5_200, 'a'), 'ignored'); // already tried
  r.solve(7_000); // 4 s in, the same moment as Omar
  const st = r.state(7_000);
  assert.equal(st.players.find((p) => p.user_id === YOU)!.score, 100);
  assert.deepEqual(st.my_items![0].wrong, ['a']);
});

test('race: the same match gives the same plans (replays the same)', () => {
  const r1 = race({ Omar: 1_000 });
  const r2 = race({ Omar: 1_000 });
  assert.deepEqual(r1.state(20_000), r2.state(20_000));
});

test('clue plan: solves inside the clue it was given, wrong guesses keep the lock, all inside the time', () => {
  for (const type of ['freshman', 'scholar', 'genius'] as BotType[]) {
    for (let i = 0; i < 300; i++) {
      const p = cluePlan(mindFor(rival(type, 'Kofi')), { seed: `c${i}`, gap: 0, progress: 0.5, limitMs: 60_000, clueMs: 10_000, lockMs: 5_000, clues: 6 });
      for (let k = 1; k < p.wrongAt.length; k++) assert.ok(p.wrongAt[k] - p.wrongAt[k - 1] >= 5_000);
      if (p.doneAt != null) {
        assert.ok(p.solved && p.doneAt < 60_000);
        if (p.wrongAt.length) assert.ok(p.doneAt >= p.wrongAt[p.wrongAt.length - 1] + 5_000);
      }
    }
  }
});

test('range plan: each type solves inside its own range, never at one set second', () => {
  const times = new Set<number>();
  for (let i = 0; i < 200; i++) {
    const p = rangePlan(mindFor(rival('genius', 'Mei')), { seed: `r${i}`, limitMs: 90_000, right: true });
    assert.ok(p.doneAt! >= 0.08 * 90_000 - 1 && p.doneAt! <= 0.35 * 90_000 + 1);
    times.add(p.doneAt!);
  }
  assert.ok(times.size > 150);
  assert.equal(rangePlan(mindFor(rival('genius', 'Mei')), { seed: 'x', limitMs: 90_000, right: false }).doneAt, null);
});

test('medicordle: rivals play real words with true colours, and a solve ends on the word', () => {
  const packed = JSON.parse(readFileSync(join(process.cwd(), 'src/games/medicordle/data/guesses.json'), 'utf8')) as Record<string, string>;
  const answer = 'TISSUE';
  let solved = 0;
  for (let i = 0; i < 200; i++) {
    const p = wordPlan(mindFor(rival(i % 2 ? 'genius' : 'freshman', 'Ines')), { seed: `m${i}`, answer, limitMs: 120_000, gap: 0, progress: 0.5, wordsOf: (n) => packed[String(n)] });
    assert.ok(p.rows!.length <= 6);
    for (let k = 1; k < p.rows!.length; k++) assert.ok(p.rows![k].at > p.rows![k - 1].at);
    if (p.solved) {
      solved++;
      assert.equal(p.rows![p.rows!.length - 1].colours, 'gggggg');
      assert.equal(p.doneAt, p.rows![p.rows!.length - 1].at);
    }
    for (const r of p.rows!.slice(0, p.solved ? -1 : undefined)) assert.notEqual(r.colours, 'gggggg');
  }
  assert.ok(solved > 60);
  assert.equal(coloursOf('TISSUE', 'TISSUE'), 'gggggg');
  assert.equal(coloursOf('SITUSE', 'TISSUE'), 'ygyyyg');
});

test('helpers vs rivals: +10 s holds the question open longer; a skip keeps your streak', () => {
  const r = new BotRace({ playId: 'p1', items: [1, 2, 3], you: { name: 'You', character: 'yara', team: null }, rivals: [rival('scholar', 'Omar')], rules: { ...rules({ Omar: 500 }), streaks: true }, settings: {}, playerLevel: 1 });
  r.solve(4_000); // question 1 right at 1 s: everyone done, streak 1; reveal to 6 s
  assert.equal(r.state(6_000).index, 1);
  assert.equal(r.extend(6_500, 10_000), 'extended');
  assert.equal(r.state(25_999).phase, 'case');
  assert.equal(r.state(25_999).phase_ends_at, 26_000);
  assert.equal(r.skip(25_999), 'skipped');
  let st = r.state(26_100);
  assert.equal(st.phase, 'reveal');
  assert.equal(st.players.find((p) => p.user_id === YOU)!.streak, 1);
  assert.equal(st.my_items![1].skipped, true);
  // No answer on question 3 breaks it.
  st = r.state(27_999 + 10_000);
  assert.equal(st.players.find((p) => p.user_id === YOU)!.streak, 0);
});
