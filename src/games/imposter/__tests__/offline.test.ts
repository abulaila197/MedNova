import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RULES } from '../engine/constants';
import { privateWord } from '../engine/engine';
import { getView } from '../engine/view';
import { Sim } from './helpers';

function startOffline(seed = 30, n = 3, rounds = 1) {
  const sim = new Sim({ mode: 'offline', n, seed });
  sim.must({ type: 'START_MATCH', playerId: 'p1', config: { subtype: 'basic', rounds } });
  return sim;
}
const toDecision = (sim: Sim) => {
  for (const id of sim.round.participants) sim.must({ type: 'ACK_WORD', playerId: id });
  assert.equal((sim.phase as any).kind, 'offlineTurn');
  sim.must({ type: 'NEXT_TURN', playerId: 'p1' });
  assert.equal((sim.phase as any).turn, 2);
  sim.must({ type: 'NEXT_TURN', playerId: 'p1' });
  assert.equal(String(sim.phase.kind), 'decision');
};

test('offline: words are hold-to-view on the device, clues are spoken, the device counts turns', () => {
  const sim = startOffline();
  assert.equal((sim.phase as any).deadline, null);
  assert.equal(sim.act({ type: 'SUBMIT_CLUE', playerId: 'p1', text: 'x' }).error?.code, 'mode');
  assert.equal(getView(sim.state, null).myWord, null); // the shared screen shows no secrets
  for (const id of sim.round.participants) assert.ok(privateWord(sim.state, id)); // hold to view
  toDecision(sim);
  assert.equal((sim.phase as any).deadline, null); // no decision timer offline
});

test('offline: decision, skippable discussion, final votes, device holder confirms the spoken guess', () => {
  const sim = startOffline(31);
  toDecision(sim);
  sim.must({ type: 'DECIDE', playerId: 'p1', choice: 'vote' });
  assert.equal(sim.act({ type: 'DECIDE', playerId: 'p1', choice: 'extra' }).error?.code, 'decide/final');
  sim.must({ type: 'DECIDE', playerId: 'p2', choice: 'vote' });
  assert.equal(String(sim.phase.kind), 'decision');
  sim.must({ type: 'DECIDE', playerId: 'p3', choice: 'extra' });
  assert.equal(String(sim.phase.kind), 'offlineDiscussion');
  assert.equal((sim.phase as any).deadline, sim.now + RULES.offlineDiscussionMs);
  sim.must({ type: 'SKIP_DISCUSSION', playerId: 'p1' });
  assert.equal(String(sim.phase.kind), 'vote');
  assert.equal((sim.phase as any).deadline, null); // no vote timer offline

  const imp = sim.round.imposterId;
  const others = sim.nonImposters();
  sim.advance(10 * 60_000); // nobody is rushed while passing the device around
  assert.equal(String(sim.phase.kind), 'vote');
  sim.must({ type: 'CAST_VOTE', playerId: others[0], target: imp });
  assert.equal(sim.act({ type: 'CAST_VOTE', playerId: others[0], target: others[1] }).error?.code, 'vote/final');
  sim.must({ type: 'CAST_VOTE', playerId: others[1], target: imp });
  sim.must({ type: 'CAST_VOTE', playerId: imp, target: others[0] }); // everybody voted: no countdown offline
  const red: any = sim.phase;
  assert.equal(red.kind, 'redemption');
  const confirmer = imp === 'p1' ? 'p2' : 'p1';
  assert.equal(red.confirmerId, confirmer);
  const stranger = sim.ids().find((i) => i !== confirmer)!;
  assert.equal(sim.act({ type: 'CONFIRM_GUESS', playerId: stranger, correct: true }).error?.code, 'guess/notConfirmer');
  assert.equal(sim.act({ type: 'SUBMIT_GUESS', playerId: imp, text: 'x' }).error?.code, 'mode');
  sim.must({ type: 'CONFIRM_GUESS', playerId: confirmer, correct: true });
  const s = (sim.phase as any).summary;
  assert.equal(s.outcome, 'caught');
  for (const id of others) assert.equal(sim.score(id), 2);
  assert.equal(sim.score(imp), 1);
  assert.equal((sim.phase as any).deadline, null); // continue by hand offline
  sim.must({ type: 'NEXT_ROUND', playerId: 'p2' });
  assert.equal(String(sim.phase.kind), 'matchEnd');
});

test('offline: if the host holds the imposter role, the next player clockwise confirms', () => {
  const sim = startOffline(32);
  (sim.state.round as any).imposterId = 'p1';
  toDecision(sim);
  for (const id of ['p1', 'p2', 'p3']) sim.must({ type: 'DECIDE', playerId: id, choice: 'vote' });
  sim.must({ type: 'SKIP_DISCUSSION', playerId: 'p1' });
  sim.must({ type: 'CAST_VOTE', playerId: 'p2', target: 'p1' });
  sim.must({ type: 'CAST_VOTE', playerId: 'p3', target: 'p1' });
  sim.must({ type: 'CAST_VOTE', playerId: 'p1', target: 'p2' });
  assert.equal((sim.phase as any).confirmerId, 'p2');
});

test('offline: a unanimous "one more turn" gives turn 3, then the discussion and the vote', () => {
  const sim = startOffline(33);
  toDecision(sim);
  for (const id of ['p1', 'p2', 'p3']) sim.must({ type: 'DECIDE', playerId: id, choice: 'extra' });
  assert.equal((sim.phase as any).turn, 3);
  sim.must({ type: 'NEXT_TURN', playerId: 'p1' });
  assert.equal(String(sim.phase.kind), 'offlineDiscussion'); // forced vote, no second decision
  sim.advance(RULES.offlineDiscussionMs);
  assert.equal(String(sim.phase.kind), 'vote');
});

test('offline: the redemption still has a 20 s limit; online-only actions are refused', () => {
  const sim = startOffline(34);
  toDecision(sim);
  for (const id of ['p1', 'p2', 'p3']) sim.must({ type: 'DECIDE', playerId: id, choice: 'vote' });
  sim.must({ type: 'SKIP_DISCUSSION', playerId: 'p1' });
  const imp = sim.round.imposterId;
  for (const id of sim.nonImposters()) sim.must({ type: 'CAST_VOTE', playerId: id, target: imp });
  sim.must({ type: 'CAST_VOTE', playerId: imp, target: sim.nonImposters()[0] });
  sim.advance(RULES.redemptionMs);
  assert.equal((sim.phase as any).summary.redemptionCorrect, false);
  assert.equal(sim.act({ type: 'PLAYER_DISCONNECTED', playerId: 'p2' }).error?.code, 'mode');
});
