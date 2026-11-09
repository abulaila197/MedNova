/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { afterAnswer, chanceOf, decide, mindFor, moodOf, skillOf, solveClue, type Mind } from '../brain';
import { CHATTY, personaOf } from '../identity';
import { hash, rng } from '../rng';
import { PERSONAS, type BotType, type Persona } from '../types';

const bot = (type: BotType, persona: Persona = 'cheer', name = 'Omar') => ({ id: `bot:${type}:${name}`, type, name, persona });
const rate = (m: Mind, n = 3000, extra: { gap?: number } = {}) => {
  let right = 0;
  for (let i = 0; i < n; i++) if (decide(m, { seed: `p:${i}`, limitMs: 20000, ...extra }).right) right++;
  return right / n;
};

test('rng: same seed, same numbers; hash is stable', () => {
  const a = rng('x');
  const b = rng('x');
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
  assert.equal(hash('Omar'), hash('Omar'));
});

test('identity: a name always has the same personality; every personality is used', () => {
  assert.equal(personaOf('Omar'), personaOf('Omar'));
  const seen = new Set(['Omar', 'Lena', 'Kenji', 'Amara', 'Mateo', 'Yara', 'Liam', 'Sofia', 'Hana', 'Kofi', 'Ines', 'Ziad', 'Nils', 'Mei', 'Arjun', 'Olga'].map(personaOf));
  assert.ok(seen.size >= 6);
  for (const p of PERSONAS) assert.ok(CHATTY[p] >= 0 && CHATTY[p] <= 1);
});

test('skill: Freshman < Scholar < Genius, growth is capped and the Genius stays beatable', () => {
  assert.equal(skillOf('freshman', 1), 0.35);
  assert.equal(skillOf('scholar', 1), 0.65);
  assert.equal(skillOf('genius', 1), 0.9);
  assert.equal(skillOf('genius', 500), 0.92);
  const f = rate(mindFor(bot('freshman')));
  const s = rate(mindFor(bot('scholar')));
  const g = rate(mindFor(bot('genius')));
  assert.ok(f < s && s < g, `${f} ${s} ${g}`);
  assert.ok(g < 0.96);
});

test('decide: same match and question give the same move (resume replays it)', () => {
  const m = mindFor(bot('scholar'));
  assert.deepEqual(decide(m, { seed: 'play1:4', limitMs: 15000 }), decide(m, { seed: 'play1:4', limitMs: 15000 }));
});

test('decide: answers inside the time limit, or run out of time', () => {
  for (const t of ['freshman', 'scholar', 'genius'] as BotType[]) {
    for (let i = 0; i < 300; i++) {
      const mv = decide(mindFor(bot(t, 'showoff')), { seed: `s${i}`, limitMs: 10000 });
      if (mv.ms != null) assert.ok(mv.ms > 0 && mv.ms < 10000);
      else assert.equal(mv.right, false);
    }
  }
});

test('speed: a Genius answers faster than a Freshman on average', () => {
  const avg = (t: BotType) => {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < 1000; i++) {
      const mv = decide(mindFor(bot(t)), { seed: `t${i}`, limitMs: 20000 });
      if (mv.ms != null) {
        sum += mv.ms;
        n++;
      }
    }
    return sum / n;
  };
  assert.ok(avg('genius') < avg('scholar') && avg('scholar') < avg('freshman'));
});

test('close matches: a rival far ahead eases off, far behind tries harder', () => {
  const m = mindFor(bot('scholar'));
  const even = chanceOf(m, { seed: 'a', limitMs: 1 });
  assert.ok(chanceOf(m, { seed: 'a', limitMs: 1, gap: 0.6 }) < even);
  assert.ok(chanceOf(m, { seed: 'a', limitMs: 1, gap: -0.6 }) > even);
});

test('form: 3 right is on fire, 3 misses tilts; a Hothead after 2; a Cool head never tilts; one right ends a tilt', () => {
  let m = mindFor(bot('scholar', 'cheer'));
  m = afterAnswer(afterAnswer(afterAnswer(m, true), true), true);
  assert.equal(moodOf(m), 'fire');
  m = afterAnswer(afterAnswer(afterAnswer(m, false), false), false);
  assert.equal(moodOf(m), 'tilt');
  assert.equal(moodOf(afterAnswer(m, true)), null);
  let hot = mindFor(bot('scholar', 'hot'));
  hot = afterAnswer(afterAnswer(hot, false), false);
  assert.equal(moodOf(hot), 'tilt');
  let cool = mindFor(bot('scholar', 'cool'));
  for (let i = 0; i < 6; i++) cool = afterAnswer(cool, false);
  assert.equal(moodOf(cool), null);
  const fire = afterAnswer(afterAnswer(afterAnswer(mindFor(bot('scholar')), true), true), true);
  assert.ok(chanceOf(fire, { seed: 'a', limitMs: 1 }) > chanceOf(mindFor(bot('scholar')), { seed: 'a', limitMs: 1 }));
});

test('clues: Genius usually on 3 and rarely on 1 or 2; Scholar 3 to 4; Freshman late or never', () => {
  const dist = (t: BotType) => {
    const d: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
      const at = solveClue(mindFor(bot(t)), { seed: `c${i}` }).at;
      d[String(at)] = (d[String(at)] ?? 0) + 1;
    }
    return d;
  };
  const g = dist('genius');
  assert.ok(((g['1'] ?? 0) + (g['2'] ?? 0)) / 2000 < 0.15);
  assert.ok((g['3'] ?? 0) / 2000 > 0.45);
  const s = dist('scholar');
  assert.ok(((s['3'] ?? 0) + (s['4'] ?? 0)) / 2000 > 0.6);
  const f = dist('freshman');
  assert.ok(((f['5'] ?? 0) + (f['6'] ?? 0) + (f['null'] ?? 0)) / 2000 > 0.95);
  assert.ok((f['null'] ?? 0) > 0);
});

test('clues: wrong guesses come before the solving clue', () => {
  for (let i = 0; i < 500; i++) {
    const r = solveClue(mindFor(bot('freshman', 'showoff')), { seed: `w${i}` });
    for (const c of r.wrong) assert.ok(c >= 1 && c < (r.at ?? 7));
  }
});
