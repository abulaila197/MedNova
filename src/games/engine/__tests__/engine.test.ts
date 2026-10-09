/// <reference types="node" />
// Engine unit tests. Run: npm run test:engine (compiles to a temp folder, then node --test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryKV } from '../storage';
import { createRecorder } from '../recorder';
import { createWallet } from '../wallet';
import { levelOf, stepTo } from '../levels';
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

test('recorder: removeSeat keeps the row, claimGuestPlays moves guest plays', async () => {
  const r = createRecorder(memoryKV());
  const p = await r.start({ game: 'the-riddler', mode: 'offline', settings: {}, seats: [{ seat: 0, name: 'A' }, { seat: 1, name: 'B' }] });
  const after = await r.removeSeat(p.id, 1);
  assert.deepEqual(after?.seats.map((s) => !!s.removed), [false, true]);
  assert.equal(await r.claimGuestPlays('u1'), 1);
  assert.equal((await r.get(p.id))?.userId, 'u1');
  assert.equal(await r.claimGuestPlays('u1'), 0);
});

test('levels: capped climb (LV2)', () => {
  assert.deepEqual([2, 3, 4, 13, 14, 30].map(stepTo), [60, 80, 100, 280, 300, 300]);
  assert.deepEqual(levelOf(0), { level: 1, into: 0, need: 60 });
  assert.deepEqual(levelOf(59), { level: 1, into: 59, need: 60 });
  assert.deepEqual(levelOf(60), { level: 2, into: 0, need: 80 });
  assert.equal(levelOf(1260).level, 10);
  assert.equal(levelOf(1259).level, 9);
});

test('wallet: earn once per play, cap, one token per level up (LV1)', async () => {
  const w = createWallet(memoryKV());
  assert.deepEqual(await w.earn('p1', 150, 100), { amount: 100, level: 2, levelsGained: 1 });
  assert.equal((await w.earn('p1', 150, 100)).amount, 0, 'second earn for same play ignored');
  assert.deepEqual(await w.earn('p2', 130, 1000), { amount: 130, level: 3, levelsGained: 1 });
  let b = await w.balance();
  assert.equal(b.exp, 230);
  assert.equal(b.tokens, 2);
  assert.equal(b.into, 230 - 140);
  assert.deepEqual(await w.earn('p3', 1000, 1000), { amount: 1000, level: 9, levelsGained: 6 });
  b = await w.balance();
  assert.equal(b.tokens, 8);
  await w.spend(3, 'hint');
  assert.equal((await w.balance()).exp, 1230, 'spending never lowers EXP');
  assert.equal((await w.earn('p4', -50, 100)).amount, 0);
});

test('wallet: spend needs tokens, refund once', async () => {
  const w = createWallet(memoryKV());
  assert.equal(await w.spend(1, 'hint'), null);
  await w.earn('p1', 400, 1000); // level 5 = 4 tokens
  const rc = await w.spend(1, 'hint', 'p1');
  assert.ok(rc);
  assert.equal((await w.balance()).tokens, 3);
  assert.equal(await w.refund(rc!), true);
  assert.equal(await w.refund(rc!), false);
  assert.equal((await w.balance()).tokens, 4);
});

test('gate: 3 trials per game shared by solo and offline, idempotent per play, signed-in never gated', async () => {
  const g = createGate(memoryKV());
  await g.countPlay('nova-crossword', 'solo', 'p0');
  await g.countPlay('nova-crossword', 'solo', 'p0');
  await g.countPlay('nova-crossword', 'offline', 'p1');
  assert.equal(await g.mustSignIn('nova-crossword', 'solo', false), false);
  await g.countPlay('nova-crossword', 'solo', 'p2');
  assert.equal(await g.used('nova-crossword', 'offline'), GUEST_TRIALS);
  assert.equal(await g.mustSignIn('nova-crossword', 'solo', false), true);
  assert.equal(await g.mustSignIn('nova-crossword', 'offline', false), true, 'solo and offline share the 3');
  assert.equal(await g.mustSignIn('nova-crossword', 'solo', true), false);
  assert.equal(await g.mustSignIn('the-riddler', 'solo', false), false, 'games counted apart');
  assert.equal(await g.mustSignIn('the-riddler', 'online', false), true, 'online always needs sign-in');
  assert.equal(await g.mustSignIn('the-riddler', 'online', true), false);
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
