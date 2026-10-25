import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGame } from '../engine/engine';
import { applyAction, GameRoom, type RoomStore } from '../engine/room';
import type { GameState } from '../engine/types';
import { bank, mulberry32, profanity } from './helpers';

const deps = (clock: () => number) => ({ bank, profanity, rng: mulberry32(40), clock });

function lobby(mode: 'online' | 'offline' = 'online', n = 3): GameState {
  const s = createGame({ roomId: 'r1', mode, host: { id: 'p1', name: 'P1' } });
  for (let i = 2; i <= n; i++) s.players.push({ id: `p${i}`, name: `P${i}`, connected: true, score: 0, credits: 0, profanityAttempts: 0 });
  return s;
}

test('GameRoom: the action player must be the authenticated user', () => {
  let now = 5_000;
  const room = new GameRoom(lobby(), deps(() => now));
  const bad = room.dispatch({ type: 'START_MATCH', playerId: 'p1', config: { subtype: 'basic', rounds: 1 } }, 'p2');
  assert.equal(bad.error?.code, 'auth/mismatch');
  assert.equal(String(room.state.phase.kind), 'lobby');
  const ok = room.dispatch({ type: 'START_MATCH', playerId: 'p1', config: { subtype: 'basic', rounds: 1 } }, 'p1');
  assert.equal(ok.error, null);
  assert.equal(String(room.state.phase.kind), 'wordReveal');
  assert.equal(room.nextDeadline(), now + 10_000);
  now += 10_000;
  room.tick();
  assert.equal(String(room.state.phase.kind), 'clue');
  assert.ok(room.viewFor('p2').myWord);
});

test('applyAction: serverless style load, apply, save with a version check and retry', async () => {
  let row = { state: lobby(), version: 1 };
  let conflictOnce = true;
  const store: RoomStore = {
    async load() { return { state: JSON.parse(JSON.stringify(row.state)), version: row.version }; },
    async save(_id, state, expected) {
      if (conflictOnce) { conflictOnce = false; row = { ...row, version: row.version + 1 }; return false; } // someone else wrote first
      if (expected !== row.version) return false;
      row = { state, version: row.version + 1 };
      return true;
    },
  };
  const res = await applyAction(store, deps(() => 1_000), 'r1', 'p1', { type: 'START_MATCH', playerId: 'p1', config: { subtype: 'basic', rounds: 1 } });
  assert.equal(res.error, null);
  assert.equal(row.state.phase.kind, 'wordReveal');
  assert.equal(row.version, 3);
  const mismatch = await applyAction(store, deps(() => 1_000), 'r1', 'p2', { type: 'ACK_WORD', playerId: 'p3' });
  assert.equal(mismatch.error?.code, 'auth/mismatch');
});

test('GameRoom offline: the same engine runs on the phone, with no secrets on the shared screen', () => {
  const now = 1_000;
  const room = new GameRoom(lobby('offline'), deps(() => now));
  assert.equal(room.dispatch({ type: 'START_MATCH', playerId: 'p1', config: { subtype: 'basic', rounds: 1 } }).error, null);
  assert.equal(String(room.state.phase.kind), 'wordReveal');
  assert.equal(room.viewFor(null).myWord, null);
  assert.equal(room.nextDeadline(), null); // offline waits for everyone to see their word
});
