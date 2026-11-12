import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Seat } from '../../engine/types';
import type { Team } from '../../shell/teams';
import { confirm, endTurn, fix, freshDeck, leaders, mark, MAX_PASSES, newGame, planTurns, seatScores, startTurn, teamTotals, turnSeconds, type TTState } from '../game';
import { freshTilt, held, stepHold, stepTilt, TILT_GAP_MS } from '../tilt';
import WORDS from '../data/words.json';

const teams: Team[] = [
  { id: 0, name: 'A', color: '#f00' },
  { id: 1, name: 'B', color: '#0f0' },
];
const seats: Seat[] = [
  { seat: 0, name: 'You', team: 0 },
  { seat: 1, name: 'Bea', team: 1 },
  { seat: 2, name: 'Cy', team: 0 },
  { seat: 3, name: 'Di', team: 1 },
];
const deck = Array.from({ length: 200 }, (_, i) => `w${i}`);

/** Plays the current turn: r rights then p passes, then time up and review confirmed. */
function play(s: TTState, r: number, p = 0) {
  s = startTurn(s);
  for (let i = 0; i < r; i++) s = mark(s, 'right');
  for (let i = 0; i < p; i++) s = mark(s, 'pass');
  s = endTurn(s);
  return confirm(s, seats, teams);
}

test('teams alternate, one lap per round', () => {
  const t = planTurns(seats, teams, 2);
  assert.deepEqual(t.map((x) => x.seat), [0, 1, 2, 3, 0, 1, 2, 3]);
  assert.deepEqual(t.map((x) => x.team), [0, 1, 0, 1, 0, 1, 0, 1]);
});

test('a turn: rights count, passes stop at 3, the word showing at time up is dropped', () => {
  let s = startTurn(newGame(seats, teams, 1, deck));
  assert.equal(s.showing, 'w0');
  s = mark(s, 'right');
  for (let i = 0; i < 5; i++) s = mark(s, 'pass');
  assert.equal(s.passesLeft, 0);
  assert.equal(s.turns[0].words.length, 1 + MAX_PASSES);
  const showing = s.showing;
  s = mark(s, 'right');
  s = endTurn(s);
  assert.equal(s.phase, 'review');
  assert.equal(s.turns[0].words.length, 5);
  assert.ok(!s.turns[0].words.some((w) => w.id === s.showing) && showing !== null);
  assert.equal(seatScores(s).get(0), 2);
});

test('review fix swaps a word between correct and pass', () => {
  let s = startTurn(newGame(seats, teams, 1, deck));
  s = mark(s, 'pass');
  s = endTurn(s);
  s = fix(s, 0);
  assert.equal(s.turns[0].words[0].mark, 'right');
  s = fix(s, 0);
  assert.equal(s.turns[0].words[0].mark, 'pass');
});

test('clear winner ends the game', () => {
  let s = newGame(seats, teams, 1, deck);
  s = play(s, 3);
  s = play(s, 1);
  s = play(s, 2);
  s = play(s, 1);
  assert.equal(s.phase, 'over');
  assert.deepEqual([...teamTotals(s, teams)], [[0, 5], [1, 2]]);
});

test('a tie at the top adds one 30 s sudden-death turn per tied team, then a tie is shared', () => {
  let s = newGame(seats, teams, 1, deck);
  s = play(s, 2);
  s = play(s, 1);
  s = play(s, 0);
  s = play(s, 1);
  assert.equal(s.phase, 'handoff');
  const sd = s.turns.slice(4);
  assert.deepEqual(sd.map((t) => [t.team, !!t.sudden]), [[0, true], [1, true]]);
  assert.equal(turnSeconds(sd[0], 60), 30);
  s = play(s, 1);
  s = play(s, 1);
  assert.equal(s.phase, 'over');
  assert.deepEqual(leaders(s, teams), [0, 1]);
});

test('deck: unseen words first, all back once every word was seen', () => {
  const pool = ['a', 'b', 'c'];
  assert.deepEqual(freshDeck(pool, new Set(['a', 'b'])).deck, ['c']);
  const all = freshDeck(pool, new Set(pool));
  assert.equal(all.reset, true);
  assert.equal(all.deck.length, 3);
});

test('tilts: down = correct, up = pass, must come back upright, wobbles ignored', () => {
  let st = freshTilt();
  let r = stepTilt(st, { x: 1, y: 0, z: 0.9 }, 1000);
  assert.equal(r.tilt, 'down');
  st = r.st;
  r = stepTilt(st, { x: 1, y: 0, z: -0.9 }, 1100);
  assert.equal(r.tilt, null, 'not back upright yet');
  st = stepTilt(r.st, { x: 1, y: 0, z: 0 }, 1200).st;
  r = stepTilt(st, { x: 1, y: 0, z: -0.9 }, 1000 + TILT_GAP_MS - 10);
  assert.equal(r.tilt, null, 'too soon');
  r = stepTilt(st, { x: 1, y: 0, z: -0.9 }, 1000 + TILT_GAP_MS + 10);
  assert.equal(r.tilt, 'up');
});

test('forehead hold: upright for a moment starts the count', () => {
  let since = stepHold(null, { x: 0.98, y: 0.1, z: 0.05 }, 0);
  assert.equal(since, 0);
  since = stepHold(since, { x: 0.98, y: 0.1, z: 0.05 }, 800);
  assert.ok(held(since, 800));
  assert.equal(stepHold(since, { x: 0, y: 0, z: -1 }, 900), null);
});

test('word bank: 9 categories of 200, unique words and ids, no brackets', () => {
  const words = WORDS as { id: string; w: string; c: string }[];
  const by = new Map<string, number>();
  for (const x of words) by.set(x.c, (by.get(x.c) ?? 0) + 1);
  assert.equal(by.size, 9);
  for (const [c, n] of by) assert.equal(n, 200, c);
  assert.equal(new Set(words.map((x) => x.id)).size, words.length);
  assert.equal(new Set(words.map((x) => x.w.toLowerCase())).size, words.length);
  for (const x of words) assert.ok(!/[()[\]]/.test(x.w) && x.w.trim() === x.w && x.w.length <= 30, x.w);
});
