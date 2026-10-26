import test from 'node:test';
import assert from 'node:assert/strict';
import { validateClue } from '../engine/clues';
import { searchTerms, termsOfBank } from '../engine/terms';
import { differentOrder, planMatch } from '../engine/match';
import { addClue, currentWord, isFinished, markCorrect, newTeamRound, removeClue, skipWord, totalClues, wordsCompleted } from '../engine/teamRound';
import { elapsed, isTimeUp, pauseTimer, resumeTimer, startTimer, stopTimer } from '../engine/timer';
import { compareResults, decideWinner, forfeitedResult, summarizeMatch, sumResults } from '../engine/scoring';
import { canStart, lobbyReduce, newLobby, rolesForRound, type LobbyState } from '../engine/lobby';
import { expBar, onlineExp } from '../engine/economy';
import { CONFIG } from '../engine/config';
import type { Settings, TeamRoundResult } from '../engine/types';
import { APPENDICITIS, ASPIRIN, MI, makeTerms, seqRng } from './helpers';

// ---------------------------------------------------------------------------- clues
test('clue rules: one word, hyphens and acronyms are one word', () => {
  assert.deepEqual(validateClue(MI, 'pain'), { ok: true, clue: 'pain' });
  assert.deepEqual(validateClue(MI, '  chest  '), { ok: true, clue: 'chest' });
  assert.deepEqual(validateClue(ASPIRIN, 'anti-inflammatory'), { ok: true, clue: 'anti-inflammatory' });
  assert.deepEqual(validateClue(MI, 'STEMI'), { ok: true, clue: 'STEMI' });
  assert.deepEqual(validateClue(ASPIRIN, 'NSAID'), { ok: true, clue: 'NSAID' });
  assert.equal((validateClue(MI, '') as any).reason, 'EMPTY');
  assert.equal((validateClue(MI, '   ') as any).reason, 'EMPTY');
  assert.equal((validateClue(MI, 'chest pain') as any).reason, 'NOT_ONE_WORD');
  assert.equal((validateClue(MI, 'pain!') as any).reason, 'INVALID_CHARS');
  assert.equal((validateClue(MI, 'x'.repeat(41)) as any).reason, 'TOO_LONG');
});

test('clue rules: the term itself, one of its words, or containing one of them', () => {
  assert.equal((validateClue(APPENDICITIS, 'appendicitis') as any).reason, 'TERM_WORD');
  assert.equal((validateClue(APPENDICITIS, 'APPENDICITIS') as any).reason, 'TERM_WORD');
  assert.equal((validateClue(MI, 'infarction') as any).reason, 'TERM_WORD'); // a word of the term
  assert.equal((validateClue(MI, 'myocardial') as any).reason, 'TERM_WORD');
  assert.equal((validateClue(MI, 'non-infarction') as any).reason, 'TERM_WORD'); // hyphen part equals a term word
  assert.equal((validateClue(MI, 'preinfarction') as any).reason, 'TERM_WORD'); // contains a term word
});

test('clue rules: same root = same first 5 letters, or one contains the other', () => {
  assert.equal((validateClue(APPENDICITIS, 'appendix') as any).reason, 'SAME_ROOT'); // "append"
  assert.equal((validateClue(APPENDICITIS, 'appendectomy') as any).reason, 'SAME_ROOT');
  assert.equal((validateClue(MI, 'infarct') as any).reason, 'SAME_ROOT'); // contained in "infarction"
  assert.equal((validateClue(MI, 'cardiac') as any).ok, true); // different root
  assert.equal((validateClue(MI, 'myo') as any).ok, true); // too short to count as a root (3 letters)
});

test('clue rules: hand-written forbidden list, duplicates, accents and capitals ignored', () => {
  assert.equal((validateClue(MI, 'heart') as any).reason, 'FORBIDDEN');
  assert.equal((validateClue(MI, 'ATTACK') as any).reason, 'FORBIDDEN');
  assert.equal((validateClue(APPENDICITIS, 'RLQ') as any).reason, 'FORBIDDEN');
  assert.equal((validateClue(MI, 'heart-failure') as any).reason, 'FORBIDDEN'); // a forbidden word inside a hyphenated clue
  assert.equal((validateClue(MI, 'pain', ['chest', 'Pain']) as any).reason, 'DUPLICATE');
  assert.equal((validateClue(MI, 'pain', ['chest']) as any).ok, true);
  const accent: any = { ...MI, forbidden: ['cœur'.replace('œ', 'oe'), 'café'] };
  assert.equal((validateClue(accent, 'CAFE') as any).reason, 'FORBIDDEN'); // accents ignored
});

// ---------------------------------------------------------------------------- terms
test('autocomplete: nothing until 3 letters, then prefix first, exact names', () => {
  const terms = makeTerms();
  assert.deepEqual(searchTerms(terms, ''), []);
  assert.deepEqual(searchTerms(terms, 'ap'), []); // fewer than 3 letters
  assert.deepEqual(searchTerms(terms, ' ap '), []);
  assert.equal(searchTerms(terms, 'app')[0].id, 'appy');
  assert.equal(searchTerms(terms, 'INFARC')[0].id, 'mi'); // word-start match, accents/case ignored
  assert.deepEqual(searchTerms(terms, 'zzzz'), []);
  assert.equal(searchTerms(terms, 'clinical', 3).length, 3);
  assert.deepEqual(
    searchTerms(terms, 'fem').map((t) => t.id),
    ['femur'],
  );
});

test('banks: clinical, basic science, or mixed', () => {
  const terms = makeTerms(5, 7);
  assert.equal(
    termsOfBank(terms, 'clinical').every((t) => t.bank === 'clinical'),
    true,
  );
  assert.equal(termsOfBank(terms, 'basic').length, 7 + 1); // + Femur
  assert.equal(termsOfBank(terms, 'mixed').length, terms.length);
});

// ---------------------------------------------------------------------------- match planning
const settings = (over: Partial<Settings> = {}): Settings => ({ bank: 'mixed', wordsPerTeam: 5, rounds: 1, ...over });

test('online plan: same words in a different order; round 2 uses new words', () => {
  const plan = planMatch({ terms: makeTerms(), settings: settings({ wordsPerTeam: 10, rounds: 2 }), mode: 'online', rng: seqRng() });
  assert.ok(plan.ok);
  const rounds = (plan as any).rounds;
  assert.equal(rounds.length, 2);
  for (const r of rounds) {
    assert.equal(r.lists.A.length, 10);
    assert.deepEqual([...r.lists.A].sort(), [...r.lists.B].sort()); // same words
    assert.notDeepEqual(r.lists.A, r.lists.B); // different order
  }
  const first = new Set(rounds[0].lists.A);
  assert.equal(
    rounds[1].lists.A.some((id: string) => first.has(id)),
    false,
  ); // no repeats
});

test('offline plan: each team gets its own words, never shared, round 2 new', () => {
  const plan = planMatch({ terms: makeTerms(), settings: settings({ wordsPerTeam: 10, rounds: 2 }), mode: 'offline', rng: seqRng() });
  assert.ok(plan.ok);
  const rounds = (plan as any).rounds;
  const all = rounds.flatMap((r: any) => [...r.lists.A, ...r.lists.B]);
  assert.equal(all.length, 40);
  assert.equal(new Set(all).size, 40); // nothing repeats anywhere
});

test('plan respects the bank and fails when there are not enough terms', () => {
  const clinicalOnly = planMatch({ terms: makeTerms(30, 30), settings: settings({ bank: 'clinical' }), mode: 'online', rng: seqRng() });
  const byId = new Map(makeTerms(30, 30).map((t) => [t.id, t]));
  assert.ok(clinicalOnly.ok && (clinicalOnly as any).rounds[0].lists.A.every((id: string) => byId.get(id)!.bank === 'clinical'));
  const tiny = planMatch({ terms: makeTerms(3, 2), settings: settings({ bank: 'basic' }), mode: 'offline', rng: seqRng() });
  assert.deepEqual(tiny, { ok: false, reason: 'NOT_ENOUGH_TERMS' });
  assert.deepEqual(differentOrder(['x'], seqRng()), ['x']);
  assert.notDeepEqual(
    differentOrder(['a', 'b', 'c'], () => 0.999),
    ['a', 'b', 'c'],
  ); // even a stubborn rng changes the order
});

// ---------------------------------------------------------------------------- team round
test('team round: current word, clue counting, skip, undo, completion', () => {
  let tr = newTeamRound(['w1', 'w2', 'w3']);
  assert.equal(currentWord(tr), 'w1');
  tr = addClue(addClue(tr, 'one'), 'two');
  assert.deepEqual([tr.words.w1.count, tr.words.w1.clues], [2, ['one', 'two']]);
  tr = skipWord(tr); // clues already given stay counted
  assert.deepEqual([currentWord(tr), totalClues(tr)], ['w2', 2]);
  tr = addClue(tr); // offline +1: count only
  assert.deepEqual([tr.words.w2.count, tr.words.w2.clues], [1, []]);
  tr = removeClue(removeClue(removeClue(tr)));
  assert.equal(tr.words.w2.count, 0); // never below 0
  tr = markCorrect(tr);
  assert.deepEqual([currentWord(tr), wordsCompleted(tr)], ['w3', 1]);
  tr = skipWord(tr);
  assert.deepEqual(tr.queue, ['w1', 'w3']); // w3 moved to the end
  tr = markCorrect(markCorrect(tr));
  assert.equal(isFinished(tr), true);
  assert.equal(totalClues(tr), 2); // clues on every word count
  assert.equal(skipWord(newTeamRound(['only'])).queue.length, 1); // nothing to skip to
  assert.equal(markCorrect(tr), tr); // nothing left
});

// ---------------------------------------------------------------------------- timer
test('timer: capped at 3 minutes, pausable, stops at the last word', () => {
  let t = startTimer(1000);
  assert.equal(elapsed(t, 11_000), 10_000);
  t = pauseTimer(t, 11_000);
  assert.equal(elapsed(t, 500_000), 10_000);
  t = resumeTimer(t, 500_000);
  assert.equal(elapsed(t, 505_000), 15_000);
  assert.equal(isTimeUp(t, 505_000), false);
  assert.equal(isTimeUp(t, 500_000 + CONFIG.ROUND_MAX_MS), true);
  assert.equal(elapsed(t, 9_999_999), CONFIG.ROUND_MAX_MS); // never more than 3:00
  t = stopTimer(t, 510_000);
  assert.equal(elapsed(t, 9_999_999), 20_000);
  assert.equal(pauseTimer(t, 600_000), t);
  assert.equal(resumeTimer(t, 600_000), t);
});

// ---------------------------------------------------------------------------- scoring
const res = (teamId: 'A' | 'B', wordsCompleted: number, clues: number, timeMs: number): TeamRoundResult => ({ teamId, wordsCompleted, clues, timeMs });

test('ranking: more words, then fewer clues, then less time; equal is a draw', () => {
  assert.equal(decideWinner(res('A', 5, 20, 100), res('B', 4, 3, 10)), 'A'); // words come first
  assert.equal(decideWinner(res('A', 5, 20, 100), res('B', 5, 18, 170)), 'B'); // then fewer clues
  assert.equal(decideWinner(res('A', 5, 18, 120), res('B', 5, 18, 90)), 'B'); // then less time
  assert.equal(decideWinner(res('A', 5, 18, 90), res('B', 5, 18, 90)), 'draw');
  assert.ok(compareResults(res('A', 3, 9, 1), res('B', 2, 1, 1)) < 0);
});

test('two rounds add up words, clues and time; a forfeited round is 0 words and the full cap', () => {
  const summary = summarizeMatch([
    { A: res('A', 5, 12, 100_000), B: res('B', 5, 15, 90_000) },
    { A: res('A', 5, 14, 110_000), B: res('B', 5, 9, 150_000) },
  ]);
  assert.deepEqual(summary.totals.A, { teamId: 'A', wordsCompleted: 10, clues: 26, timeMs: 210_000 });
  assert.deepEqual(summary.totals.B, { teamId: 'B', wordsCompleted: 10, clues: 24, timeMs: 240_000 });
  assert.deepEqual(summary.roundWinners, ['A', 'B']);
  assert.equal(summary.winner, 'B'); // fewer clues in total
  assert.deepEqual(forfeitedResult('A', 3, CONFIG.ROUND_MAX_MS), { teamId: 'A', wordsCompleted: 0, clues: 3, timeMs: 180_000 });
  assert.equal(sumResults('A', []).wordsCompleted, 0);
});

// ---------------------------------------------------------------------------- lobby
const four = (): LobbyState => {
  let s = newLobby({ id: 'h', name: 'Host' });
  for (const [id, name] of [
    ['p2', 'Bea'],
    ['p3', 'Cy'],
    ['p4', 'Di'],
  ])
    s = lobbyReduce(s, { type: 'PLAYER_JOINED', player: { id, name } });
  return s;
};
const intent = (s: LobbyState, by: string, i: any, rng?: () => number) => lobbyReduce(s, { type: 'INTENT', by, intent: i }, rng);

test('lobby: exactly 4 players, only the host changes anything, teams are 2 + 2', () => {
  let s = four();
  assert.equal(s.players.length, 4);
  s = lobbyReduce(s, { type: 'PLAYER_JOINED', player: { id: 'p5', name: 'Extra' } });
  assert.equal(s.players.length, 4); // a 5th player is not accepted
  assert.deepEqual(canStart(s), { ok: false, reason: 'TEAMS_NOT_2_AND_2' });

  assert.equal(intent(s, 'p2', { type: 'ASSIGN', playerId: 'p2', team: 'A' }), s); // not the host: ignored
  for (const [id, team] of [
    ['h', 'A'],
    ['p2', 'A'],
    ['p3', 'B'],
    ['p4', 'B'],
  ] as const)
    s = intent(s, 'h', { type: 'ASSIGN', playerId: id, team });
  assert.deepEqual(s.givers, { A: 'h', B: 'p3' }); // first member is the default giver
  assert.deepEqual(canStart(s), { ok: true });

  const full = intent(s, 'h', { type: 'ASSIGN', playerId: 'p3', team: 'A' }); // team A already has 2
  assert.equal(full.teams.p3, 'B');
  assert.deepEqual(canStart(lobbyReduce(s, { type: 'PLAYER_LEFT', playerId: 'p4' })), { ok: false, reason: 'NEED_4_PLAYERS' });
});

test('lobby: choose and swap givers, randomize, settings', () => {
  let s = four();
  s = intent(s, 'h', { type: 'RANDOMIZE' }, seqRng());
  const count = (t: string) => Object.values(s.teams).filter((x) => x === t).length;
  assert.deepEqual([count('A'), count('B')], [2, 2]);
  assert.deepEqual(canStart(s), { ok: true });

  const teamA = s.players.filter((p) => s.teams[p.id] === 'A').map((p) => p.id);
  const guesser = teamA.find((id) => id !== s.givers.A)!;
  s = intent(s, 'h', { type: 'SET_GIVER', team: 'A', playerId: guesser });
  assert.equal(s.givers.A, guesser);
  assert.equal(intent(s, 'h', { type: 'SET_GIVER', team: 'A', playerId: s.players.find((p) => s.teams[p.id] === 'B')!.id }), s); // wrong team
  const before = { ...s.givers };
  s = intent(s, 'h', { type: 'SWAP_ROLES' });
  assert.notEqual(s.givers.A, before.A);
  assert.notEqual(s.givers.B, before.B);

  s = intent(s, 'h', { type: 'SET_SETTINGS', settings: { bank: 'clinical', wordsPerTeam: 10, rounds: 2 } });
  assert.deepEqual(s.settings, { bank: 'clinical', wordsPerTeam: 10, rounds: 2 });
  assert.equal(intent(s, 'h', { type: 'SET_SETTINGS', settings: { wordsPerTeam: 7 as any } }), s); // only 5 or 10
  assert.equal(intent(s, 'h', { type: 'SET_SETTINGS', settings: { rounds: 3 as any } }), s); // only 1 or 2
});

test('lobby: the host leaving passes the host role; roles swap in round 2', () => {
  let s = four();
  s = lobbyReduce(s, { type: 'PLAYER_LEFT', playerId: 'h' });
  assert.equal(s.hostId, 'p2');
  s = lobbyReduce(s, { type: 'PLAYER_JOINED', player: { id: 'h2', name: 'New' } });
  for (const [id, team] of [
    ['p2', 'A'],
    ['p3', 'A'],
    ['p4', 'B'],
    ['h2', 'B'],
  ] as const)
    s = intent(s, 'p2', { type: 'ASSIGN', playerId: id, team });
  s = intent(s, 'p2', { type: 'SET_GIVER', team: 'A', playerId: 'p3' });
  const r1 = rolesForRound(s, 0);
  const r2 = rolesForRound(s, 1);
  assert.deepEqual([r1.p3.role, r1.p2.role], ['giver', 'guesser']);
  assert.deepEqual([r2.p3.role, r2.p2.role], ['guesser', 'giver']); // swapped in round 2
  assert.equal(r1.p3.team, 'A');
});

// ---------------------------------------------------------------------------- economy
test('online EXP: placeholders, forfeits and guests earn nothing; 200 EXP = 1 token', () => {
  assert.equal(onlineExp({ team: 'A', winner: 'A', forfeited: false, isSignedIn: true }), 60);
  assert.equal(onlineExp({ team: 'B', winner: 'A', forfeited: false, isSignedIn: true }), 20);
  assert.equal(onlineExp({ team: 'B', winner: 'draw', forfeited: false, isSignedIn: true }), 30);
  assert.equal(onlineExp({ team: 'A', winner: 'A', forfeited: true, isSignedIn: true }), 0);
  assert.equal(onlineExp({ team: 'A', winner: 'A', forfeited: false, isSignedIn: false }), 0);
  assert.deepEqual(expBar(450), { tokens: 2, remainder: 50, progress: 0.25 });
});

test('a practice plan plays my own term first, then the bank, without repeating it', () => {
  const terms = makeTerms();
  const own = terms[terms.length - 1].id;
  const plan = planMatch({ terms, settings: settings({ wordsPerTeam: 10, rounds: 2 }), mode: 'offline', rng: seqRng(), first: [own] });
  assert.ok(plan.ok);
  const rounds = (plan as any).rounds;
  assert.equal(rounds[0].lists.A[0], own);
  const all = rounds.flatMap((r: any) => [...r.lists.A, ...r.lists.B]);
  assert.equal(all.filter((id: string) => id === own).length, 1);
});
