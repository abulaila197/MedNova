/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import type { Bot, BotType } from '../../../bots/types';
import { judge } from '../core';
import { actor, type FullBank } from '../offline';
import { rightAnswer, WC_COUNTDOWN_MS, WheelsShow, wrongAnswer } from '../rivals';
import { rng } from '../../../bots/rng';

const bank = JSON.parse(readFileSync('src/games/wheels/data/bank.json', 'utf8')) as FullBank;
const rival = (type: BotType, name: string): Bot => ({ id: `bot:${type}:${name}`, type, name, character: 'yara', level: 1, persona: 'cheer' });
const show = (rivals: Bot[], playId = 'w1') =>
  new WheelsShow({ playId, items: [1], you: { name: 'You', character: 'yara', team: null }, rivals, settings: {}, playerLevel: 1, bank, target: 25, mix: 'mixed' });

test('wheels rivals: a wrong answer is wrong and a right one right, for every style', () => {
  const r = rng('w');
  for (const q of bank.questions.slice(0, 400)) {
    assert.equal(judge(q, rightAnswer(q)), true, q.id);
    assert.equal(judge(q, wrongAnswer(q, 0, r)), false, q.id);
    assert.equal(judge(q, wrongAnswer(q, 2, r)), false, q.id);
  }
});

test('wheels show: the rivals play their turns on their own and the show reaches the final curtain', () => {
  const s = show([rival('genius', 'Omar'), rival('scholar', 'Lena'), rival('freshman', 'Sami')]);
  assert.equal(s.state(1000).phase, 'countdown');
  let st = s.state(WC_COUNTDOWN_MS + 100);
  assert.equal(st.phase, 'case');
  // You never touch the phone: the deadlines carry your turns (a timed-out answer); the rivals answer at their pace.
  const phases = new Set<string>();
  let t = WC_COUNTDOWN_MS;
  for (let i = 0; i < 20_000 && s.game.phase !== 'done'; i++) {
    t += 1000;
    s.sync(t);
    phases.add(s.game.phase);
  }
  assert.equal(s.game.phase, 'done', 'the show ended');
  assert.ok(t < 60 * 60_000, `took ${Math.round(t / 60000)} min`);
  assert.ok(phases.has('turn') && phases.has('boss'));
  const scores = s.game.scores;
  assert.equal(scores[0], 0, 'you answered nothing');
  assert.ok(Math.max(...scores) >= 25, `someone reached the target: ${scores.join(',')}`);
  st = s.state(t + 10_000);
  assert.equal(st.phase, 'done');
  assert.equal(st.players.find((p) => p.name === 'Omar')!.rank, 1 + scores.slice(1).filter((x) => x > scores[1]).length);
  // The same seed plays the same show.
  const again = show([rival('genius', 'Omar'), rival('scholar', 'Lena'), rival('freshman', 'Sami')]);
  again.sync(t);
  assert.deepEqual(again.game.scores, scores);
});

test('wheels show: your moves count, the Boss Round takes your swipes and closes early when every deck is done', () => {
  const s = show([rival('genius', 'Omar')], 'w2');
  let t = WC_COUNTDOWN_MS;
  let answered = 0;
  let swiped = false;
  for (let i = 0; i < 20_000 && s.game.phase !== 'done'; i++) {
    t += 500;
    s.sync(t);
    const g = s.game;
    if (g.phase === 'turn' && actor(g) === 0 && g.turn) {
      if (g.turn.phase === 'reveal') s.move(t, { type: 'GO' });
      else if (g.turn.phase === 'question') {
        s.move(t, { type: 'ANSWER', answer: rightAnswer(g.turn.question) });
        answered++;
      }
    } else if (g.phase === 'redemptionOffer' && actor(g) === 0) s.move(t, { type: 'REDEEM', use: false });
    else if (g.phase === 'boss' && g.boss?.phase === 'playing' && !swiped) {
      for (const ix of g.boss.decks[0]) s.swipe(t, g.boss.items[ix].fits);
      swiped = true;
      assert.equal(s.swipesOf(0, t).length, g.boss.items.length);
    }
  }
  assert.equal(s.game.phase, 'done');
  assert.ok(answered > 0);
  assert.ok(s.game.scores[0] >= 25 || s.game.scores[1] >= 25);
});
