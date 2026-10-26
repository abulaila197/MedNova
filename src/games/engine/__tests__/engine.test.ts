/// <reference types="node" />
// Engine unit tests. Run: npm run test:engine (compiles to a temp folder, then node --test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryKV } from '../storage';
import { createRecorder } from '../recorder';
import { createWallet } from '../wallet';
import { levelOf, levelTokens, stepTo } from '../levels';
import { createGate, GUEST_PLAYS } from '../gate';
import { createSparks, refill, spendAt, SPARKS_MAX } from '../sparks';
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
  assert.deepEqual([1, 2, 4, 5, 10, 11].map(levelTokens), [0, 5, 15, 35, 75, 80]);
  assert.deepEqual(levelOf(0), { level: 1, into: 0, need: 60 });
  assert.deepEqual(levelOf(59), { level: 1, into: 59, need: 60 });
  assert.deepEqual(levelOf(60), { level: 2, into: 0, need: 80 });
  assert.equal(levelOf(1260).level, 10);
  assert.equal(levelOf(1259).level, 9);
});

test('wallet: earn once per play, cap, tokens per level up (LV1, LV5)', async () => {
  const w = createWallet(memoryKV());
  assert.deepEqual(await w.earn('p1', 150, 100), { amount: 100, level: 2, levelsGained: 1, tokensGained: 5 });
  assert.equal((await w.earn('p1', 150, 100)).amount, 0, 'second earn for same play ignored');
  assert.deepEqual(await w.earn('p2', 130, 1000), { amount: 130, level: 3, levelsGained: 1, tokensGained: 5 });
  let b = await w.balance();
  assert.equal(b.exp, 230);
  assert.equal(b.tokens, 10);
  assert.equal(b.into, 230 - 140);
  assert.deepEqual(await w.earn('p3', 1000, 1000), { amount: 1000, level: 9, levelsGained: 6, tokensGained: 45 }); // level 5 adds 15
  b = await w.balance();
  assert.equal(b.tokens, 55);
  await w.spend(3, 'hint');
  assert.equal((await w.balance()).exp, 1230, 'spending never lowers EXP');
  assert.equal((await w.earn('p4', -50, 100)).amount, 0);
});

test('wallet: spend needs tokens, refund once', async () => {
  const w = createWallet(memoryKV());
  assert.equal(await w.spend(1, 'hint'), null);
  await w.earn('p1', 400, 1000); // level 5 = 20 level tokens + the 15-token prize
  const rc = await w.spend(1, 'hint', 'p1');
  assert.ok(rc);
  assert.equal((await w.balance()).tokens, 34);
  assert.equal(await w.refund(rc!), true);
  assert.equal(await w.refund(rc!), false);
  assert.equal((await w.balance()).tokens, 35);
});

test('wallet: admin grants count, refused rows drop, merged overspend can go below 0 (EC1, AD1, OW1)', async () => {
  const w = createWallet(memoryKV());
  await w.earn('p1', 60, 100); // level 2 = 5 tokens
  const rc = await w.spend(1, 'hint', 'p1');
  await w.mergeRemote([
    { id: 'g1', kind: 'grant', exp: 0, tokens: 5, reason: 'admin', note: 'thanks', at: 1, synced: true },
    { id: 'w-other', kind: 'spend', exp: 0, tokens: -10, reason: 'hint', at: 2, synced: true },
  ]);
  assert.equal((await w.balance()).tokens, -1, 'owed back from later levels');
  assert.equal(await w.spend(1, 'hint'), null, 'no spending while owing');
  await w.drop([rc!]);
  assert.equal((await w.balance()).tokens, 0);
  assert.equal((await w.unsynced()).some((e) => e.id === rc), false);
});

test('gate: a guest gets 5 plays in total across all games, idempotent per play; online needs sign-in (#83)', async () => {
  const g = createGate(memoryKV());
  for (const [game, id] of [['nova-crossword', 'p0'], ['nova-crossword', 'p0'], ['the-riddler', 'p1'], ['the-riddler', 'p2'], ['imposter', 'p3']] as const) await g.countGuest(game, id);
  assert.equal(await g.guestLeft(), 1);
  assert.equal(await g.mustSignIn('solo', false), false);
  await g.countGuest('code-clinic', 'p4');
  assert.equal(await g.guestLeft(), 0);
  assert.equal(await g.mustSignIn('solo', false), true);
  assert.equal(await g.mustSignIn('offline', false), true, 'solo and pass the phone share the 5');
  assert.equal(await g.mustSignIn('solo', true), false);
  assert.equal(await g.mustSignIn('online', false), true, 'online always needs sign-in');
  assert.equal(GUEST_PLAYS, 5);
});

test('sparks: refill one every N minutes up to 100, above full it waits, never below 0', () => {
  const m = 60000;
  assert.deepEqual(refill({ value: 50, at: 0 }, 25 * m, 10), { value: 52, at: 20 * m }, 'the part-filled Spark keeps its time');
  assert.deepEqual(refill({ value: 99, at: 0 }, 60 * m, 10), { value: 100, at: 60 * m });
  assert.deepEqual(refill({ value: 130, at: 0 }, 60 * m, 10), { value: 130, at: 60 * m }, 'gifts above full do not refill');
  assert.deepEqual(refill({ value: 10, at: 0 }, 25 * m, 5), { value: 15, at: 25 * m });
  assert.deepEqual(spendAt({ value: 100, at: 0 }, 30 * m, 25, 10), { value: 75, at: 30 * m }, 'a full bar starts refilling at the spend');
  assert.deepEqual(spendAt({ value: 3, at: 0 }, 0, 25, 10), { value: 0, at: 0 });
});

test('sparks: a unit pays once; spends since the last server bar count; settle keeps only unsent ones', async () => {
  let t = 1_000_000;
  const s = createSparks(memoryKV(), () => t);
  assert.equal((await s.state(10)).value, SPARKS_MAX, 'a new account starts full');
  assert.equal(await s.charge('play1', 25, 'the-riddler'), true);
  assert.equal(await s.charge('play1', 25, 'the-riddler'), false, 'same play, no second charge');
  assert.equal(await s.paid('play1'), true);
  t += 60000;
  await s.charge('play2', 15, 'the-riddler');
  assert.equal((await s.state(10)).value, 60);
  t += 10 * 60000;
  const st = await s.state(10);
  assert.equal(st.value, 61);
  assert.ok(st.nextIn > 0 && st.nextIn <= 10 * 60000);
  const sent = (await s.pending()).map((x) => x.id);
  await s.charge('play3', 10, 'imposter');
  await s.settle('u1', { value: 61, at: t }, sent);
  assert.equal((await s.pending()).length, 1, 'the spend made during the sync waits for the next one');
  assert.equal((await s.state(10)).value, 51);
  await s.settle('u2', { value: 100, at: t }, []);
  assert.equal((await s.pending()).length, 0, 'another account starts clean');
  assert.equal(await s.paid('play1'), false);
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
