/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { OPENING_MS, envelopeFor, finalOrder, poolsFor, startOnline, stepOnline, watcherEnvelope, type BankRow, type OnlineTmn } from '../online';

const bank = JSON.parse(readFileSync('supabase/functions/trust-me-not/bank.json', 'utf8')) as BankRow[];
const phone = JSON.parse(readFileSync('src/games/trustmenot/data/questions.json', 'utf8')) as Record<string, { q: string; c: string[] }>;
const seats = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, name: id.toUpperCase(), color: `#00000${i}` }));
const T0 = 1_000_000;

test('the bank: 1,500 questions, every one has its text on the phone, Mixed draws from both fields', () => {
  assert.equal(bank.length, 1500);
  for (const [id] of bank) assert.ok(phone[id] && phone[id].c.length === 3, id);
  const mixed = poolsFor(bank, 'mixed');
  const basic = poolsFor(bank, 'basic');
  const count = (p: ReturnType<typeof poolsFor>) => p[1].length + p[2].length + p[3].length + p[4].length;
  assert.equal(count(mixed), 1500);
  assert.equal(count(basic), 750);
  assert.ok(basic[4].every((q) => q.id.startsWith('B')));
});

test('the opening moves on when everyone presses Continue, or when its clock runs out', () => {
  let o = startOnline(seats, 'mixed', bank, 5, T0);
  assert.equal(o.g.phase, 'opening');
  for (const p of seats.slice(0, 3)) o = stepOnline(o, { type: 'ready' }, p.id, [], T0 + 100);
  assert.equal(o.g.phase, 'opening');
  o = stepOnline(o, { type: 'ready' }, 'd', [], T0 + 200);
  assert.equal(o.g.phase, 'gap1');
  const o2 = stepOnline(startOnline(seats, 'mixed', bank, 5, T0), null, null, [], T0 + OPENING_MS + 1);
  assert.equal(o2.g.phase, 'gap1');
});

test('the Gap ends early once every living player pressed Skip', () => {
  let o = stepOnline(startOnline(seats, 'mixed', bank, 5, T0), null, null, [], T0 + OPENING_MS + 1);
  const at = T0 + OPENING_MS + 500;
  for (const p of seats) o = stepOnline(o, { type: 'SKIP' }, p.id, [], at);
  assert.equal(o.g.phase, 'gap2');
  assert.equal(o.started, at);
});

test('phones can only act for themselves; a bad action changes nothing', () => {
  const o = stepOnline(startOnline(seats, 'mixed', bank, 5, T0), null, null, [], T0 + OPENING_MS + 1);
  const at = T0 + OPENING_MS + 500;
  const sold = stepOnline(o, { type: 'SELL', player: 'b', jewels: 1 }, 'a', [], at);
  assert.equal(sold.g.players.find((p) => p.id === 'b')!.jewels, 6);
  assert.equal(sold.g.players.find((p) => p.id === 'a')!.jewels, 5);
  assert.equal(stepOnline(o, { type: 'ADVANCE' }, 'a', [], at), o);
});

test('everyone away: the careful bots play the whole year to the reveal, never betraying', () => {
  let o: OnlineTmn = startOnline(seats, 'clinical', bank, 9, T0);
  const all = seats.map((p) => p.id);
  let now = T0;
  for (let i = 0; i < 400 && o.g.phase !== 'over'; i++) {
    now = (o.deadline ?? now) + 1;
    // Players come back for month 2 so nobody flees before the end.
    o = stepOnline(o, null, null, o.g.month % 2 ? all : [], now);
  }
  assert.equal(o.g.phase, 'over');
  const steal = o.g.log.filter((l) => l.kind === 'snare-sprung' || l.kind === 'stolen');
  assert.equal(steal.length, 0, 'bots never betray');
  const env = envelopeFor(o, 'a');
  assert.ok(env.reveal);
  assert.deepEqual(finalOrder(o.g).map((x) => x.id).sort(), ['a', 'b', 'c', 'd']);
});

test('envelopes: my jewels only, other jewels hidden; watchers see no jewels at all', () => {
  const o = stepOnline(startOnline(seats, 'mixed', bank, 5, T0), null, null, [], T0 + OPENING_MS + 1);
  const v = envelopeFor(o, 'a').view;
  assert.equal(v.players.find((p) => p.id === 'a')!.jewels, 6);
  assert.equal(v.players.find((p) => p.id === 'b')!.jewels, undefined);
  assert.ok(!JSON.stringify(watcherEnvelope(o)).includes('jewels'));
});
