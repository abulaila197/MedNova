import assert from 'node:assert/strict';
import { test } from 'node:test';
import termsJson from '../data/terms.json';
import type { Term } from '../engine/types';
import { dueOf, expOf, onlineRanks, startOnlineRoom, stepOnline, viewsOf, type Move, type Room } from '../online';

const TERMS = termsJson as Term[];
const SEATS = ['h', 'b', 'c', 'd'];
const rng = () => 0.42;

function room(settings: Record<string, unknown> = {}) {
  return startOnlineRoom({ host: 'h', seats: SEATS, names: { h: 'Hana', b: 'Badr', c: 'Cyra', d: 'Dima' }, settings });
}
function go(r: Room, me: string, move: Move, at: number, dropped: string[] = []) {
  return stepOnline(TERMS, r, me, move, dropped, at, rng);
}
const giverOf = (r: Room, team: 'A' | 'B') => Object.entries(viewsOf(r, TERMS)).find(([id, v]) => id !== 'watch' && v.me?.team === team && v.me.role === 'giver')![0];
const guesserOf = (r: Room, team: 'A' | 'B') => Object.entries(viewsOf(r, TERMS)).find(([id, v]) => id !== 'watch' && v.me?.team === team && v.me.role === 'guesser')![0];
/** The giver gives a fine clue and the guesser names the word. */
function solve(r: Room, team: 'A' | 'B', at: number): Room {
  const g = giverOf(r, team);
  const word = viewsOf(r, TERMS)[g].word!;
  const clue = ['zzqx', 'qqzx', 'xxqz'].find((c) => go(r, g, { type: 'CLUE', text: c }, at).refused === null)!;
  r = go(r, g, { type: 'CLUE', text: clue }, at).next;
  return go(r, guesserOf(r, team), { type: 'GUESS', termId: word.id }, at).next;
}

test('the room starts 2 + 2 with a giver each; only the host starts it', () => {
  let r = room({ bank: 'clinical', words: 5, rounds: 1 });
  assert.equal(r.lobby.settings.bank, 'clinical');
  assert.equal(go(r, 'b', { type: 'START' }, 0).refused?.code, 'NOT_HOST');
  r = go(r, 'h', { type: 'START' }, 0).next;
  assert.equal(r.phase, 'playing');
  // Same words, different order.
  assert.deepEqual([...r.plan![0].lists.A].sort(), [...r.plan![0].lists.B].sort());
});

test("only the giver sees the word; each team sees only the other team's count", () => {
  const r = go(room(), 'h', { type: 'START' }, 0).next;
  const v = viewsOf(r, TERMS);
  const words = SEATS.filter((id) => v[id].word);
  assert.equal(words.length, 2);
  for (const id of words) assert.equal(v[id].me!.role, 'giver');
  assert.equal(v.watch.word, null);
  for (const id of SEATS) assert.equal(JSON.stringify(v[id]).includes('"forbidden"'), v[id].me!.role === 'giver');
});

test('clues are checked by the server: the term word, a forbidden word, a repeat', () => {
  let r = go(room(), 'h', { type: 'START' }, 0).next;
  const g = giverOf(r, 'A');
  const w = viewsOf(r, TERMS)[g].word!;
  assert.equal(go(r, g, { type: 'CLUE', text: w.name.split(' ')[0] }, 1).refused?.code, 'TERM_WORD');
  assert.equal(go(r, g, { type: 'CLUE', text: w.forbidden[0] }, 1).refused?.code, 'FORBIDDEN');
  assert.equal(go(r, g, { type: 'CLUE', text: 'two words' }, 1).refused?.code, 'NOT_ONE_WORD');
  assert.equal(go(r, guesserOf(r, 'A'), { type: 'CLUE', text: 'zzqx' }, 1).refused?.code, 'NOT_GIVER');
  r = go(r, g, { type: 'CLUE', text: 'zzqx' }, 1).next;
  assert.equal(go(r, g, { type: 'CLUE', text: 'ZZQX' }, 1).refused?.code, 'DUPLICATE');
  assert.deepEqual(viewsOf(r, TERMS)[guesserOf(r, 'A')].clues, ['zzqx']);
});

test('wrong guesses are free, a right one brings the next word, skip moves the word to the back', () => {
  let r = go(room(), 'h', { type: 'START' }, 0).next;
  const gA = giverOf(r, 'A');
  const qA = guesserOf(r, 'A');
  const first = viewsOf(r, TERMS)[gA].word!.id;
  const wrong = TERMS.find((x) => x.id !== first)!.id;
  r = go(r, qA, { type: 'GUESS', termId: wrong }, 1).next;
  assert.deepEqual(viewsOf(r, TERMS)[gA].guesses, [wrong]);
  assert.equal(go(r, gA, { type: 'GUESS', termId: first }, 1).refused?.code, 'NOT_GUESSER');
  r = go(r, gA, { type: 'SKIP' }, 2).next;
  assert.notEqual(viewsOf(r, TERMS)[gA].word!.id, first);
  assert.deepEqual(viewsOf(r, TERMS)[gA].guesses, []);
  r = solve(r, 'A', 3);
  assert.equal(viewsOf(r, TERMS)[qA].teams!.A.completed, 1);
  assert.equal(viewsOf(r, TERMS)[guesserOf(r, 'B')].teams!.A.completed, 1);
});

test('the round ends when both teams finish, or at 3:00; then roles swap in round 2', () => {
  let r = go(room({ words: 5, rounds: 2 }), 'h', { type: 'START' }, 0).next;
  const g1 = giverOf(r, 'A');
  for (let i = 0; i < 5; i++) r = solve(r, 'A', 1000 + i);
  assert.equal(r.phase, 'playing');
  assert.equal(dueOf(r), 180_000);
  r = go(r, 'h', { type: 'TICK' }, 180_000).next;
  assert.equal(r.phase, 'roundEnd');
  assert.equal(r.results[0].A.wordsCompleted, 5);
  assert.equal(r.results[0].A.timeMs, 1004);
  assert.equal(r.results[0].B.timeMs, 180_000);
  r = go(r, 'h', { type: 'NEXT' }, 181_000).next;
  assert.equal(r.round, 1);
  assert.notEqual(giverOf(r, 'A'), g1);
  // The break ends by itself too.
  for (let i = 0; i < 5; i++) r = solve(r, 'A', 182_000);
  for (let i = 0; i < 5; i++) r = solve(r, 'B', 183_000);
  assert.equal(r.phase, 'roundEnd');
  r = go(r, 'c', { type: 'TICK' }, 183_000 + 12_000).next;
  assert.equal(r.phase, 'finished');
  assert.equal(r.played[0].winner, 'A');
  assert.deepEqual(onlineRanks(r, SEATS).filter((x) => x === 1).length, 2);
});

test('a player who drops out makes the team forfeit the round', () => {
  let r = go(room(), 'h', { type: 'START' }, 0).next;
  const qB = guesserOf(r, 'B');
  r = go(r, 'h', { type: 'TICK' }, 1000, [qB]).next;
  assert.equal(r.teams!.B.forfeit, true);
  for (let i = 0; i < 5; i++) r = solve(r, 'A', 2000);
  r = go(r, 'h', { type: 'NEXT' }, 3000).next;
  assert.equal(r.phase, 'finished');
  assert.equal(r.played[0].winner, 'A');
  assert.ok(r.played[0].forfeited.includes(qB));
});

test('a rematch needs all four; EXP is 60 / 40 / 20, nothing on a forfeit, 60 at most', () => {
  let r = go(room(), 'h', { type: 'START' }, 0).next;
  r = go(r, 'h', { type: 'TICK' }, 180_000).next;
  r = go(r, 'h', { type: 'NEXT' }, 181_000).next;
  assert.equal(r.played[0].winner, 'draw');
  for (const id of ['h', 'b', 'c']) r = go(r, id, { type: 'REMATCH' }, 182_000).next;
  assert.equal(r.phase, 'finished');
  r = go(r, 'd', { type: 'REMATCH' }, 182_000).next;
  assert.equal(r.phase, 'playing');
  assert.equal(expOf([{ outcome: 'win', forfeit: false }]), 60);
  assert.equal(expOf([{ outcome: 'draw', forfeit: false }]), 40);
  assert.equal(expOf([{ outcome: 'loss', forfeit: false }]), 20);
  assert.equal(expOf([{ outcome: 'loss', forfeit: true }]), 0);
  assert.equal(
    expOf([
      { outcome: 'draw', forfeit: false },
      { outcome: 'draw', forfeit: false },
    ]),
    60,
  );
});
