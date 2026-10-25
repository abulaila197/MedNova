import test from 'node:test';
import assert from 'node:assert/strict';
import {
  currentTermId,
  initialOfflineState,
  offlineTransition,
  rolesFor,
  type OfflineEnv,
  type OfflineEvent,
  type OfflineState,
} from '../engine/offlineMachine';
import type { Effect } from '../engine/types';
import { makeClock, makeTerms, seqRng } from './helpers';

const clock = makeClock();
const terms = makeTerms();
const env = (rng = seqRng()): OfflineEnv => ({ terms, rng, now: clock.now });

function feed(e: OfflineEnv, s: OfflineState, events: OfflineEvent[]) {
  let state = s;
  const effects: Effect<OfflineEvent>[] = [];
  for (const ev of events) {
    const r = offlineTransition(e, state, ev);
    state = r.state;
    effects.push(...r.effects);
  }
  return { state, effects };
}
const NAMES = ['Ann', 'Ben', 'Cy', 'Di'];
const ready = (e = env(), settings: any = {}) =>
  feed(e, initialOfflineState(), [{ type: 'SET_PLAYERS', names: NAMES }, { type: 'SET_SETTINGS', settings }]).state;
const begin = (e = env(), settings: any = {}) => feed(e, ready(e, settings), [{ type: 'START_MATCH' }]).state;
const other = (t: 'A' | 'B') => (t === 'A' ? 'B' : 'A');

/** Plays a whole turn: `clues` clues per word then Correct. */
function playTurn(e: OfflineEnv, s: OfflineState, clues: number, ms = 60_000, withSkip = false) {
  let r = feed(e, s, [{ type: 'START_TURN' }]);
  const words = r.state.turn!.tr.queue.length;
  const events: OfflineEvent[] = [];
  if (withSkip) events.push({ type: 'CLUE_PLUS' }, { type: 'SKIP' });
  for (let i = 0; i < words; i++) {
    for (let c = 0; c < clues; c++) events.push({ type: 'CLUE_PLUS' });
    events.push({ type: 'CORRECT' });
  }
  clock.advance(ms);
  r = feed(e, r.state, events);
  return r;
}

test('setup: 4 unique names, teams 2 + 2, givers, settings', () => {
  const e = env();
  for (const names of [['A', 'B', 'C'], ['A', 'B', 'C', 'D', 'E'], ['A', 'b', 'C', 'B'], ['A', 'B', 'C', ' ']]) {
    const s = feed(e, initialOfflineState(), [{ type: 'SET_PLAYERS', names }]).state;
    assert.deepEqual(s.ui, { name: 'setup', notice: 'INVALID_PLAYERS' });
  }
  let s = ready(e);
  assert.deepEqual(s.setup.players.map((p) => p.team), ['A', 'A', 'B', 'B']);
  assert.deepEqual(s.setup.givers, { A: 'p1', B: 'p3' });

  // teams must stay 2 + 2
  assert.equal(feed(e, s, [{ type: 'ASSIGN_TEAMS', teams: { p1: 'A', p2: 'A', p3: 'A', p4: 'B' } }]).state.ui.name, 'setup');
  assert.deepEqual((feed(e, s, [{ type: 'ASSIGN_TEAMS', teams: { p1: 'A', p2: 'A', p3: 'A', p4: 'B' } }]).state.ui as any).notice, 'TEAMS_NOT_2_AND_2');
  s = feed(e, s, [{ type: 'ASSIGN_TEAMS', teams: { p1: 'A', p3: 'A', p2: 'B', p4: 'B' } }]).state;
  assert.deepEqual(s.setup.players.map((p) => p.team), ['A', 'B', 'A', 'B']);
  assert.deepEqual(s.setup.givers, { A: 'p1', B: 'p2' }); // givers follow the new teams

  s = feed(e, s, [{ type: 'RANDOMIZE_TEAMS' }]).state;
  assert.equal(s.setup.players.filter((p) => p.team === 'A').length, 2);
  s = feed(e, s, [{ type: 'SET_GIVER', team: 'A', playerId: s.setup.players.filter((p) => p.team === 'A')[1].id }]).state;
  assert.equal(s.setup.givers.A, s.setup.players.filter((p) => p.team === 'A')[1].id);
  const wrongTeam = feed(e, s, [{ type: 'SET_GIVER', team: 'A', playerId: s.setup.players.find((p) => p.team === 'B')!.id }]).state;
  assert.equal(wrongTeam.setup.givers.A, s.setup.givers.A); // a giver must be on the team

  s = feed(e, s, [{ type: 'SET_SETTINGS', settings: { bank: 'basic', wordsPerTeam: 10, rounds: 2 } }]).state;
  assert.deepEqual(s.setup.settings, { bank: 'basic', wordsPerTeam: 10, rounds: 2 });
  assert.deepEqual(feed(e, s, [{ type: 'SET_SETTINGS', settings: { wordsPerTeam: 7 as any } }]).state.setup.settings, s.setup.settings);
  assert.equal(feed(e, initialOfflineState(), [{ type: 'START_MATCH' }]).state.ui.name, 'setup'); // no players yet
  assert.deepEqual((feed(e, initialOfflineState(), [{ type: 'START_MATCH' }]).state.ui as any).notice, 'INVALID_PLAYERS');
});

test('not enough terms in the chosen bank blocks the start', () => {
  const small: OfflineEnv = { terms: makeTerms(3, 2), rng: seqRng(), now: clock.now };
  const s = feed(small, initialOfflineState(), [
    { type: 'SET_PLAYERS', names: NAMES },
    { type: 'SET_SETTINGS', settings: { bank: 'basic' } },
    { type: 'START_MATCH' },
  ]).state;
  assert.deepEqual(s.ui, { name: 'setup', notice: 'NOT_ENOUGH_TERMS' });
});

test('the app picks the first team at random; each team has its own words', () => {
  const firsts = new Set<string>();
  for (const v of [0.1, 0.9, 0.2, 0.8, 0.6, 0.3]) {
    const s = begin(env(() => v));
    assert.equal(s.ui.name, 'turnIntro');
    firsts.add((s.ui as any).team);
  }
  assert.deepEqual([...firsts].sort(), ['A', 'B']); // both can come up
  const s = begin();
  const [r1] = s.plan!;
  assert.equal(r1.lists.A.length, 5);
  assert.equal(r1.lists.B.length, 5);
  assert.equal(r1.lists.A.some((id) => r1.lists.B.includes(id)), false); // different words per team
});

test('a full round: giver counts clues, correct moves on, results by words then clues then time', () => {
  clock.set(0);
  const e = env();
  let s = begin(e);
  const first = (s.ui as any).team as 'A' | 'B';
  const second = other(first);

  // the first team: 2 clues per word
  let r = playTurn(e, s, 2, 60_000);
  assert.equal(r.state.ui.name, 'turnEnd');
  assert.deepEqual((r.state.ui as any).result, { teamId: first, wordsCompleted: 5, clues: 10, timeMs: 60_000 });
  assert.equal((r.state.ui as any).reason, 'finished');
  assert.ok(r.effects.some((x) => x.type === 'CANCEL_TICKER'));

  // the other team plays next: 1 clue per word plus a skip (the clue before the skip still counts)
  s = feed(e, r.state, [{ type: 'NEXT' }]).state;
  assert.deepEqual(s.ui, { name: 'turnIntro', round: 0, team: second });
  r = playTurn(e, s, 1, 90_000, true);
  assert.deepEqual((r.state.ui as any).result, { teamId: second, wordsCompleted: 5, clues: 6, timeMs: 90_000 });

  s = feed(e, r.state, [{ type: 'NEXT' }]).state;
  assert.equal(s.ui.name, 'roundSummary');
  s = feed(e, s, [{ type: 'NEXT' }]).state;
  assert.equal(s.ui.name, 'results');
  assert.equal((s.ui as any).summary.winner, second); // same words, fewer clues
  assert.equal((s.ui as any).summary.roundWinners.length, 1);
});

test('giver screen rules: one word at a time, not correct is free, skip keeps clues, undo, last word cannot be skipped', () => {
  clock.set(0);
  const e = env();
  let s = feed(e, begin(e), [{ type: 'START_TURN' }]).state;
  const word1 = currentTermId(s);
  const queue = s.turn!.tr.queue.slice();

  s = feed(e, s, [{ type: 'CLUE_PLUS' }, { type: 'CLUE_PLUS' }]).state;
  const wrong = feed(e, s, [{ type: 'NOT_CORRECT' }]);
  assert.equal(wrong.state.turn!.tr.words[word1!].count, 2); // costs nothing, the word stays
  assert.equal(currentTermId(wrong.state), word1);
  assert.ok(wrong.effects.some((x) => x.type === 'SOUND' && x.kind === 'buzzer'));

  s = feed(e, s, [{ type: 'CLUE_MINUS' }]).state;
  assert.equal(s.turn!.tr.words[word1!].count, 1);
  s = feed(e, s, [{ type: 'SKIP' }]).state;
  assert.deepEqual(s.turn!.tr.queue, [...queue.slice(1), queue[0]]);
  assert.notEqual(currentTermId(s), word1); // the next word appears
  assert.equal(s.turn!.tr.words[word1!].count, 1); // clue stays counted

  // down to one word: skip does nothing
  for (let i = 0; i < 4; i++) s = feed(e, s, [{ type: 'CORRECT' }]).state;
  assert.equal(s.turn!.tr.queue.length, 1);
  assert.equal(feed(e, s, [{ type: 'SKIP' }]).state.turn!.tr.queue.length, 1);
});

test('3-minute cap: time up ends the turn, a late tap does not count, unfinished clues still count', () => {
  clock.set(0);
  const e = env();
  let s = feed(e, begin(e), [{ type: 'START_TURN' }, { type: 'CLUE_PLUS' }, { type: 'CORRECT' }, { type: 'CLUE_PLUS' }, { type: 'CLUE_PLUS' }]).state;
  clock.advance(179_000);
  s = feed(e, s, [{ type: 'TICK' }]).state;
  assert.equal(s.ui.name, 'playing');
  clock.advance(2_000);
  const r = feed(e, s, [{ type: 'TICK' }]);
  assert.equal(r.state.ui.name, 'turnEnd');
  assert.deepEqual((r.state.ui as any).result, { teamId: (r.state.ui as any).team, wordsCompleted: 1, clues: 3, timeMs: 180_000 });
  assert.equal((r.state.ui as any).reason, 'timeUp');
  assert.ok(r.effects.some((x) => x.type === 'HAPTIC' && x.kind === 'buzzer'));

  // a tap after 3:00 ends the turn instead of counting
  clock.set(0);
  let late = feed(e, begin(e), [{ type: 'START_TURN' }]).state;
  clock.advance(180_001);
  late = feed(e, late, [{ type: 'CORRECT' }]).state;
  assert.equal((late.ui as any).result.wordsCompleted, 0);
  assert.equal((late.ui as any).reason, 'timeUp');
});

test('the clock pauses while the app is in the background', () => {
  clock.set(0);
  const e = env();
  let s = feed(e, begin(e), [{ type: 'START_TURN' }]).state;
  clock.advance(100_000);
  s = feed(e, s, [{ type: 'APP_BACKGROUND' }]).state;
  clock.advance(600_000);
  s = feed(e, s, [{ type: 'APP_FOREGROUND' }]).state;
  clock.advance(50_000);
  s = feed(e, s, [{ type: 'TICK' }]).state;
  assert.equal(s.ui.name, 'playing'); // 150 s of play, not 750
  clock.advance(31_000);
  assert.equal(feed(e, s, [{ type: 'TICK' }]).state.ui.name, 'turnEnd');
});

test('the ticker starts with a turn and stops when it ends', () => {
  clock.set(0);
  const e = env();
  const start = feed(e, begin(e), [{ type: 'START_TURN' }]);
  assert.deepEqual(start.effects, [{ type: 'START_TICKER', id: 'clock', ms: 1000, event: { type: 'TICK' } }]);
  const exit = feed(e, start.state, [{ type: 'EXIT' }]);
  assert.equal(exit.state.ui.name, 'exited');
  assert.deepEqual(exit.effects.map((x) => x.type), ['CANCEL_TICKER', 'NAVIGATE']);
});

test('two rounds: new words, roles swap, the other team starts, totals add up, rematch returns to setup', () => {
  clock.set(0);
  const e = env();
  let s = begin(e, { rounds: 2 });
  const first1 = (s.ui as any).team as 'A' | 'B';
  const giver1 = rolesFor(s.setup, first1, 0).giverId;

  // round 1
  let r = playTurn(e, s, 1, 40_000);
  s = feed(e, r.state, [{ type: 'NEXT' }]).state;
  r = playTurn(e, s, 2, 50_000);
  s = feed(e, r.state, [{ type: 'NEXT' }, { type: 'NEXT' }]).state;

  // round 2: the team that went second goes first; roles swap
  assert.deepEqual(s.ui, { name: 'turnIntro', round: 1, team: other(first1) });
  const roles2 = rolesFor(s.setup, first1, 1);
  assert.equal(roles2.guesserId, giver1); // the former giver is now the guesser
  const words1 = new Set([...s.plan![0].lists.A, ...s.plan![0].lists.B]);
  assert.equal([...s.plan![1].lists.A, ...s.plan![1].lists.B].some((id) => words1.has(id)), false); // new words

  r = playTurn(e, s, 1, 30_000);
  assert.equal((r.state.turn as any).team, other(first1));
  assert.equal(r.state.turn!.giverId, rolesFor(s.setup, other(first1), 1).giverId);
  s = feed(e, r.state, [{ type: 'NEXT' }]).state;
  r = playTurn(e, s, 1, 35_000);
  s = feed(e, r.state, [{ type: 'NEXT' }, { type: 'NEXT' }]).state;

  assert.equal(s.ui.name, 'results');
  const summary = (s.ui as any).summary;
  assert.equal(summary.rounds.length, 2);
  assert.equal(summary.totals.A.wordsCompleted, 10);
  // 5 words per team and round: 1, 2, 1 and 1 clue per word
  const round1 = summary.rounds[0];
  const round2 = summary.rounds[1];
  assert.equal(summary.totals.A.clues, round1.A.clues + round2.A.clues);
  assert.equal(summary.totals.B.timeMs, round1.B.timeMs + round2.B.timeMs);

  // rematch needs all 4 players; then back to setup with the same names
  s = feed(e, s, [{ type: 'REMATCH_ACCEPT', playerId: 'p1' }, { type: 'REMATCH_ACCEPT', playerId: 'p1' }, { type: 'REMATCH_ACCEPT', playerId: 'zzz' }, { type: 'REMATCH_ACCEPT', playerId: 'p2' }, { type: 'REMATCH_ACCEPT', playerId: 'p3' }]).state;
  assert.equal(s.ui.name, 'results'); // 3 of 4 so far
  s = feed(e, s, [{ type: 'REMATCH_ACCEPT', playerId: 'p4' }]).state;
  assert.deepEqual(s.ui, { name: 'setup', notice: null });
  assert.deepEqual(s.setup.players.map((p) => p.name), NAMES);
  assert.equal(s.plan, null);
  s = feed(e, s, [{ type: 'START_MATCH' }]).state; // new words are drawn on start
  assert.equal(s.ui.name, 'turnIntro');
});
