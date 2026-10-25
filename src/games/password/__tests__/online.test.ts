import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialOnlineState,
  msLeft,
  myProgress,
  onlineTransition,
  opponentProgress,
  type OnlineEnv,
  type OnlineEvent,
  type OnlineState,
  type SnapshotData,
} from '../engine/onlineMachine';
import type { Effect, TeamRoundResult } from '../engine/types';
import { MI, makeClock, makeTerms } from './helpers';

const clock = makeClock();
const env: OnlineEnv = { terms: makeTerms(), now: clock.now };
const players = [
  { id: 'me', name: 'Me', team: 'A' as const, role: 'giver' as const, connected: true },
  { id: 'mate', name: 'Mate', team: 'A' as const, role: 'guesser' as const, connected: true },
  { id: 'x', name: 'X', team: 'B' as const, role: 'giver' as const, connected: true },
  { id: 'y', name: 'Y', team: 'B' as const, role: 'guesser' as const, connected: true },
];
const snap = (over: Partial<SnapshotData> = {}): SnapshotData => ({
  myTeam: 'A', role: 'giver', round: 0, totalRounds: 2, players, currentTermId: MI.id, clues: [], guesses: [],
  progress: { A: { completed: 0, total: 5 }, B: { completed: 2, total: 5 } }, endsInMs: 180_000, ...over,
});

function feed(s: OnlineState, events: OnlineEvent[]) {
  let state = s;
  const effects: Effect<OnlineEvent>[] = [];
  for (const ev of events) {
    const r = onlineTransition(env, state, ev);
    state = r.state;
    effects.push(...r.effects);
  }
  return { state, effects };
}
const live = (data: Partial<SnapshotData> = {}, id = 'me') =>
  feed(initialOnlineState(id), [{ type: 'S_SNAPSHOT', data: snap(data) }]).state;
const sent = (fx: Effect<OnlineEvent>[]) => fx.filter((f) => f.type === 'SEND').map((f: any) => f.message);
const msgs = (fx: Effect<OnlineEvent>[]) => sent(fx).filter((m) => m.t !== 'ACTIVITY');

test('connecting: nothing works until the snapshot arrives', () => {
  clock.set(0);
  const s = initialOnlineState('me');
  assert.equal(s.ui.name, 'connecting');
  assert.equal(feed(s, [{ type: 'GIVE_CLUE', text: 'pain' }]).state, s);
  const playing = live();
  assert.equal(playing.ui.name, 'playing');
  assert.equal(msLeft(playing, 0), 180_000);
  assert.equal(msLeft(playing, 100_000), 80_000);
});

test('giver: clues are checked locally, sent once, and rejected clues are not sent', () => {
  clock.set(0);
  let r = feed(live(), [{ type: 'GIVE_CLUE', text: 'pain' }]);
  assert.deepEqual(msgs(r.effects), [{ t: 'CLUE', text: 'pain' }]);
  assert.equal(r.state.notice, null);

  for (const [text, reason] of [['heart', 'FORBIDDEN'], ['infarct', 'SAME_ROOT'], ['Myocardial', 'TERM_WORD'], ['chest pain', 'NOT_ONE_WORD'], ['', 'EMPTY']] as const) {
    r = feed(live(), [{ type: 'GIVE_CLUE', text }]);
    assert.equal(r.state.notice, reason, text);
    assert.deepEqual(msgs(r.effects), []); // nothing goes to the server
  }

  // a clue the server accepted cannot be repeated
  r = feed(live(), [{ type: 'S_CLUE_ACCEPTED', text: 'pain' }, { type: 'GIVE_CLUE', text: 'PAIN' }]);
  assert.equal(r.state.notice, 'DUPLICATE');
  assert.deepEqual(r.state.clues, ['pain']);
  assert.equal(feed(live(), [{ type: 'S_CLUE_REJECTED', reason: 'SAME_ROOT' }]).state.notice, 'SAME_ROOT'); // the server has the last word
  assert.equal(feed(r.state, [{ type: 'DISMISS_NOTICE' }]).state.notice, null);
});

test('roles: only the giver gives clues and skips; only the guesser guesses', () => {
  const giver = live();
  const guesser = live({ role: 'guesser', currentTermId: null }, 'mate');
  assert.equal(feed(giver, [{ type: 'PICK_GUESS', termId: 'appy' }]).state.notice, 'NOT_GUESSER');
  assert.deepEqual(msgs(feed(giver, [{ type: 'PICK_GUESS', termId: 'appy' }]).effects), []);
  assert.equal(feed(guesser, [{ type: 'GIVE_CLUE', text: 'pain' }]).state.notice, 'NOT_GIVER');
  assert.equal(feed(guesser, [{ type: 'SKIP' }]).state.notice, 'NOT_GIVER');
  assert.deepEqual(msgs(feed(guesser, [{ type: 'PICK_GUESS', termId: 'appy' }]).effects), [{ t: 'GUESS', termId: 'appy' }]);
  assert.deepEqual(msgs(feed(giver, [{ type: 'SKIP' }]).effects), [{ t: 'SKIP' }]);
});

test('the guesser never holds the secret term, even if the server sent it by mistake', () => {
  const guesser = live({ role: 'guesser', currentTermId: MI.id }, 'mate'); // snapshot carries the term by mistake
  assert.equal(guesser.currentTermId, null);
  const after = feed(guesser, [{ type: 'S_NEW_WORD', termId: MI.id }]).state;
  assert.equal(after.currentTermId, null);
  const giver = feed(live(), [{ type: 'S_NEW_WORD', termId: 'appy' }]).state;
  assert.equal(giver.currentTermId, 'appy');
  assert.deepEqual([giver.clues, giver.guesses], [[], []]); // a new word clears the clue stack
  assert.equal(feed(guesser, [{ type: 'GIVE_CLUE', text: 'pain' }]).state.notice, 'NOT_GIVER');
});

test('wrong guesses are shown and free; progress shows only the other team\'s words completed', () => {
  let s = live();
  s = feed(s, [{ type: 'S_GUESS_WRONG', termId: 'appy' }, { type: 'S_GUESS_WRONG', termId: 'appy' }]).state;
  assert.deepEqual(s.guesses, ['appy']);
  assert.deepEqual(opponentProgress(s), { completed: 2, total: 5 });
  assert.deepEqual(myProgress(s), { completed: 0, total: 5 });

  const mine = feed(s, [{ type: 'S_PROGRESS', teamId: 'A', completed: 1, total: 5 }]);
  assert.ok(mine.effects.some((e) => e.type === 'SOUND' && e.kind === 'ding')); // my team scored
  const theirs = feed(s, [{ type: 'S_PROGRESS', teamId: 'B', completed: 3, total: 5 }]);
  assert.equal(theirs.effects.length, 0);
  assert.equal(opponentProgress(theirs.state)!.completed, 3);
});

test('round end, round break and the next round with swapped roles', () => {
  const results: Record<'A' | 'B', TeamRoundResult> = {
    A: { teamId: 'A', wordsCompleted: 5, clues: 11, timeMs: 100_000 },
    B: { teamId: 'B', wordsCompleted: 4, clues: 8, timeMs: 180_000 },
  };
  let s = feed(live(), [{ type: 'S_CLUE_ACCEPTED', text: 'pain' }, { type: 'S_ROUND_ENDED', round: 0, results }]).state;
  assert.deepEqual(s.ui, { name: 'roundBreak', round: 0, results });
  assert.equal(feed(s, [{ type: 'GIVE_CLUE', text: 'pain' }]).state, s); // nothing during the break

  s = feed(s, [{ type: 'S_ROUND_START', round: 1, role: 'guesser', endsInMs: 180_000, progress: { A: { completed: 0, total: 5 }, B: { completed: 0, total: 5 } } }]).state;
  assert.equal(s.ui.name, 'playing');
  assert.deepEqual([s.role, s.round, s.clues, s.currentTermId], ['guesser', 1, [], null]);
});

test('match end shows the results; rematch needs everyone, then the match restarts', () => {
  const summary: any = { rounds: [], totals: {}, roundWinners: [], winner: 'A' };
  let r = feed(live(), [{ type: 'S_MATCH_ENDED', summary }]);
  assert.deepEqual(r.state.ui, { name: 'results', summary });
  r = feed(r.state, [{ type: 'REMATCH_ACCEPT' }, { type: 'S_REMATCH', accepted: ['me', 'mate'] }]);
  assert.deepEqual(msgs(r.effects), [{ t: 'REMATCH_ACCEPT' }]);
  assert.deepEqual(r.state.rematchAccepted, ['me', 'mate']);
  r = feed(r.state, [{ type: 'S_REMATCH_STARTED' }]);
  assert.equal(r.state.ui.name, 'connecting'); // waits for the new snapshot
  assert.equal(r.state.rematchAccepted.length, 0);
});

test('disconnect: 30 s to rejoin, the snapshot restores play, timeout leaves; quit leaves', () => {
  const lost = feed(live(), [{ type: 'CONNECTION_LOST' }]);
  assert.equal(lost.state.ui.name, 'reconnecting');
  const timer = lost.effects.find((e) => e.type === 'START_TIMER') as any;
  assert.deepEqual([timer.ms, timer.event], [30_000, { type: 'REJOIN_TIMEOUT' }]);
  assert.equal(feed(lost.state, [{ type: 'GIVE_CLUE', text: 'pain' }]).state, lost.state);
  assert.equal(feed(lost.state, [{ type: 'CONNECTION_LOST' }]).state, lost.state);

  const back = feed(lost.state, [{ type: 'S_SNAPSHOT', data: snap({ clues: ['pain'] }) }]);
  assert.equal(back.state.ui.name, 'playing');
  assert.deepEqual(back.state.clues, ['pain']);
  assert.ok(back.effects.some((e) => e.type === 'CANCEL_TIMER'));
  assert.equal(feed(lost.state, [{ type: 'REJOIN_TIMEOUT' }]).state.ui.name, 'left');
  assert.equal(feed(live(), [{ type: 'REJOIN_TIMEOUT' }]).state.ui.name, 'playing'); // stale timer ignored

  const quit = feed(live(), [{ type: 'QUIT' }]);
  assert.equal(quit.state.ui.name, 'left');
  assert.deepEqual(msgs(quit.effects), [{ t: 'QUIT' }]);
});

test('connection and forfeit facts update the screen', () => {
  let s = live();
  s = feed(s, [{ type: 'S_PLAYER_CONNECTION', playerId: 'x', connected: false }, { type: 'S_TEAM_FORFEITED', teamId: 'B' }, { type: 'S_TEAM_FORFEITED', teamId: 'B' }]).state;
  assert.equal(s.players.find((p) => p.id === 'x')!.connected, false);
  assert.deepEqual(s.forfeitedTeams, ['B']);
});

test('activity pings are throttled to one per 10 seconds', () => {
  clock.set(1000);
  let r = feed(live(), [{ type: 'USER_ACTIVITY' }]);
  assert.deepEqual(sent(r.effects), [{ t: 'ACTIVITY' }]);
  clock.advance(4000);
  r = feed(r.state, [{ type: 'USER_ACTIVITY' }]);
  assert.equal(sent(r.effects).length, 0);
  clock.advance(6000);
  r = feed(r.state, [{ type: 'GIVE_CLUE', text: 'pain' }]); // any input counts
  assert.deepEqual(sent(r.effects).map((m) => m.t), ['ACTIVITY', 'CLUE']);
});
