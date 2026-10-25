import assert from 'node:assert/strict';
import { test } from 'node:test';
import termsJson from '../data/terms.json';
import { seededRng } from '../engine/random';
import type { Term } from '../engine/types';
import { expOf, onlineRanks, scoresOf, startOnlineRoom, stepOnline, viewsOf, type Move, type Room } from '../online';

const TERMS = termsJson as Term[];
const SEATS = ['a', 'b', 'c', 'd'];
const T0 = 5_000_000;

class Sim {
  r: Room;
  now = T0;
  rng = seededRng(4);
  dropped: string[] = [];
  constructor(seats = SEATS) {
    this.r = startOnlineRoom({ host: 'a', seats, names: Object.fromEntries(seats.map((s) => [s, s.toUpperCase()])), style: 'mixed' });
  }
  go(me: string, m: Move) {
    const res = stepOnline(TERMS, this.r, me, m, this.dropped, this.now, this.rng);
    this.r = res.next;
    return res.refused;
  }
  must(me: string, m: Move) {
    const e = this.go(me, m);
    assert.equal(e, null, JSON.stringify(e));
  }
  teams() {
    this.must('a', { type: 'SET_TEAM', team: 'red' });
    this.must('b', { type: 'SET_TEAM', team: 'red' });
    this.must('c', { type: 'SET_TEAM', team: 'blue' });
    this.must('d', { type: 'SET_TEAM', team: 'blue' });
  }
  get g() {
    return this.r.game!;
  }
  /** Spymaster and a guesser of the team on turn. */
  turnPair() {
    const ids = SEATS.filter((id) => this.r.players[id].team === this.g.turn);
    const spy = ids.find((id) => this.r.players[id].isSpymaster)!;
    return { spy, guess: ids.find((id) => id !== spy)! };
  }
}

test('lobby: teams, a full team, spymaster claims, only the host starts, and the start needs 2 a team', () => {
  const s = new Sim();
  s.must('a', { type: 'SET_TEAM', team: 'red' });
  s.must('b', { type: 'SET_TEAM', team: 'red' });
  s.must('c', { type: 'SET_TEAM', team: 'red' });
  assert.equal(s.go('d', { type: 'SET_TEAM', team: 'red' })?.code, 'TEAM_FULL');
  assert.equal(s.go('a', { type: 'START' })?.code, 'NOT_READY');
  s.must('c', { type: 'SET_TEAM', team: 'blue' });
  s.must('d', { type: 'SET_TEAM', team: 'blue' });
  s.must('b', { type: 'CLAIM_SPYMASTER' });
  assert.equal(s.go('a', { type: 'CLAIM_SPYMASTER' })?.code, 'SPYMASTER_TAKEN');
  assert.equal(s.go('b', { type: 'START' })?.code, 'NOT_HOST');
  s.must('a', { type: 'START' });
  assert.equal(s.r.phase, 'playing');
  assert.ok(s.r.players.b.isSpymaster);
  // Blue had none: one was picked at the start.
  assert.equal(['c', 'd'].filter((id) => s.r.players[id].isSpymaster).length, 1);
});

test('the key reaches only the two spymasters; guessers see colours only of turned cards', () => {
  const s = new Sim();
  s.teams();
  s.must('a', { type: 'START' });
  const v = viewsOf(s.r);
  const spies = SEATS.filter((id) => s.r.players[id].isSpymaster);
  for (const id of SEATS) assert.equal(!!v[id].key, spies.includes(id));
  assert.equal(v.watch.key, null);
  for (const id of SEATS) assert.ok(v[id].game!.cards.every((c) => c.color === null));
  assert.equal(v[spies[0]].key!.filter((c) => c === 'assassin').length, 1);
});

test('a turn: typed clue checked against the board, mark then confirm, own card keeps going, wrong card ends it', () => {
  const s = new Sim();
  s.teams();
  s.must('a', { type: 'START' });
  const { spy, guess } = s.turnPair();
  const board = s.g.cards[0].term;
  assert.equal(s.go(spy, { type: 'CLUE', word: board, number: 2 })?.code, 'CLUE_REJECTED');
  assert.equal(s.go(guess, { type: 'CLUE', word: 'zzq', number: 2 })?.code, 'NOT_SPYMASTER');
  s.must(spy, { type: 'CLUE', word: 'zzq', number: 2 });
  assert.equal(s.g.phase, 'guess');
  const team = s.g.turn;
  const mine = s.g.cards.find((c) => c.color === team)!.index;
  assert.equal(s.go(guess, { type: 'CONFIRM', cardIndex: mine })?.code, 'MARK_FIRST');
  assert.equal(s.go(spy, { type: 'MARK', cardIndex: mine })?.code, 'NOT_GUESSER');
  s.must(guess, { type: 'MARK', cardIndex: mine });
  assert.equal(viewsOf(s.r).c.game!.marker, mine);
  s.must(guess, { type: 'CONFIRM', cardIndex: mine });
  assert.equal(s.g.turn, team);
  const neutral = s.g.cards.find((c) => c.color === 'neutral')!.index;
  s.must(guess, { type: 'MARK', cardIndex: neutral });
  s.must(guess, { type: 'CONFIRM', cardIndex: neutral });
  assert.notEqual(s.g.turn, team);
  assert.equal(s.r.marker, null);
});

test('the clock: a TICK after the clue time passes the turn', () => {
  const s = new Sim();
  s.teams();
  s.must('a', { type: 'START' });
  const team = s.g.turn;
  s.now += 61_000;
  s.must('c', { type: 'TICK' });
  assert.notEqual(s.g.turn, team);
  assert.equal(s.g.phase, 'clue');
});

test('the deadly card ends the game; scores, ranks, rematch rotates spymasters, then the host ends the match', () => {
  const s = new Sim();
  s.teams();
  s.must('a', { type: 'START' });
  const before = SEATS.filter((id) => s.r.players[id].isSpymaster);
  const { spy, guess } = s.turnPair();
  const loser = s.g.turn;
  s.must(spy, { type: 'CLUE', word: 'zzq', number: 1 });
  const dead = s.g.cards.find((c) => c.color === 'assassin')!.index;
  s.must(guess, { type: 'MARK', cardIndex: dead });
  s.must(guess, { type: 'CONFIRM', cardIndex: dead });
  assert.equal(s.r.phase, 'finished');
  assert.equal(s.r.played.length, 1);
  assert.notEqual(s.r.played[0].winner, loser);
  assert.equal(viewsOf(s.r).a.key, null);
  assert.ok(viewsOf(s.r).a.game!.cards.every((c) => c.color));
  const sc = scoresOf(s.r, SEATS);
  assert.deepEqual(sc.map((x) => x), SEATS.map((id) => (s.r.players[id].team === loser ? 0 : 1)));
  assert.deepEqual(onlineRanks(s.r, SEATS), SEATS.map((id) => (s.r.players[id].team === loser ? 3 : 1)));
  s.must('a', { type: 'REMATCH' });
  const after = SEATS.filter((id) => s.r.players[id].isSpymaster);
  assert.equal(after.length, 2);
  assert.notDeepEqual(after, before);
  assert.equal(s.go('a', { type: 'FINISH' })?.code, 'NOT_OVER');
  s.r = { ...s.r, phase: 'finished' };
  assert.equal(s.go('b', { type: 'FINISH' })?.code, 'NOT_HOST');
  s.must('a', { type: 'FINISH' });
  assert.equal(s.r.ended, true);
});

test('drop-outs: a spymaster who leaves is replaced by a teammate who gets the key; a team with nobody left forfeits', () => {
  const s = new Sim();
  s.teams();
  s.must('a', { type: 'START' });
  const redSpy = ['a', 'b'].find((id) => s.r.players[id].isSpymaster)!;
  const other = redSpy === 'a' ? 'b' : 'a';
  s.dropped = [redSpy];
  s.must('c', { type: 'TICK' });
  assert.ok(s.r.players[other].isSpymaster);
  assert.ok(viewsOf(s.r)[other].key);
  assert.equal(s.r.phase, 'playing');
  s.dropped = [redSpy, other];
  s.must('c', { type: 'TICK' });
  assert.equal(s.r.phase, 'finished');
  assert.equal(s.r.played[0].winner, 'blue');
  assert.equal(s.r.played[0].reason, 'forfeit');
  assert.equal(s.go(other, { type: 'TICK' }), null);
  assert.equal(s.go(other, { type: 'FINISH' })?.code, 'LEFT_GAME');
});

test('nothing changes gives back the same object (no needless save)', () => {
  const s = new Sim();
  const r0 = s.r;
  assert.equal(stepOnline(TERMS, r0, 'b', { type: 'TICK' }, [], T0).next, r0);
});

test('EXP: winners 60, losers 20 a game, at most 60 a match', () => {
  assert.equal(expOf(1, 1), 60);
  assert.equal(expOf(1, 0), 20);
  assert.equal(expOf(2, 0), 40);
  assert.equal(expOf(3, 0), 60);
  assert.equal(expOf(3, 2), 60);
});
