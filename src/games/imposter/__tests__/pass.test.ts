import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { GameState } from '../engine/types';
import { act, holderOf, idOf, roundOutcome, shiftDeadlines, startOfflineGame, tally } from '../offline';
import { mulberry32 } from './helpers';

const seats = [0, 1, 2, 3].map((seat) => ({ seat, name: `P${seat + 1}` }));

test('Pass the phone: a whole round goes from hand to hand, seat 0 holds the phone', () => {
  const rng = mulberry32(7);
  const now = 1_000;
  let s: GameState = startOfflineGame(seats, 'mixed', 2, now, rng);
  const go = (a: Parameters<typeof act>[1]) => {
    const r = act(s, a, now, rng);
    assert.equal(r.error, null, r.error?.code ?? '');
    s = r.state;
  };
  assert.equal(String(s.phase.kind), 'wordReveal');
  assert.equal(s.hostId, idOf(0));
  // Everyone sees their word in seat order.
  for (const x of seats) {
    assert.equal(holderOf(s), idOf(x.seat));
    go({ type: 'ACK_WORD', playerId: idOf(x.seat) });
  }
  assert.equal(String(s.phase.kind), 'offlineTurn');
  go({ type: 'NEXT_TURN', playerId: idOf(0) });
  go({ type: 'NEXT_TURN', playerId: idOf(0) });
  assert.equal(String(s.phase.kind), 'decision');
  for (const x of seats) go({ type: 'DECIDE', playerId: idOf(x.seat), choice: 'vote' });
  assert.equal(String(s.phase.kind), 'offlineDiscussion');
  // A 30 s pause moves the discussion clock on by 30 s.
  const before = (s.phase as { deadline: number }).deadline;
  s = shiftDeadlines(s, 30_000);
  assert.equal((s.phase as { deadline: number }).deadline, before + 30_000);
  go({ type: 'SKIP_DISCUSSION', playerId: idOf(0) });
  assert.equal(String(s.phase.kind), 'vote');
  const imp = s.round!.imposterId;
  const others = s.round!.participants.filter((id) => id !== imp);
  for (const id of s.round!.participants) {
    assert.equal(holderOf(s), id);
    go({ type: 'CAST_VOTE', playerId: id, target: id === imp ? others[0] : imp });
    if (String(s.phase.kind) === 'vote') assert.ok(tally(s)[id === imp ? others[0] : imp] >= 1);
  }
  assert.equal(String(s.phase.kind), 'redemption');
  const confirmer = holderOf(s)!;
  assert.notEqual(confirmer, imp);
  go({ type: 'CONFIRM_GUESS', playerId: confirmer, correct: false });
  assert.equal(s.phase.kind, 'roundResult');
  const sum = s.phase.kind === 'roundResult' ? s.phase.summary : null;
  assert.ok(sum);
  for (const id of others) assert.equal(roundOutcome(sum, id), 'right');
  assert.equal(roundOutcome(sum, imp), 'wrong');
  go({ type: 'NEXT_ROUND', playerId: idOf(0) });
  assert.equal(String(s.phase.kind), 'wordReveal');
  assert.equal(s.round!.index, 1);
});

test('Pass the phone practice: my own pair plays first', () => {
  const rng = mulberry32(3);
  const own = { id: 'c:mine', subtype: 'clinical' as const, category: 'Respiratory', a: { word: 'Asthma', alts: [] }, b: { word: 'COPD', alts: [] } };
  const s: GameState = startOfflineGame(seats, 'basic', 2, 1_000, rng, [own]);
  assert.equal(s.round?.pair.id, 'c:mine');
  assert.ok(s.usedPairIds.includes('c:mine'));
});
