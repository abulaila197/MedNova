/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rank } from '../../engine/standings';
import { closeThreshold, helpsUsed, inList, isClose, keyStates, lengthCheck, nextLap, NO_HELP, offlineRows, pickClear, pickHint, score, seeded, soloExp, surgeonGuess, surgeonMarks, trayOf, wayOf, withGrant } from '../core';
import { currentSeat, guessesOf, offlineStandings, startOffline, stepOffline, turnLeft } from '../offline';
import { showDefinition, startSolo, stepSolo } from '../solo';

test('score: greens first, then yellows from what is left, duplicates counted', () => {
  assert.deepEqual(score('ANEMIA', 'SEPSIS'), ['off', 'off', 'near', 'off', 'ok', 'off']);
  assert.deepEqual(score('STASIS', 'SEPSIS'), ['ok', 'off', 'off', 'ok', 'ok', 'ok']);
  assert.deepEqual(score('SSSSSS', 'SEPSIS'), ['ok', 'off', 'off', 'ok', 'off', 'ok']);
  assert.deepEqual(score('SEPSIS', 'SEPSIS'), Array(6).fill('ok'));
});

test('score: a short Custom guess leaves grey missing columns, and they still feed yellows', () => {
  // answer MALARIA (7) vs guess of 7 is full length; use a 9-letter answer with a 7-letter guess
  const m = score('MALARIA', 'MENINGIOMA'.slice(0, 9));
  assert.equal(m.length, 9);
  assert.deepEqual(m.slice(7), ['missing', 'missing']);
  assert.equal(m[0], 'ok');
});

test('length rule: Classic exactly 6, Custom 7 up to the answer length', () => {
  assert.equal(lengthCheck('ABCDE', 'classic', 6), 'short');
  assert.equal(lengthCheck('ABCDEF', 'classic', 6), null);
  assert.equal(lengthCheck('ABCDEF', 'custom', 10), 'short');
  assert.equal(lengthCheck('ABCDEFG', 'custom', 10), null);
  assert.equal(lengthCheck('ABCDEFGHIJK', 'custom', 10), 'long');
});

test('guess list: binary search over a packed fixed-width string', () => {
  const packed = ['ANEMIA', 'ASTHMA', 'SEPSIS', 'STASIS'].join('');
  for (const w of ['ANEMIA', 'ASTHMA', 'SEPSIS', 'STASIS']) assert.ok(inList(packed, w));
  assert.ok(!inList(packed, 'ZZZZZZ'));
  assert.ok(!inList(undefined, 'SEPSIS'));
});

test('keyboard: each letter shows its best result', () => {
  const k = keyStates(['ANEMIA', 'STASIS'], 'SEPSIS');
  assert.equal(k.S, 'ok');
  assert.equal(k.E, 'near');
  assert.equal(k.A, 'off');
  assert.equal(k.Z, undefined);
});

test('hint (NM3): most repeated letter among non-green columns, ties random, reveals all its columns', () => {
  // TUBERCULOSIS: U at 1 and 6, S at 9 and 11 -> tie between S and U
  const a = pickHint('TUBERCULOSIS', [], [], () => 0);
  assert.deepEqual(a, { letter: 'S', columns: [9, 11] });
  const b = pickHint('TUBERCULOSIS', [], [], () => 0.99);
  assert.deepEqual(b, { letter: 'U', columns: [1, 6] });
  // second hint skips columns already revealed
  const c = pickHint('TUBERCULOSIS', [], [9, 11], () => 0);
  assert.equal(c?.letter, 'U');
  // nothing repeats among the open columns -> random single letter
  const d = pickHint('MALARIA', ['MALARIA'.slice(0, 1) + 'XXXXXX'], [], () => 0);
  assert.equal(d?.letter, 'A');
  assert.equal(pickHint('SEPSIS', ['SEPSIS'], []), null);
});

test('close alert (NM11): two-thirds green, rounded up', () => {
  assert.equal(closeThreshold(6), 4);
  assert.equal(closeThreshold(10), 7);
  assert.ok(isClose(['STASIS'], 'SEPSIS'));
  assert.ok(!isClose(['ANEMIA'], 'SEPSIS'));
});

test('Solo EXP (NM22): 12, 10, 8, 6, 4, 2; a miss pays nothing', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => soloExp(n)), [12, 10, 8, 6, 4, 2]);
  assert.equal(soloExp(null), 0);
});

test('solo: definition on the last try, win scores by guess, the last word ends the run', () => {
  let r = startSolo('classic', ['w1'], 0);
  for (const g of ['ANEMIA', 'ASTHMA', 'STASIS', 'ANEMIA']) r = stepSolo(r, { type: 'GUESS', word: g, answer: 'SEPSIS', now: 1 });
  assert.ok(!showDefinition(r));
  r = stepSolo(r, { type: 'GUESS', word: 'ASTHMA', answer: 'SEPSIS', now: 1 });
  assert.ok(showDefinition(r));
  r = stepSolo(r, { type: 'GUESS', word: 'SEPSIS', answer: 'SEPSIS', now: 5_000 });
  assert.equal(r.phase, 'wordOver');
  assert.equal(r.results[0].exp, 2); // guess 6
  r = stepSolo(r, { type: 'NEXT', now: 6_000 });
  assert.equal(r.phase, 'done');
});

test('solo endless: next word, hints reset, finish any time between words', () => {
  let r = startSolo('custom', ['a', 'b'], 0);
  r = stepSolo(r, { type: 'HELP', grant: { kind: 'letter', columns: [1, 6] } });
  assert.equal(r.help.letters, 1);
  r = stepSolo(r, { type: 'GUESS', word: 'MALARIA', answer: 'MALARIA', now: 1 });
  assert.equal(r.results[0].exp, 12);
  r = stepSolo(r, { type: 'NEXT', now: 2 });
  assert.deepEqual([r.index, r.help.letters, r.help.revealed.length], [1, 0, 0]);
  r = stepSolo(r, { type: 'PAUSE', now: 3 });
  r = stepSolo(r, { type: 'RESUME', now: 4 });
  for (let i = 0; i < 6; i++) r = stepSolo(r, { type: 'GUESS', word: 'CHOLERA', answer: 'MALARIA', now: 5 });
  assert.equal(r.results[1].solved, false);
  r = stepSolo(r, { type: 'FINISH' });
  assert.equal(r.phase, 'done');
  assert.equal(r.score, 12);
});

test('offline rows (NM14): full laps', () => {
  assert.deepEqual([2, 3, 4, 5, 6].map(offlineRows), [6, 6, 8, 10, 6]);
});

test('offline laps (NM14): random order, never the same player twice in a row', () => {
  const rng = seeded(42);
  let last: number | null = null;
  let prev: number | null = null;
  for (let lap = 0; lap < 200; lap++) {
    const order = nextLap([0, 1, 2, 3], last, rng);
    assert.equal(new Set(order).size, 4);
    for (const s of order) {
      assert.notEqual(s, prev);
      prev = s;
    }
    last = order[order.length - 1];
  }
  // two players: strict alternation
  let l2 = nextLap([0, 1], 1, rng);
  assert.equal(l2[0], 0);
  l2 = nextLap([0, 1], 0, rng);
  assert.equal(l2[0], 1);
});

test('offline: shared board, winner takes the word, time out uses the row and passes the turn', () => {
  const rng = seeded(7);
  let r = startOffline('classic', [0, 1], ['w1', 'w2'], 10_000, rng);
  assert.equal(r.rows, 6);
  const first = currentSeat(r);
  r = stepOffline(r, { type: 'READY', now: 0 }, rng);
  r = stepOffline(r, { type: 'GUESS', word: 'ANEMIA', answer: 'SEPSIS', now: 3_000 }, rng);
  assert.equal(r.phase, 'ready');
  assert.notEqual(currentSeat(r), first);
  r = stepOffline(r, { type: 'READY', now: 4_000 }, rng);
  assert.equal(turnLeft(r, 9_000), 5_000);
  r = stepOffline(r, { type: 'TICK', now: 14_000 }, rng);
  assert.equal(r.turns.length, 2);
  assert.equal(r.turns[1].word, null);
  assert.equal(currentSeat(r), first);
  r = stepOffline(r, { type: 'READY', now: 15_000 }, rng);
  r = stepOffline(r, { type: 'GUESS', word: 'SEPSIS', answer: 'SEPSIS', now: 17_000 }, rng);
  assert.equal(r.phase, 'wordOver');
  assert.equal(r.results[0].winner, first);
  assert.deepEqual(guessesOf(r), ['ANEMIA', 'SEPSIS']);
  r = stepOffline(r, { type: 'NEXT' }, rng);
  // the new word never starts with the player who just played
  assert.notEqual(currentSeat(r), first);
  assert.equal(r.turns.length, 0);
});

test('offline: rows run out with no winner; standings by words won then time', () => {
  const rng = seeded(3);
  let r = startOffline('classic', [0, 1, 2, 3], ['w1'], 20_000, rng);
  assert.equal(r.rows, 8);
  let t = 0;
  for (let i = 0; i < 8; i++) {
    r = stepOffline(r, { type: 'READY', now: t }, rng);
    t += 1_000;
    r = stepOffline(r, { type: 'GUESS', word: 'ANEMIA', answer: 'SEPSIS', now: t }, rng);
  }
  assert.equal(r.phase, 'wordOver');
  assert.equal(r.results[0].winner, null);
  // each player got exactly two turns
  for (const s of [0, 1, 2, 3]) assert.equal(r.turns.filter((x) => x.seat === s).length, 2);
  const st = rank(offlineStandings(r, { 0: 'You' }));
  assert.ok(st.every((x) => x.score === 0 && x.rank === 1));
});

test('offline: removing a player skips their turns; at least 2 stay', () => {
  const rng = seeded(11);
  let r = startOffline('classic', [0, 1, 2], ['w1'], 10_000, rng);
  const on = currentSeat(r);
  r = stepOffline(r, { type: 'REMOVE', seat: on }, rng);
  assert.notEqual(currentSeat(r), on);
  assert.equal(r.turns.length, 0);
  const next = currentSeat(r);
  const before = r;
  r = stepOffline(r, { type: 'REMOVE', seat: next }, rng);
  assert.equal(r, before);
});

test('endless (NM30): a word that already paid EXP pays nothing again', () => {
  let r = startSolo('classic', ['w1', 'w2'], 0, ['w1']);
  r = stepSolo(r, { type: 'GUESS', word: 'SEPSIS', answer: 'SEPSIS', now: 1 });
  assert.equal(r.results[0].exp, 0);
  r = stepSolo(r, { type: 'NEXT', now: 2 });
  r = stepSolo(r, { type: 'GUESS', word: 'ANEMIA', answer: 'ANEMIA', now: 3 });
  assert.ok(r.results[1].exp > 0);
  assert.deepEqual(r.paid, ['w1', 'w2']);
});

test('helpers: Clear picks 3 grey-able letters not in the word; grants add up', () => {
  const pick = pickClear('MALARIA', ['CHOLERA'], [], () => 0.3)!;
  assert.equal(pick.length, 3);
  for (const ch of pick) assert.ok(!'MALARIA'.includes(ch) && !'CHOLE'.includes(ch));
  let h = withGrant(NO_HELP, { kind: 'letter', columns: [1, 3] });
  h = withGrant(h, { kind: 'clear', letters: pick });
  h = withGrant(h, { kind: 'define' });
  assert.deepEqual([h.letters, h.revealed, h.cleared.length, h.defined, helpsUsed(h)], [1, [1, 3], 3, true, 3]);
});

test('Word Surgeon: a try is all green or all grey; the tray never spells the word; guesses keep shown letters', () => {
  assert.deepEqual(surgeonMarks('MALARIA', 'MALARIA'), Array(7).fill('ok'));
  assert.deepEqual(surgeonMarks('MALAIRA', 'MALARIA'), Array(7).fill('off'));
  for (let seed = 0; seed < 50; seed++) {
    const tray = trayOf('SCURVY', new Set(), seed);
    assert.equal([...tray].sort().join(''), 'CRSUVY');
    assert.notEqual(tray.join(''), 'SCURVY');
  }
  assert.equal(surgeonGuess('SCURVY', new Set([0, 5]), 'CURV'), 'SCURVY');
  assert.equal(wayOf({ way: 'surgeon' }), 'surgeon');
  assert.equal(wayOf({}), 'tries');
});
