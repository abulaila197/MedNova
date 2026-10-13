/// <reference types="node" />
// Engine unit tests. Run: npm run test:engine (compiles to a temp folder, then node --test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryKV } from '../storage';
import { createRecorder } from '../recorder';
import { createWallet } from '../wallet';
import { levelOf, levelTokens, stepTo } from '../levels';
import { createGate, GUEST_TRIALS } from '../gate';
import { createPicker } from '../picker';
import { rank } from '../standings';

const item = (playId: string, over: Record<string, unknown> = {}) => ({
  playId, seat: 0, itemId: 'c1', answerKey: 'asthma', outcome: 'wrong' as const, answersGiven: ['copd'],
  timeMs: 1000, hintsUsed: 0, revealsUsed: 0, points: 0, feedsLearn: true, gameData: {}, ...over,
});

test('recorder: start freezes settings, bookmark, resume, finish clears resume', async () => {
  const r = createRecorder(memoryKV());
  const p = await r.start({ game: 'the-diagnostic-pursuit', mode: 'solo', settings: { difficulty: 'easy' } });
  assert.throws(() => { (p.settings as Record<string, unknown>).difficulty = 'hard'; });
  await r.bookmark(p.id, { caseIndex: 2, clueIndex: 3 }, 160);
  const res = await r.resumable('the-diagnostic-pursuit', 'solo');
  assert.equal(res?.id, p.id);
  assert.deepEqual(res?.resume, { caseIndex: 2, clueIndex: 3 });
  assert.equal(res?.score, 160);
  const done = await r.finish(p.id, { score: 300, expEarned: 30 });
  assert.equal(done?.status, 'finished');
  assert.equal(done?.resume, null);
  assert.equal(await r.resumable('the-diagnostic-pursuit', 'solo'), null);
  assert.equal(await r.bookmark(p.id, {}), null, 'finished plays cannot be bookmarked');
});

test('recorder: misses only take feedsLearn non-right items; discard drops items', async () => {
  const r = createRecorder(memoryKV());
  const p = await r.start({ game: 'the-diagnostic-pursuit', mode: 'solo', settings: {} });
  await r.recordItem(item(p.id));
  await r.recordItem(item(p.id, { outcome: 'right' }));
  await r.recordItem(item(p.id, { feedsLearn: false }));
  await r.recordItem(item(p.id, { answerKey: null }));
  assert.equal((await r.misses()).length, 1);
  await r.discard(p.id);
  assert.equal((await r.itemsOf(p.id)).length, 0);
  assert.equal(await r.get(p.id), null);
});

test('recorder: parallel writes do not overwrite each other', async () => {
  const r = createRecorder(memoryKV());
  const p = await r.start({ game: 'the-riddler', mode: 'solo', settings: {} });
  await Promise.all(Array.from({ length: 20 }, (_, i) => r.recordItem(item(p.id, { itemId: `c${i}` }))));
  assert.equal((await r.itemsOf(p.id)).length, 20);
});

test('recorder: answers only rewrite the games in progress; ending a play moves it into the history', async () => {
  const kv = memoryKV();
  const r = createRecorder(kv);
  const old = await r.start({ game: 'the-riddler', mode: 'solo', settings: {} });
  await r.recordItem(item(old.id));
  await r.finish(old.id, { score: 1, expEarned: 0 });
  const p = await r.start({ game: 'the-riddler', mode: 'solo', settings: {} });
  await r.recordItem(item(p.id, { itemId: 'c2' }));
  assert.equal((await kv.get<unknown[]>('plays'))?.length, 1, 'the history holds only the ended play');
  assert.equal((await kv.get<unknown[]>('play_items'))?.length, 1);
  assert.equal((await kv.get<unknown[]>('play_items_open'))?.length, 1);
  await r.finish(p.id, { score: 2, expEarned: 0 });
  assert.equal((await kv.get<unknown[]>('plays_open'))?.length, 0);
  assert.equal((await kv.get<unknown[]>('play_items_open'))?.length, 0);
  const all = await r.all();
  assert.equal(all.plays.length, 2);
  assert.equal(all.items.length, 2);
  await r.markSynced([old.id, p.id]);
  assert.ok((await r.all()).plays.every((x) => x.synced));
});

test('recorder: removeSeat keeps the row, claimGuestPlays moves guest plays', async () => {
  const r = createRecorder(memoryKV());
  const p = await r.start({ game: 'the-riddler', mode: 'offline', settings: {}, seats: [{ seat: 0, name: 'A' }, { seat: 1, name: 'B' }] });
  const after = await r.removeSeat(p.id, 1);
  assert.deepEqual(after?.seats.map((s) => !!s.removed), [false, true]);
  assert.equal(await r.claimGuestPlays('u1'), 1);
  assert.equal((await r.get(p.id))?.userId, 'u1');
  assert.equal(await r.claimGuestPlays('u1'), 0);
});

test('levels: climb (LV2), then 6% more per level after 10 (LV4); tokens with the 5th-level prize (LV5)', () => {
  assert.deepEqual([2, 3, 4, 10, 11, 12].map(stepTo), [60, 80, 100, 220, 233, 247]);
  assert.equal(levelOf(4334).level, 20);
  assert.equal(levelOf(4333).level, 19);
  assert.deepEqual([1, 2, 4, 5, 10, 11].map(levelTokens), [0, 1, 3, 7, 15, 16]);
  assert.deepEqual(levelOf(0), { level: 1, into: 0, need: 60 });
  assert.deepEqual(levelOf(59), { level: 1, into: 59, need: 60 });
  assert.deepEqual(levelOf(60), { level: 2, into: 0, need: 80 });
  assert.equal(levelOf(1260).level, 10);
  assert.equal(levelOf(1259).level, 9);
});

test('wallet: earn once per play, cap, tokens per level up (LV1, LV5)', async () => {
  const w = createWallet(memoryKV());
  assert.deepEqual(await w.earn('p1', 150, 100), { amount: 100, level: 2, levelsGained: 1, tokensGained: 1 });
  assert.equal((await w.earn('p1', 150, 100)).amount, 0, 'second earn for same play ignored');
  assert.deepEqual(await w.earn('p2', 130, 1000), { amount: 130, level: 3, levelsGained: 1, tokensGained: 1 });
  let b = await w.balance();
  assert.equal(b.exp, 230);
  assert.equal(b.tokens, 2);
  assert.equal(b.into, 230 - 140);
  assert.deepEqual(await w.earn('p3', 1000, 1000), { amount: 1000, level: 9, levelsGained: 6, tokensGained: 9 }); // level 5 adds 3
  b = await w.balance();
  assert.equal(b.tokens, 11);
  await w.spend(3, 'hint');
  assert.equal((await w.balance()).exp, 1230, 'spending never lowers EXP');
  assert.equal((await w.earn('p4', -50, 100)).amount, 0);
});

test('wallet: spend needs tokens, refund once', async () => {
  const w = createWallet(memoryKV());
  assert.equal(await w.spend(1, 'hint'), null);
  await w.earn('p1', 400, 1000); // level 5 = 4 level tokens + the 3-token prize
  const rc = await w.spend(1, 'hint', 'p1');
  assert.ok(rc);
  assert.equal((await w.balance()).tokens, 6);
  assert.equal(await w.refund(rc!), true);
  assert.equal(await w.refund(rc!), false);
  assert.equal((await w.balance()).tokens, 7);
});

test('wallet: admin grants count, refused rows drop, merged overspend can go below 0 (EC1, AD1, OW1)', async () => {
  const w = createWallet(memoryKV());
  await w.earn('p1', 60, 100); // level 2 = 1 token
  const rc = await w.spend(1, 'hint', 'p1');
  await w.mergeRemote([
    { id: 'g1', kind: 'grant', exp: 0, tokens: 5, reason: 'admin', note: 'thanks', at: 1, synced: true },
    { id: 'w-other', kind: 'spend', exp: 0, tokens: -6, reason: 'hint', at: 2, synced: true },
  ]);
  assert.equal((await w.balance()).tokens, -1, 'owed back from later levels');
  assert.equal(await w.spend(1, 'hint'), null, 'no spending while owing');
  await w.drop([rc!]);
  assert.equal((await w.balance()).tokens, 0);
  assert.equal((await w.unsynced()).some((e) => e.id === rc), false);
});

test('gate: a guest gets 1 try per game for every mode, idempotent per play; online needs sign-in (T23)', async () => {
  const g = createGate(memoryKV(), () => '2026-10-11');
  await g.countPlay('nova-crossword', 'p0', false);
  await g.countPlay('nova-crossword', 'p0', false);
  assert.equal(await g.used('nova-crossword'), GUEST_TRIALS);
  assert.equal(await g.mustSignIn('nova-crossword', 'solo', false), true);
  assert.equal(await g.mustSignIn('nova-crossword', 'offline', false), true, 'solo and offline share the one try');
  assert.equal(await g.mustSignIn('nova-crossword', 'solo', true), false);
  assert.equal(await g.mustSignIn('the-riddler', 'solo', false), false, 'games counted apart');
  assert.equal(await g.mustSignIn('the-riddler', 'online', false), true, 'online always needs sign-in');
});

test('gate: signed in gets 3 free plays per game per day, bought plays add one, a new day resets (TR1-TR3)', async () => {
  let day = '2026-10-11';
  const g = createGate(memoryKV(), () => day);
  for (const id of ['a', 'b', 'c', 'c']) await g.countPlay('the-riddler', id, true);
  await g.countPlay('the-riddler', 'daily', true, true);
  assert.deepEqual(await g.allowance('the-riddler'), { used: 3, free: 3, extra: 0, left: 0, boost: 0 });
  assert.equal((await g.allowance('nova-crossword')).left, 3, 'each game has its own 3');
  await g.addPlay('the-riddler');
  assert.equal((await g.allowance('the-riddler')).left, 1);
  await g.countPlay('the-riddler', 'd', true);
  assert.equal((await g.allowance('the-riddler')).left, 0);
  day = '2026-10-12';
  assert.deepEqual(await g.allowance('the-riddler'), { used: 0, free: 3, extra: 0, left: 3, boost: 0 });
});

test('gate: Grand Rounds booster plays come after the free ones, only for that game, and end with the week', async () => {
  const g = createGate(memoryKV(), () => '2026-10-13');
  await g.addBoost('the-riddler', 0, 10);
  for (const id of ['a', 'b', 'c']) await g.countPlay('the-riddler', id, true);
  assert.deepEqual(await g.allowance('the-riddler'), { used: 3, free: 3, extra: 0, left: 10, boost: 10 });
  await g.countPlay('the-riddler', 'd', true);
  assert.deepEqual(await g.allowance('the-riddler'), { used: 4, free: 3, extra: 1, left: 9, boost: 9 });
  assert.equal((await g.allowance('nova-crossword')).boost, 0);
  await g.expireBoost(1);
  assert.equal((await g.allowance('the-riddler')).left, 0);
});

test('picker: unseen first, then reshuffle when the bank runs out', async () => {
  const kv = memoryKV();
  const pk = createPicker(kv);
  const pool = ['a', 'b', 'c', 'd'];
  const first = await pk.pick('nova-medicordle', pool, 3);
  assert.equal(new Set(first).size, 3);
  for (const id of first) await pk.markSeen('nova-medicordle', id);
  const second = await pk.pick('nova-medicordle', pool, 3);
  assert.equal(second[0], pool.find((x) => !first.includes(x)), 'the one unseen case comes first');
  assert.equal(new Set(second).size, 3);
  assert.deepEqual(await kv.get('seen:nova-medicordle'), [], 'reshuffle is saved');
  assert.equal((await pk.pick('nova-medicordle', ['a'], 5)).length, 1, 'never more than the pool');
});

test('standings: score, then time, then game tie-break, shared ranks', () => {
  const rows = [
    { seat: 0, name: 'A', score: 100, timeMs: 5000 },
    { seat: 1, name: 'B', score: 120, timeMs: 9000 },
    { seat: 2, name: 'C', score: 100, timeMs: 4000 },
    { seat: 3, name: 'D', score: 100, timeMs: 5000 },
  ];
  assert.deepEqual(rank(rows).map((r) => [r.name, r.rank]), [['B', 1], ['C', 2], ['A', 3], ['D', 3]]);
  const fewerHints = (a: { seat: number }, b: { seat: number }) => b.seat - a.seat;
  assert.deepEqual(rank(rows, fewerHints).map((r) => [r.name, r.rank]), [['B', 1], ['C', 2], ['D', 3], ['A', 4]]);
});
