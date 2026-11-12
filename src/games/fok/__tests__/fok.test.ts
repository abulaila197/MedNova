/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { YOU } from '../../../bots/race/engine';
import type { Bot, BotType } from '../../../bots/types';
import { mindFor } from '../../../bots/brain';
import { rng } from '../../../bots/rng';
import { FOK, boardPoints, boardStars, buildBoard, buyHeart, endRun, rankRows, reveal, startRun, submit, tilesOf, type Board, type Group } from '../core';
import { currentSeat, offlineStandings, startOffline, stepOffline } from '../offline';
import { FokRace, planBoard, runAt } from '../rivals';
import GROUPS_JSON from '../data/groups.json';

const GROUPS = GROUPS_JSON as Group[];
const bank = new Map(GROUPS.map((g) => [g.id, g]));
const ids = GROUPS.map((g) => g.id);

test('the bank: 300 groups, 8+ boxes each, every clash points at a real group', () => {
  assert.equal(GROUPS.length, 300);
  for (const g of GROUPS) {
    assert.ok(g.b.length >= 8, g.id);
    assert.equal(new Set(g.b.map((b) => b[0].toLowerCase())).size, g.b.length, `${g.id} repeats a box`);
    for (const x of g.x) assert.ok(bank.has(x), `${g.id} clashes with missing ${x}`);
  }
});

test('boards: levels by slot, wordplay only in the hard slot, never two clashing groups', () => {
  for (let i = 0; i < 300; i++) {
    const r = rng(`b${i}`);
    const order = [...ids].sort(() => r() - 0.5);
    const b = buildBoard(bank, order, r)!;
    assert.equal(b.groups.length, 4);
    const gs = b.groups.map((x) => bank.get(x.id)!);
    assert.deepEqual(gs.map((g) => g.lv), [1, 2, 2, 3]);
    gs.slice(0, 3).forEach((g) => assert.notEqual(g.f, 'wordplay'));
    for (const a of gs) for (const c of gs) if (a !== c) assert.ok(!a.x.includes(c.id), `${a.id} clashes with ${c.id}`);
    for (const x of b.groups) assert.equal(new Set(x.boxes).size, 4);
    // No box text twice on one board.
    const texts = b.groups.flatMap((x, s) => x.boxes.map((k) => gs[s].b[k][0].toLowerCase()));
    assert.equal(new Set(texts).size, 16);
  }
});

const board: Board = { groups: buildBoard(bank, ids, rng('fixed'))!.groups };

test('submit: right, one away, wrong, repeat, and the last group falls into place', () => {
  let run = startRun(rng('r'));
  let out = submit(run, [0, 1, 2, 4]);
  assert.equal(out.verdict, 'oneAway');
  run = out.run;
  assert.equal(run.hearts, 2);
  assert.equal(submit(run, [4, 2, 1, 0]).verdict, 'repeat');
  out = submit(run, [0, 1, 4, 5]);
  assert.equal(out.verdict, 'wrong');
  run = out.run;
  out = submit(run, tilesOf(0));
  assert.equal(out.verdict, 'right');
  run = submit(out.run, tilesOf(2)).run;
  out = submit(run, tilesOf(3));
  assert.deepEqual(out.run.found, [0, 2, 3, 1]);
  assert.equal(out.run.auto, 1);
  assert.equal(out.run.phase, 'done');
  assert.ok(out.run.solved);
  assert.equal(boardStars(out.run), 2);
});

test('out of hearts: one token heart, then the board ends', () => {
  let run = startRun(rng('o'));
  run = submit(run, [0, 1, 2, 4]).run;
  run = submit(run, [0, 1, 2, 5]).run;
  run = submit(run, [0, 1, 2, 6]).run;
  assert.equal(run.phase, 'out');
  run = buyHeart(run);
  assert.equal(run.phase, 'play');
  assert.equal(run.hearts, 1);
  assert.equal(buyHeart(run), run);
  run = submit(run, [0, 1, 2, 7]).run;
  assert.equal(run.phase, 'done');
  assert.equal(boardStars(run), 0);
});

test('points: levels found, minus mistakes and the hint, 0 to 8', () => {
  let run = startRun(rng('p'));
  for (const s of [0, 1, 2]) run = submit(run, tilesOf(s)).run;
  assert.equal(boardPoints(board, bank, run), FOK.maxPoints);
  let r2 = reveal(startRun(rng('q')));
  assert.equal(r2.revealed, 0);
  r2 = submit(r2, [0, 1, 2, 4]).run;
  r2 = endRun(r2);
  assert.equal(boardPoints(board, bank, r2), 0);
});

test('ranks: points, then fewer mistakes, then faster; equal shares the place', () => {
  const r = rankRows([
    { id: 'a', points: 5, mistakes: 1, ms: 9 },
    { id: 'b', points: 5, mistakes: 0, ms: 20 },
    { id: 'c', points: 8, mistakes: 2, ms: 50 },
    { id: 'd', points: 5, mistakes: 1, ms: 9 },
  ]);
  assert.deepEqual(Object.fromEntries(r.map((x) => [x.id, x.rank])), { c: 1, b: 2, a: 3, d: 3 });
});

test('pass the phone: right scores and passes, wrong passes, last group is nobody’s, then the next board', () => {
  let s = startOffline([board, board], [0, 1, 2], rng('off'));
  const first = currentSeat(s);
  s = stepOffline(s, { type: 'READY' });
  s = stepOffline(s, { type: 'SUBMIT', tiles: tilesOf(3) });
  assert.equal(s.players[first].score, 3);
  assert.equal(s.foundBy[3], first);
  assert.equal(s.phase, 'handoff');
  const second = currentSeat(s);
  assert.notEqual(second, first);
  s = stepOffline(stepOffline(s, { type: 'READY' }), { type: 'SUBMIT', tiles: [0, 1, 2, 4] });
  assert.equal(s.players[second].mistakes, 1);
  assert.ok(s.run.hearts > 100);
  for (const slot of [0, 1]) s = stepOffline(stepOffline(s, { type: 'READY' }), { type: 'SUBMIT', tiles: tilesOf(slot) });
  assert.equal(s.phase, 'boardEnd');
  assert.equal(s.foundBy[2], undefined);
  s = stepOffline(s, { type: 'NEXT' });
  assert.equal(s.index, 1);
  assert.equal(s.phase, 'handoff');
  s = stepOffline(s, { type: 'FINISH' });
  assert.equal(s.phase, 'done');
  const rows = offlineStandings(s, { 0: 'A', 1: 'B', 2: 'C' });
  assert.equal(rows.length, 3);
});

const rival = (type: BotType, name: string): Bot => ({ id: `bot:${type}:${name}`, type, name, character: 'yara', level: 1, persona: 'cheer' });

test('rivals: plans are seeded, in time order, and never more than 3 misses', () => {
  for (const type of ['freshman', 'scholar', 'genius'] as BotType[]) {
    const m = mindFor(rival(type, 'x'), 5);
    const a = planBoard(m, board, 'seed').moves;
    assert.deepEqual(planBoard(m, board, 'seed').moves, a);
    for (let i = 1; i < a.length; i++) assert.ok(a[i].at >= a[i - 1].at);
    assert.ok(a.filter((x) => x.slot == null).length <= FOK.hearts);
    const run = runAt(board, a, Infinity);
    assert.ok(run.found.length === 4 || run.phase !== 'play');
  }
});

test('race: you finish, the rivals finish their go, the reveal, then the next board', () => {
  const rivals = [rival('genius', 'Gia'), rival('freshman', 'Fen')];
  const race = new FokRace({ playId: 'p1', items: [1, 2], you: { name: 'You', character: 'yara', team: null }, rivals, settings: {}, playerLevel: 5, boards: [board, board], limitMs: 0 });
  assert.equal(race.state(0).phase, 'countdown');
  const t0 = 3_000;
  assert.equal(race.state(t0).phase, 'case');
  assert.equal(race.submit(t0 + 1000, tilesOf(0)), 'right');
  race.submit(t0 + 2000, tilesOf(1));
  assert.equal(race.submit(t0 + 3000, tilesOf(2)), 'right');
  // Rivals still going finish within 6 s (Freshman 5-6 s), then the reveal.
  assert.equal(race.state(t0 + 3000).phase, 'case');
  const t1 = t0 + 3000 + 6_000;
  const st = race.state(t1);
  assert.equal(st.phase, 'reveal');
  assert.equal(st.me?.points, FOK.maxPoints);
  assert.equal(st.players.find((p) => p.user_id === YOU)?.rank, 1);
  assert.equal(race.state(t1 + 7_000).phase, 'case');
  assert.equal(race.state(t1 + 7_000).index, 1);
  assert.ok(race.runOfBoard(0)?.solved);
});

test('race with a clock: time up closes the board where everyone is', () => {
  const race = new FokRace({ playId: 'p2', items: [1], you: { name: 'You', character: 'yara', team: null }, rivals: [rival('freshman', 'Fen')], settings: {}, playerLevel: 1, boards: [board], limitMs: 1_000 });
  race.state(3_000);
  const st = race.state(4_000);
  assert.equal(st.phase, 'reveal');
  assert.equal(st.me?.points, 0);
  assert.equal(race.state(4_000 + 7_000).phase, 'done');
});
