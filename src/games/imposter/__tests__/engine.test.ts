import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RULES } from '../engine/constants';
import { canReact, computeWinners, nextDeadline, privateWord, reduce } from '../engine/engine';
import { getView } from '../engine/view';
import type { Player } from '../engine/types';
import { Sim, playRoundCaught } from './helpers';

const summary = (sim: Sim) => {
  assert.equal(String(sim.phase.kind), 'roundResult');
  return (sim.phase as any).summary;
};

test('round setup: one imposter, clockwise order, imposter gets the other word of the pair', () => {
  const sim = new Sim({ seed: 3 });
  sim.must({ type: 'START_MATCH', playerId: 'p1', config: { subtype: 'clinical', rounds: 2 } });
  const r = sim.round;
  assert.equal(String(sim.phase.kind), 'wordReveal');
  assert.equal(r.participants.length, 4);
  assert.equal(r.subtype, 'clinical');
  assert.ok(r.participants.includes(r.imposterId));
  // clockwise from a random start: order is a rotation of the seating order
  const k = r.participants.indexOf(r.order[0]);
  assert.deepEqual(r.participants.slice(k).concat(r.participants.slice(0, k)), r.order);
  const impWord = r.pair[r.imposterSide].word;
  const majWord = r.pair[r.imposterSide === 'a' ? 'b' : 'a'].word;
  assert.equal(privateWord(sim.state, r.imposterId), impWord);
  for (const id of sim.nonImposters()) assert.equal(privateWord(sim.state, id), majWord);
  sim.ackAll();
  assert.equal(String(sim.phase.kind), 'clue');
  assert.equal((sim.phase as any).deadline, sim.now + RULES.clueMs);
});

test('only the host starts online, 3 to 6 players, rounds 1 to 5, enough pairs', () => {
  const sim = new Sim({ n: 3 });
  assert.equal(sim.act({ type: 'START_MATCH', playerId: 'p2', config: { subtype: 'clinical', rounds: 2 } }).error?.code, 'start/notHost');
  assert.equal(sim.act({ type: 'START_MATCH', playerId: 'p1', config: { subtype: 'clinical', rounds: 6 } }).error?.code, 'start/config');
  assert.equal(sim.act({ type: 'START_MATCH', playerId: 'p1', config: { subtype: 'clinical', rounds: 0 } }).error?.code, 'start/config');
  const small = new Sim({ n: 2 });
  assert.equal(small.act({ type: 'START_MATCH', playerId: 'p1', config: { subtype: 'basic', rounds: 1 } }).error?.code, 'start/players');
  const ok = new Sim({ n: 6 });
  ok.must({ type: 'START_MATCH', playerId: 'p1', config: { subtype: 'basic', rounds: 5 } });
  assert.equal(ok.round.participants.length, 6);
});

test('word reveal: online it lasts a fixed 10 s and there is no Ready button', () => {
  const sim = new Sim();
  sim.must({ type: 'START_MATCH', playerId: 'p1', config: { subtype: 'basic', rounds: 1 } });
  assert.equal((sim.phase as any).deadline, sim.now + 10_000);
  assert.equal(sim.act({ type: 'ACK_WORD', playerId: 'p1' }).error?.code, 'mode');
  sim.advance(9_999);
  assert.equal(String(sim.phase.kind), 'wordReveal');
  sim.advance(1);
  assert.equal(String(sim.phase.kind), 'clue');
});

test('round result: online it continues after 5 s', () => {
  const sim = new Sim({ seed: 41 });
  sim.startOnline('clinical', 2);
  playRoundCaught(sim);
  assert.equal((sim.phase as any).deadline, sim.now + 5_000);
  sim.advance(4_999);
  assert.equal(String(sim.phase.kind), 'roundResult');
  sim.advance(1);
  assert.equal(String(sim.phase.kind), 'wordReveal');
});

test('clue: early submit skips the rest of the 30 s, then a 3 s pause, then the next player', () => {
  const sim = new Sim();
  sim.startOnline();
  const first = sim.round.order[0];
  sim.now += 5_000;
  sim.must({ type: 'SUBMIT_CLUE', playerId: first, text: 'Alpha' });
  let ph: any = sim.phase;
  assert.equal(ph.stage, 'pause');
  assert.equal(ph.deadline, sim.now + RULES.pauseMs);
  assert.equal(ph.reveal.text, 'Alpha');
  sim.advance(2_999);
  assert.equal((sim.phase as any).stage, 'pause');
  sim.advance(1);
  ph = sim.phase;
  assert.equal(ph.stage, 'typing');
  assert.equal(ph.slot, 1);
  assert.equal(ph.deadline, sim.now + RULES.clueMs);
});

test('clue: running out of time shows a dash and the game moves on', () => {
  const sim = new Sim();
  sim.startOnline();
  const first = sim.round.order[0];
  sim.advance(RULES.clueMs);
  const ph: any = sim.phase;
  assert.equal(ph.stage, 'pause');
  assert.equal(ph.reveal.text, null);
  assert.deepEqual(sim.round.clues[0], { turn: 1, playerId: first, text: null });
  sim.advance(RULES.pauseMs);
  assert.equal((sim.phase as any).slot, 1);
});

test('clue: wrong player, wrong phase and invalid clues are rejected without changing the state', () => {
  const sim = new Sim();
  sim.startOnline();
  const typer = sim.round.order[0];
  const other = sim.round.order[1];
  const before = JSON.stringify(sim.state);
  assert.equal(sim.act({ type: 'SUBMIT_CLUE', playerId: other, text: 'alpha' }).error?.code, 'clue/notYourTurn');
  assert.equal(sim.act({ type: 'SUBMIT_CLUE', playerId: typer, text: 'two words' }).error?.code, 'clue/format');
  assert.equal(sim.act({ type: 'DECIDE', playerId: typer, choice: 'vote' }).error?.code, 'phase');
  assert.equal(JSON.stringify(sim.state), before);
  assert.equal(String(sim.phase.kind), 'clue');
});

test('two obligatory turns, then the decision; "Vote now" by majority goes to the vote', () => {
  const sim = new Sim();
  sim.startOnline();
  sim.playClues();
  assert.equal(String(sim.phase.kind), 'decision');
  assert.equal(sim.round.clues.length, 8);
  assert.equal((sim.phase as any).deadline, sim.now + RULES.decisionMs);
  const [a, b, c, d] = sim.round.participants;
  sim.must({ type: 'DECIDE', playerId: a, choice: 'vote' });
  sim.must({ type: 'DECIDE', playerId: b, choice: 'vote' });
  sim.must({ type: 'DECIDE', playerId: c, choice: 'vote' });
  assert.equal(String(sim.phase.kind), 'decision');
  sim.must({ type: 'DECIDE', playerId: d, choice: 'extra' });
  assert.equal(String(sim.phase.kind), 'vote');
});

test('decision: a tie means one more turn, then a forced vote (max 1 extra turn)', () => {
  const sim = new Sim();
  sim.startOnline();
  sim.playClues();
  const [a, b, c, d] = sim.round.participants;
  sim.must({ type: 'DECIDE', playerId: a, choice: 'vote' });
  sim.must({ type: 'DECIDE', playerId: b, choice: 'vote' });
  sim.must({ type: 'DECIDE', playerId: c, choice: 'extra' });
  sim.must({ type: 'DECIDE', playerId: d, choice: 'extra' });
  assert.equal(String(sim.phase.kind), 'clue');
  assert.equal(sim.round.turn, 3);
  assert.equal(sim.round.extraUsed, true);
  sim.playClues();
  assert.equal(String(sim.phase.kind), 'vote'); // no second decision
  assert.equal(sim.round.clues.length, 12);
});

test('decision: no answers means one more turn after 10 s', () => {
  const sim = new Sim();
  sim.startOnline();
  sim.playClues();
  sim.advance(RULES.decisionMs);
  assert.equal(String(sim.phase.kind), 'clue');
  assert.equal(sim.round.turn, 3);
});

test('vote: caught imposter, countdown, votes can change, redemption correct', () => {
  const sim = new Sim({ seed: 5 });
  sim.startOnline();
  sim.toVote();
  const imp = sim.round.imposterId;
  const [x, y, z] = sim.nonImposters();
  sim.everybodyVotesImposter();
  assert.notEqual((sim.phase as any).allVotedAt, null);
  assert.equal(sim.act({ type: 'CAST_VOTE', playerId: x, target: x }).error?.code, 'vote/self');
  sim.must({ type: 'CAST_VOTE', playerId: x, target: y }); // votes can change during the countdown
  sim.must({ type: 'CAST_VOTE', playerId: x, target: imp });
  sim.advance(4_999);
  assert.equal(String(sim.phase.kind), 'vote');
  sim.advance(1);
  const red: any = sim.phase;
  assert.equal(red.kind, 'redemption');
  assert.equal(red.deadline, sim.now + RULES.redemptionMs);
  sim.must({ type: 'SUBMIT_GUESS', playerId: imp, text: sim.majorityWord() });
  const s = summary(sim);
  assert.equal(s.outcome, 'caught');
  assert.equal(s.redemptionCorrect, true);
  for (const id of [x, y, z]) assert.equal(sim.score(id), 2);
  assert.equal(sim.score(imp), 1);
  assert.equal(s.creditWinnerId, x); // x was the first to vote for the imposter
  assert.equal(sim.state.players.find((p) => p.id === x)!.credits, 1);
});

test('redemption: wrong guess, own word, profanity, wrong player and timeout', () => {
  const sim = new Sim({ seed: 6 });
  sim.startOnline();
  sim.toVote();
  sim.everybodyVotesImposter();
  sim.advance(5_000);
  const imp = sim.round.imposterId;
  const other = sim.nonImposters()[0];
  assert.equal(sim.act({ type: 'SUBMIT_GUESS', playerId: other, text: 'x' }).error?.code, 'guess/notImposter');
  const bad = sim.act({ type: 'SUBMIT_GUESS', playerId: imp, text: 'foobar' });
  assert.equal(bad.error?.code, 'guess/profanity');
  assert.equal(String(sim.phase.kind), 'redemption'); // the attempt is not used
  assert.equal(sim.state.players.find((p) => p.id === imp)!.profanityAttempts, 1);
  sim.must({ type: 'SUBMIT_GUESS', playerId: imp, text: sim.round.pair[sim.round.imposterSide].word });
  const s = summary(sim);
  assert.equal(s.redemptionCorrect, false);
  assert.equal(sim.score(imp), 0);
  for (const id of sim.nonImposters()) assert.equal(sim.score(id), 2); // correct voters keep their points
  assert.equal(sim.act({ type: 'SUBMIT_GUESS', playerId: imp, text: 'again' }).error?.code, 'phase');

  const t = new Sim({ seed: 7 });
  t.startOnline();
  t.toVote();
  t.everybodyVotesImposter();
  t.advance(5_000);
  t.advance(RULES.redemptionMs);
  assert.equal(summary(t).redemptionCorrect, false);
});

test('vote: a double tie means the imposter wins (not caught), wrong voters add points', () => {
  const sim = new Sim({ seed: 8 });
  sim.startOnline();
  sim.toVote();
  const imp = sim.round.imposterId;
  const [a, b, c] = sim.nonImposters();
  const cast = (voter: string, target: string) => sim.must({ type: 'CAST_VOTE', playerId: voter, target });
  cast(a, b); cast(b, a); cast(c, b); cast(imp, a); // b:2, a:2
  sim.advance(5_000);
  const ph: any = sim.phase;
  assert.equal(ph.kind, 'vote');
  assert.equal(sim.round.voteRound, 2);
  assert.deepEqual([...sim.round.candidates!].sort(), [a, b].sort());
  assert.equal(sim.act({ type: 'CAST_VOTE', playerId: c, target: imp }).error?.code, 'vote/notCandidate');
  cast(a, b); cast(b, a); cast(c, b); cast(imp, a); // tie again
  sim.advance(5_000);
  const s = summary(sim);
  assert.equal(s.outcome, 'not-caught');
  assert.equal(sim.score(imp), 2 + 3); // base + one per wrong voter
  for (const id of [a, b, c]) assert.equal(sim.score(id), 0);
  assert.equal(s.creditWinnerId, null);
});

test('vote: most votes on an innocent player means not caught, no revote', () => {
  const sim = new Sim({ seed: 9 });
  sim.startOnline();
  sim.toVote();
  const imp = sim.round.imposterId;
  const [a, b, c] = sim.nonImposters();
  const cast = (voter: string, target: string) => sim.must({ type: 'CAST_VOTE', playerId: voter, target });
  cast(a, b); cast(b, c); cast(c, b); cast(imp, a); // b:2
  sim.advance(5_000);
  assert.equal(summary(sim).outcome, 'not-caught');
  assert.equal(sim.score(imp), 5);
});

test('vote: nobody votes means not caught; non-voters count as wrong guesses', () => {
  const sim = new Sim({ seed: 10 });
  sim.startOnline();
  sim.toVote();
  sim.advance(RULES.voteMs);
  assert.equal(summary(sim).outcome, 'not-caught');
  assert.equal(sim.score(sim.round.imposterId), 5);
});

test('imposter disconnects: the other players win the round (+2 each) and the match goes on', () => {
  const sim = new Sim({ seed: 11 });
  sim.startOnline('clinical', 2);
  const imp = sim.round.imposterId;
  sim.must({ type: 'PLAYER_DISCONNECTED', playerId: imp });
  const s = summary(sim);
  assert.equal(s.outcome, 'imposter-disconnected');
  for (const id of sim.ids().filter((i) => i !== imp)) assert.equal(sim.score(id), 2);
  assert.equal(sim.score(imp), 0);
  sim.must({ type: 'NEXT_ROUND', playerId: sim.state.hostId });
  assert.equal(sim.round.participants.length, 3);
  assert.ok(!sim.round.participants.includes(imp));
});

test('fewer than 3 players ends the match; an unfinished round is discarded', () => {
  const sim = new Sim({ n: 3, seed: 12 });
  sim.startOnline();
  const leaver = sim.nonImposters()[0];
  sim.must({ type: 'PLAYER_DISCONNECTED', playerId: leaver });
  assert.equal(String(sim.phase.kind), 'matchEnd');
  assert.equal(sim.state.history.length, 0);
  assert.ok(sim.state.players.every((p) => p.score === 0));
  const ended = sim.events.find((e) => e.type === 'match-ended') as any;
  assert.equal(ended.reason, 'too-few-players');
});

test('fewer than 3 players during redemption: the round is scored, redemption counts as not attempted', () => {
  const sim = new Sim({ n: 3, seed: 13 });
  sim.startOnline();
  sim.toVote();
  sim.everybodyVotesImposter();
  sim.advance(5_000);
  assert.equal(String(sim.phase.kind), 'redemption');
  const [x, y] = sim.nonImposters();
  sim.must({ type: 'PLAYER_DISCONNECTED', playerId: x });
  assert.equal(String(sim.phase.kind), 'matchEnd');
  assert.equal(sim.state.history.length, 1);
  assert.equal(sim.state.history[0].redemptionCorrect, false);
  assert.equal(sim.score(x), 2); // their vote was counted before they left
  assert.equal(sim.score(y), 2);
});

test('host leaves: a random connected player becomes host; lobby disconnects remove the player', () => {
  const sim = new Sim({ seed: 14 });
  sim.startOnline();
  sim.must({ type: 'PLAYER_DISCONNECTED', playerId: 'p1' });
  assert.notEqual(sim.state.hostId, 'p1');
  assert.ok(sim.state.players.find((p) => p.id === sim.state.hostId)!.connected);
  assert.ok(sim.events.some((e) => e.type === 'host-changed'));
  sim.must({ type: 'PLAYER_RECONNECTED', playerId: 'p1' });
  assert.notEqual(sim.state.hostId, 'p1');

  const lobby = new Sim({ n: 3 });
  lobby.must({ type: 'PLAYER_DISCONNECTED', playerId: 'p1' });
  assert.equal(lobby.state.players.length, 2);
  assert.notEqual(lobby.state.hostId, 'p1');
});

test('a disconnected player is skipped at once, with no pause, and shows no clue', () => {
  const sim = new Sim({ seed: 15 });
  sim.startOnline();
  const imp = sim.round.imposterId;
  const skipped = sim.round.order.slice(1).find((id) => id !== imp)!;
  const k = sim.round.order.indexOf(skipped);
  sim.must({ type: 'PLAYER_DISCONNECTED', playerId: skipped });
  while ((sim.phase as any).kind === 'clue' && (sim.phase as any).slot < k) {
    const ph: any = sim.phase;
    if (ph.stage === 'typing') sim.must({ type: 'SUBMIT_CLUE', playerId: sim.round.order[ph.slot], text: sim.nextClueWord() });
    else sim.advance(3000);
  }
  const ph: any = sim.phase;
  assert.equal(ph.slot, k + 1);
  assert.equal(ph.stage, 'typing');
  assert.ok(sim.round.clues.some((c) => c.playerId === skipped && c.text === null));
});

test('a vote only counts while the voter is connected; coming back before the end restores it', () => {
  const sim = new Sim({ seed: 16 });
  sim.startOnline();
  sim.toVote();
  const imp = sim.round.imposterId;
  const [a, b, c] = sim.nonImposters();
  sim.must({ type: 'CAST_VOTE', playerId: a, target: imp });
  sim.must({ type: 'CAST_VOTE', playerId: b, target: imp });
  sim.must({ type: 'PLAYER_DISCONNECTED', playerId: b });
  sim.must({ type: 'PLAYER_RECONNECTED', playerId: b });
  sim.must({ type: 'CAST_VOTE', playerId: c, target: imp });
  sim.must({ type: 'CAST_VOTE', playerId: imp, target: a });
  sim.advance(5_000);
  assert.equal(String(sim.phase.kind), 'redemption');
  assert.equal(Object.keys(sim.round.final!.votes).length, 4);

  const sim2 = new Sim({ seed: 17 });
  sim2.startOnline();
  sim2.toVote();
  const imp2 = sim2.round.imposterId;
  const [p, q, r] = sim2.nonImposters();
  sim2.must({ type: 'CAST_VOTE', playerId: p, target: q });
  sim2.must({ type: 'CAST_VOTE', playerId: q, target: r });
  sim2.must({ type: 'PLAYER_DISCONNECTED', playerId: p }); // still 3 connected
  sim2.advance(RULES.voteMs);
  assert.equal(sim2.round.final!.votes[p], undefined); // not counted
  assert.ok(!sim2.round.final!.voters.includes(p)); // and not a wrong voter either
  assert.equal(summary(sim2).outcome, 'not-caught');
  assert.equal(sim2.score(imp2), 2 + 2); // wrong voters: q and r only
});

test('profanity: the host is notified after 3 attempts; nobody is notified if the host is the offender', () => {
  const sim = new Sim({ seed: 18 });
  sim.startOnline();
  const typer = sim.round.order[0];
  const attempt = () => sim.act({ type: 'SUBMIT_CLUE', playerId: sim.round.order[(sim.phase as any).slot], text: 'foobar' });
  const who = typer === 'p1' ? 'p1' : typer;
  attempt(); attempt();
  assert.equal(sim.events.filter((e) => e.type === 'profanity-threshold').length, 0);
  const third = attempt();
  assert.equal(third.error?.code, 'clue/profanity');
  assert.equal(sim.state.players.find((p) => p.id === who)!.profanityAttempts, 3); // errors still persist the counter
  const ev = sim.events.filter((e) => e.type === 'profanity-threshold') as any[];
  if (who === 'p1') assert.equal(ev.length, 0);
  else {
    assert.equal(ev.length, 1);
    assert.equal(ev[0].notifyId, 'p1');
    assert.equal(ev[0].playerId, who);
  }
  assert.equal((sim.phase as any).stage, 'typing'); // unlimited attempts within the 30 s
  // the other case
  const h = new Sim({ seed: 19 });
  h.startOnline();
  let guard = 0;
  while (h.round.order[(h.phase as any).slot] !== 'p1' && guard++ < 20) {
    const ph: any = h.phase;
    if (ph.stage === 'typing') h.must({ type: 'SUBMIT_CLUE', playerId: h.round.order[ph.slot], text: h.nextClueWord() });
    else h.advance(3000);
  }
  for (let i = 0; i < 3; i++) h.act({ type: 'SUBMIT_CLUE', playerId: 'p1', text: 'bazqux' });
  assert.equal(h.events.filter((e) => e.type === 'profanity-threshold').length, 0);
});

test('views: secrets stay hidden, only the latest clue is shown, last turn is shown at the decision', () => {
  const sim = new Sim({ seed: 20 });
  sim.startOnline();
  const imp = sim.round.imposterId;
  const [viewer] = sim.nonImposters();
  const impWord = sim.round.pair[sim.round.imposterSide].word;
  const majWord = sim.majorityWord();
  const vNormal = getView(sim.state, viewer);
  const vImp = getView(sim.state, imp);
  assert.equal(vNormal.myWord, majWord);
  assert.equal(vImp.myWord, impWord);
  assert.equal(vNormal.category, sim.round.pair.category);
  const json = JSON.stringify(vNormal);
  assert.ok(!json.includes(impWord));
  assert.ok(!json.includes('imposterId'));
  assert.ok(vNormal.players.every((p) => p.score === null)); // totals only between rounds

  const typer = sim.round.order[0];
  assert.equal(canReact(sim.state, typer), false);
  assert.equal(canReact(sim.state, sim.round.order[1]), true);
  sim.must({ type: 'SUBMIT_CLUE', playerId: typer, text: 'alpha' });
  assert.equal(getView(sim.state, viewer).revealedClue?.text, 'alpha');
  assert.equal(canReact(sim.state, typer), true); // pause: nobody is typing
  sim.advance(3000);
  const next = getView(sim.state, viewer);
  assert.equal(next.revealedClue, null); // the clue disappears
  assert.equal(next.typingPlayerId, sim.round.order[1]);
  assert.equal(next.lastTurnClues, null);

  sim.playClues();
  const d = getView(sim.state, viewer);
  assert.equal(d.lastTurnClues!.length, 4);
  assert.ok(d.lastTurnClues!.every((c) => c.turn === 2));
  sim.must({ type: 'DECIDE', playerId: viewer, choice: 'extra' });
  const after = getView(sim.state, viewer);
  assert.deepEqual(after.decisionAnswered, [viewer]); // who answered, not what
  assert.ok(!JSON.stringify(after).includes('"extra"'));
});

test('join: only in the lobby or between rounds, max 6, rejoin reconnects', () => {
  const full = new Sim({ n: 6 });
  assert.equal(full.act({ type: 'JOIN', playerId: 'p7', name: 'P7' }).error?.code, 'join/full');
  const sim = new Sim({ seed: 21 });
  sim.startOnline('clinical', 2);
  assert.equal(sim.act({ type: 'JOIN', playerId: 'p5', name: 'P5' }).error?.code, 'join/closed');
  playRoundCaught(sim);
  sim.must({ type: 'JOIN', playerId: 'p5', name: 'P5' });
  sim.must({ type: 'NEXT_ROUND', playerId: 'p1' });
  assert.equal(sim.round.participants.length, 5);
  assert.equal(sim.state.players.find((p) => p.id === 'p5')!.score, 0);
});

test('a full 2-round match: pairs never repeat, results auto-advance, winners are computed', () => {
  const sim = new Sim({ seed: 22 });
  sim.startOnline('mixed', 2);
  playRoundCaught(sim);
  assert.equal(nextDeadline(sim.state), sim.now + RULES.resultMs);
  sim.advance(RULES.resultMs); // auto-advance
  assert.equal(String(sim.phase.kind), 'wordReveal');
  playRoundCaught(sim);
  sim.must({ type: 'NEXT_ROUND', playerId: 'p1' });
  assert.equal(String(sim.phase.kind), 'matchEnd');
  assert.equal(new Set(sim.state.usedPairIds).size, 2);
  assert.equal(sim.state.history.length, 2);
  const ended = sim.events.find((e) => e.type === 'match-ended') as any;
  assert.equal(ended.reason, 'completed');
  assert.ok(ended.winners.length >= 1);
});

test('only the host moves on from a round result online', () => {
  const sim = new Sim({ seed: 23 });
  sim.startOnline();
  playRoundCaught(sim);
  assert.equal(sim.act({ type: 'NEXT_ROUND', playerId: 'p2' }).error?.code, 'next/notHost');
});

test('winners: highest score, then more credits, then shared', () => {
  const mk = (id: string, score: number, credits: number): Player => ({ id, name: id, connected: true, score, credits, profanityAttempts: 0 });
  assert.deepEqual(computeWinners([mk('a', 5, 0), mk('b', 7, 0), mk('c', 7, 1)]), ['c']);
  assert.deepEqual(computeWinners([mk('a', 9, 0), mk('b', 7, 5)]), ['a']);
  assert.deepEqual(computeWinners([mk('a', 7, 1), mk('b', 7, 1), mk('c', 3, 9)]), ['a', 'b']);
});

test('credit: earliest first vote for the imposter wins it, even if that player changes their vote later', () => {
  const sim = new Sim({ seed: 24 });
  sim.startOnline();
  sim.toVote();
  const imp = sim.round.imposterId;
  const [a, b, c] = sim.nonImposters();
  sim.must({ type: 'CAST_VOTE', playerId: c, target: imp });
  sim.now += 500;
  sim.must({ type: 'CAST_VOTE', playerId: a, target: imp });
  sim.must({ type: 'CAST_VOTE', playerId: c, target: b }); // c switches away later
  sim.must({ type: 'CAST_VOTE', playerId: b, target: imp });
  sim.must({ type: 'CAST_VOTE', playerId: imp, target: a });
  sim.advance(5_000);
  sim.must({ type: 'SUBMIT_GUESS', playerId: imp, text: 'nope' });
  assert.equal(summary(sim).creditWinnerId, c); // follows the wording: first vote for the true imposter
});

test('reduce is pure: the input state is never changed', () => {
  const sim = new Sim({ seed: 25 });
  sim.startOnline();
  const before = JSON.stringify(sim.state);
  reduce(sim.state, { type: 'SUBMIT_CLUE', playerId: sim.round.order[0], text: 'alpha' }, sim.env());
  reduce(sim.state, { type: 'TICK' }, { ...sim.env(), now: sim.now + 99_999 });
  assert.equal(JSON.stringify(sim.state), before);
});

test('nextDeadline: clue deadline, then the earlier of the countdown and the vote deadline', () => {
  const sim = new Sim({ seed: 26 });
  sim.startOnline();
  assert.equal(nextDeadline(sim.state), sim.now + RULES.clueMs);
  sim.toVote();
  assert.equal(nextDeadline(sim.state), sim.now + RULES.voteMs);
  sim.everybodyVotesImposter();
  assert.equal(nextDeadline(sim.state), sim.now + RULES.voteCountdownMs);
});

test('a late action cannot sneak in after a deadline: timers fire first', () => {
  const sim = new Sim({ seed: 27 });
  sim.startOnline();
  const first = sim.round.order[0];
  sim.now += RULES.clueMs + 1;
  const res = sim.act({ type: 'SUBMIT_CLUE', playerId: first, text: 'alpha' });
  assert.equal(res.error?.code, 'clue/notTyping'); // the 30 s already ran out (pause stage)
  assert.equal(sim.round.clues[0].text, null);
});
