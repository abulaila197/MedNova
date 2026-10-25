import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RULES } from '../engine/constants';
import { onlineRanks, scoresOf, startOnlineGame, stepOnline, viewsOf, dueOf, type Move, type Saved } from '../online';
import { packBank, unpackBank } from '../bankCodec';
import { BANK } from '../offline';
import { mulberry32 } from './helpers';

const seats = ['u-a', 'u-b', 'u-c', 'u-d'];
const names = { 'u-a': 'Ann', 'u-b': 'Ben', 'u-c': 'Cat', 'u-d': 'Dan' };

function setup(rounds = 1) {
  const rng = mulberry32(11);
  let now = 5_000;
  let saved: Saved = { g: startOnlineGame({ bank: BANK, roomId: 'r', host: 'u-b', seats, names, style: 'mixed', rounds, now, rng }), alerts: [] };
  const go = (me: string, move: Move, dropped: string[] = []) => {
    const r = stepOnline(BANK, saved, me, move, dropped, now, rng);
    saved = r.next;
    return r;
  };
  const wait = (ms: number) => {
    now += ms;
    go(seats[0], { type: 'TICK' });
  };
  return { get s() { return saved; }, go, wait, get now() { return now; } };
}

test('Online: the host is the room host, every player is the signed-in user, and words stay on their own phone', () => {
  const t = setup();
  const g = t.s.g;
  assert.equal(g.hostId, 'u-b');
  assert.deepEqual(new Set(g.players.map((p) => p.id)), new Set(seats));
  assert.equal(String(g.phase.kind), 'wordReveal');
  const views = viewsOf(t.s, t.now);
  const imp = g.round!.imposterId;
  for (const id of seats) {
    assert.ok(views[id].myWord);
    // Nothing in another player's view names the imposter or carries the other word.
    const other = g.round!.pair[id === imp ? (g.round!.imposterSide === 'a' ? 'b' : 'a') : g.round!.imposterSide].word;
    assert.ok(!JSON.stringify(views[id]).includes(`"${other}"`), `${id} must not see ${other}`);
    assert.ok(!JSON.stringify(views[id]).includes('imposterId'));
  }
  assert.equal(views.watch.myWord, null);
  assert.equal(dueOf(t.s), t.now + RULES.wordRevealMs);
});

test('Online: a full round, clues typed, votes, the caught imposter types a guess', () => {
  const t = setup(2);
  t.wait(RULES.wordRevealMs);
  let i = 0;
  // Two turns of clues; a clue sent out of turn is refused and changes nothing.
  while (t.s.g.phase.kind === 'clue') {
    const ph = t.s.g.phase;
    const typer = t.s.g.round!.order[ph.slot];
    const other = seats.find((x) => x !== typer)!;
    const bad = t.go(other, { type: 'SUBMIT_CLUE', text: 'zebra' });
    assert.equal(bad.refused?.code, 'clue/notYourTurn');
    const r = t.go(typer, { type: 'SUBMIT_CLUE', text: `clue${'abcdefghij'[i++]}` });
    assert.equal(r.refused, null);
    t.wait(RULES.pauseMs);
  }
  assert.equal(String(t.s.g.phase.kind), 'decision');
  for (const id of seats) t.go(id, { type: 'DECIDE', choice: 'vote' });
  assert.equal(String(t.s.g.phase.kind), 'vote');
  const imp = t.s.g.round!.imposterId;
  const crew = seats.filter((x) => x !== imp);
  for (const id of crew) t.go(id, { type: 'CAST_VOTE', target: imp });
  t.go(imp, { type: 'CAST_VOTE', target: crew[0] });
  // Everyone voted: a 5 s countdown, then the vote closes.
  t.wait(RULES.voteCountdownMs);
  assert.equal(String(t.s.g.phase.kind), 'redemption');
  const v = viewsOf(t.s, t.now);
  assert.equal(v[crew[0]].caught, imp);
  assert.equal(t.go(crew[0], { type: 'SUBMIT_GUESS', text: 'x' }).refused?.code, 'guess/notImposter');
  const word = t.s.g.round!.pair[t.s.g.round!.imposterSide === 'a' ? 'b' : 'a'].word;
  t.go(imp, { type: 'SUBMIT_GUESS', text: word });
  assert.equal(String(t.s.g.phase.kind), 'roundResult');
  const sum = t.s.g.history[0];
  assert.equal(sum.redemptionCorrect, true);
  assert.equal(sum.deltas[imp], RULES.points.redemptionSuccess);
  for (const id of crew) assert.equal(sum.deltas[id], RULES.points.correctVoter);
  // Only the host moves on early.
  assert.equal(t.go('u-a', { type: 'NEXT_ROUND' }).refused?.code, 'next/notHost');
  t.go('u-b', { type: 'NEXT_ROUND' });
  assert.equal(String(t.s.g.phase.kind), 'wordReveal');
  assert.deepEqual(scoresOf(t.s.g, seats), seats.map((id) => t.s.g.players.find((p) => p.id === id)!.score));
});

test('Online: a dropped player leaves; under 3 players the match ends, with places for everyone', () => {
  const t = setup(3);
  const imp = t.s.g.round!.imposterId;
  const crew = seats.filter((x) => x !== imp);
  // The imposter dropping ends the round: everyone else scores 2.
  t.go(crew[0], { type: 'TICK' }, [imp]);
  assert.equal(String(t.s.g.phase.kind), 'roundResult');
  assert.equal(t.s.g.history[0].outcome, 'imposter-disconnected');
  t.go(crew[0], { type: 'TICK' }, [imp, crew[1]]);
  assert.equal(String(t.s.g.phase.kind), 'matchEnd');
  const ranks = onlineRanks(t.s.g, seats);
  assert.equal(ranks[seats.indexOf(imp)], 4);
  assert.ok(ranks.filter((r) => r === 1).length >= 1);
});

test('Online: three blocked clues tell the host, on the host’s view only', () => {
  const t = setup();
  t.wait(RULES.wordRevealMs);
  const ph = t.s.g.phase;
  assert.equal(ph.kind, 'clue');
  let typer = t.s.g.round!.order[ph.kind === 'clue' ? ph.slot : 0];
  if (typer === 'u-b') {
    t.go(typer, { type: 'SUBMIT_CLUE', text: 'fine' });
    t.wait(RULES.pauseMs);
    const p2 = t.s.g.phase;
    typer = t.s.g.round!.order[p2.kind === 'clue' ? p2.slot : 0];
  }
  for (let k = 0; k < 3; k++) assert.equal(t.go(typer, { type: 'SUBMIT_CLUE', text: 'fuck' }).refused?.code, 'clue/profanity');
  const v = viewsOf(t.s, t.now);
  assert.equal(v['u-b'].alerts.length, 1);
  assert.equal(v[typer].alerts.length, 0);
  // A tick that changes nothing hands back the same save (nothing is written).
  const before = t.s;
  t.go(typer, { type: 'TICK' });
  assert.equal(t.s, before);
});

test('Online: the packed bank the referee carries holds every pair the engine reads, unchanged', () => {
  const back = unpackBank(packBank(BANK));
  assert.equal(back.pairs.length, BANK.pairs.length);
  for (let i = 0; i < BANK.pairs.length; i++) {
    const { kind: _k, topic: _t, ...want } = BANK.pairs[i];
    assert.deepEqual(back.pairs[i], want);
  }
});
