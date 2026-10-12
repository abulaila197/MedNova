/// <reference types="node" />
// Achievement progress tests. Run: npm run test:engine (compiles to a temp folder, then node --test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GameKey, Mode, Play, PlayItem } from '../../../games/engine/types';
import { ACHIEVEMENTS, achievementProgress, tiersReached, tierTokens, type AchInputs } from '../progress';

const NOON = new Date(2026, 9, 10, 12, 0).getTime();
let n = 0;

const play = (game: GameKey, mode: Mode = 'solo', over: Partial<Play> = {}): Play => ({
  id: `p${n++}`, userId: 'me', game, mode, settings: {}, startedAt: NOON - 60_000, endedAt: NOON, status: 'finished', score: 0,
  seats: [{ seat: 0, name: 'You' }], standings: [], pauses: 0, expEarned: 0, resume: null, synced: false, ...over,
});

const item = (p: Play, over: Partial<PlayItem> = {}): PlayItem => ({
  id: `i${n++}`, playId: p.id, seat: 0, itemId: 'x', answerKey: null, outcome: 'right', answersGiven: [], timeMs: 0, hintsUsed: 0,
  revealsUsed: 0, points: 0, feedsLearn: false, gameData: {}, at: NOON, ...over,
});

const base = (over: Partial<AchInputs> = {}): AchInputs => ({ plays: [], items: [], prizeDays: 0, level: 1, reviewCards: 0, dossiersOpened: 0, ...over });

/** Two seats ranked; `first` is the seat in 1st. */
const ranked = (first: number) => [
  { seat: first, name: 'A', score: 10, timeMs: 0, rank: 1 },
  { seat: 1 - first, name: 'B', score: 5, timeMs: 0, rank: 2 },
];
const two = [{ seat: 0, name: 'You' }, { seat: 1, name: 'B' }];

test('achievements: finished plays, unfinished and other accounts left out', () => {
  const plays = [play('the-riddler'), play('the-riddler', 'solo', { status: 'in_progress', endedAt: null }), play('the-riddler', 'solo', { userId: 'other' }), play('the-riddler', 'solo', { userId: null })];
  const r = achievementProgress(base({ plays, me: 'me' }));
  assert.equal(r.first_rounds, 2);
  assert.equal(achievementProgress(base({ plays })).first_rounds, 3);
});

test('achievements: full rotation is the least-played game', () => {
  const keys: GameKey[] = ['case-files-unsolved', 'the-conqueror', 'nova-crossword', 'the-diagnostic-pursuit', 'nova-medicordle', 'the-riddler', 'the-silent-artist', 'the-streak-master', 'trust-me-not', 'the-wheels-of-chaos'];
  const nine = keys.slice(0, 9).flatMap((g) => [play(g), play(g)]);
  assert.equal(achievementProgress(base({ plays: nine })).full_rotation, 0);
  const all = [...nine, play('the-wheels-of-chaos'), play('the-wheels-of-chaos'), play('the-riddler')];
  assert.equal(achievementProgress(base({ plays: all })).full_rotation, 2);
});

test('achievements: night shift counts games ended 00:00-04:59 local', () => {
  const at = (h: number, m = 0) => play('the-riddler', 'solo', { endedAt: new Date(2026, 9, 10, h, m).getTime() });
  const plays = [at(0, 0), at(2, 30), at(4, 59), at(5, 0), at(23, 59)];
  assert.equal(achievementProgress(base({ plays })).night_shift, 3);
});

test('achievements: clean diagnosis is the owner solving on clue 1', () => {
  const p = play('the-diagnostic-pursuit', 'offline', { seats: two });
  const items = [
    item(p, { gameData: { cluesShown: 1 } }),
    item(p, { gameData: { cluesShown: 2 } }),
    item(p, { outcome: 'wrong', gameData: { cluesShown: 1 } }),
    item(p, { seat: 1, gameData: { cluesShown: 1 } }),
  ];
  assert.equal(achievementProgress(base({ plays: [p], items })).clean_diagnosis, 1);
});

test('achievements: hot streak is the best single streak, not a sum', () => {
  const a = play('the-streak-master');
  const b = play('the-streak-master', 'offline', { seats: two });
  const items = [item(a, { gameData: { streak: 12 } }), item(a, { gameData: { streak: 7 } }), item(b, { gameData: { streak: 9 } }), item(b, { seat: 1, gameData: { streak: 40 } })];
  assert.equal(achievementProgress(base({ plays: [a, b], items })).hot_streak, 12);
});

test('achievements: two-guess counts solved words in 2 rows or fewer', () => {
  const s = play('nova-medicordle');
  const o = play('nova-medicordle', 'offline', { seats: two });
  const items = [
    item(s, { gameData: { guesses: 1 } }),
    item(s, { gameData: { guesses: 2 } }),
    item(s, { gameData: { guesses: 3 } }),
    item(s, { outcome: 'wrong', gameData: { guesses: 2 } }),
    item(o, { gameData: { turns: [{ seat: 1, word: 'ASTHMA' }, { seat: 0, word: 'ANEMIA' }] } }),
    item(o, { gameData: { turns: [{ seat: 0, word: 'GOUT' }, { seat: 1, word: 'GOITER' }, { seat: 0, word: 'GLAUCOMA' }] } }),
    item(o, { seat: 1, gameData: { turns: [{ seat: 1, word: 'GOUT' }] } }),
  ];
  assert.equal(achievementProgress(base({ plays: [s, o], items })).two_guess, 3);
});

test('achievements: riddles and cases solved by the owner', () => {
  const r = play('the-riddler', 'online', { seats: two });
  const c = play('case-files-unsolved');
  const items = [
    item(r), item(r), item(r, { outcome: 'timed_out' }), item(r, { seat: 1 }),
    item(c, { gameData: { stamp: 'SOLVED' } }), item(c, { outcome: 'wrong', gameData: { stamp: 'CLOSED' } }),
  ];
  const out = achievementProgress(base({ plays: [r, c], items }));
  assert.equal(out.riddle_me_this, 2);
  assert.equal(out.cold_case, 1);
});

test('achievements: full marks counts distinct solo puzzles with 3 stars, or the saved bests', () => {
  const a = play('nova-crossword');
  const on = play('nova-crossword', 'online');
  const items = [
    item(a, { gameData: { level: 1, stars: 3 } }),
    item(a, { gameData: { level: 1, stars: 3 } }),
    item(a, { gameData: { level: 2, stars: 3 } }),
    item(a, { gameData: { level: 3, stars: 2 } }),
    item(on, { gameData: { level: 4, stars: 3 } }),
  ];
  assert.equal(achievementProgress(base({ plays: [a, on], items })).full_marks, 2);
  assert.equal(achievementProgress(base({ plays: [a, on], items, crosswordThreeStars: 7 })).full_marks, 7);
});

test('achievements: Conqueror and Trust Me Not wins are the owner placing 1st', () => {
  const plays = [
    play('the-conqueror', 'online', { seats: two, standings: ranked(0) }),
    play('the-conqueror', 'online', { seats: two, standings: ranked(1) }),
    play('trust-me-not', 'online', { seats: two, standings: ranked(0) }),
    play('trust-me-not', 'online', { seats: two, standings: ranked(0), status: 'in_progress' }),
  ];
  const r = achievementProgress(base({ plays }));
  assert.equal(r.conqueror, 1);
  assert.equal(r.most_trusted, 1);
});

test('achievements: team player counts the owner team placing 1st', () => {
  const teams = [{ id: 0, name: 'Team Cyan', color: '#6fd6ff' }, { id: 1, name: 'Team Violet', color: '#a48bff' }];
  const seats = [{ seat: 0, name: 'You', team: 0 }, { seat: 1, name: 'B', team: 1 }, { seat: 2, name: 'C', team: 1 }];
  const st = (a: number, b: number, c: number) => [
    { seat: 0, name: 'You', score: a, timeMs: 0, rank: 1 },
    { seat: 1, name: 'B', score: b, timeMs: 0, rank: 2 },
    { seat: 2, name: 'C', score: c, timeMs: 0, rank: 3 },
  ];
  const plays = [
    play('the-diagnostic-pursuit', 'offline', { settings: { teams }, seats, standings: st(10, 8, 8) }), // average: 10 vs 8, won
    play('nova-medicordle', 'offline', { settings: { teams }, seats, standings: st(3, 2, 2) }), // sum: 3 vs 4, lost
    play('the-riddler', 'offline', { seats, standings: st(10, 1, 1) }), // no teams
  ];
  assert.equal(achievementProgress(base({ plays })).team_player, 1);
});

test('achievements: offline games, inputs, and house call with friends only', () => {
  const plays = [play('the-riddler', 'offline', { seats: two }), play('the-riddler', 'online', { seats: two }), play('the-riddler')];
  const r = achievementProgress(base({ plays, friendIds: ['f1'], prizeDays: 31, level: 12, reviewCards: 25, dossiersOpened: 60 }));
  assert.equal(r.pass_stethoscope, 1);
  assert.equal(r.house_call, 0, 'seats without user ids never match a friend');
  const withFriend = [{ seat: 0, name: 'You' }, { seat: 1, name: 'Sara', userId: 'f1' }];
  const stranger = [{ seat: 0, name: 'You' }, { seat: 1, name: 'Sam', userId: 'x9' }];
  const calls = [play('the-riddler', 'online', { seats: withFriend }), play('the-riddler', 'online', { seats: stranger }), play('the-riddler', 'offline', { seats: withFriend })];
  assert.equal(achievementProgress(base({ plays: calls, friendIds: ['f1'] })).house_call, 1);
  assert.deepEqual([r.week_on_call, r.residency, r.career, r.back_to_basics, r.dossier_reader], [31, 31, 12, 25, 60]);
});

test('achievements: every key has a count and tiers follow the goals', () => {
  const r = achievementProgress(base());
  assert.deepEqual(Object.keys(r).sort(), ACHIEVEMENTS.map((a) => a.key).sort());
  assert.equal(ACHIEVEMENTS.length, 22);
  assert.equal(tiersReached('hot_streak', 9), 0);
  assert.equal(tiersReached('hot_streak', 10), 1);
  assert.equal(tiersReached('hot_streak', 34), 2);
  assert.equal(tiersReached('hot_streak', 35), 3);
  assert.equal(tiersReached('first_rounds', 1000), 3);
  assert.equal(tiersReached('residency', 179), 0);
});

test('achievements: invites, challenges and written cases come from the server; custom-case practice never counts', () => {
  const r = achievementProgress(base({ social: { recruiter: 3, challenger: 12, case_writer: 5 } }));
  assert.equal(r.recruiter, 3);
  assert.equal(r.challenger, 12);
  assert.equal(r.case_writer, 5);
  assert.equal(tiersReached('challenger', 12), 1);
  assert.equal(achievementProgress(base()).recruiter, 0);
  const practice = play('the-diagnostic-pursuit', 'solo', { settings: { custom: 'c:x' } });
  assert.equal(achievementProgress(base({ plays: [practice], items: [item(practice)] })).first_rounds, 0);
  assert.deepEqual(tierTokens('case_writer'), [3, 4, 5]);
  assert.deepEqual(tierTokens('recruiter'), [1, 3, 5]);
});
