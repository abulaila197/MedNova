import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { mergeBoard, passingNames, periodKey, rivalExp } from '../boardMath';
import { BOSS_GAMES, bossOf } from '../boss';
import { revengeLine } from '../revenge';
import { rivalBoost } from '../rewards';

describe('G6 rewards, boss and board', () => {
  it('boosts Vs rivals EXP by the table level only', () => {
    assert.equal(rivalBoost('bots', { botLevel: 'easy' }), 1);
    assert.equal(rivalBoost('bots', { botLevel: 'medium' }), 1.25);
    assert.equal(rivalBoost('bots', { botLevel: 'hard' }), 1.5);
    assert.equal(rivalBoost('solo', { botLevel: 'hard' }), 1);
  });
  it('deals the same Genius boss for a day, in a Vs rivals game, never twice the same game in a row', () => {
    const a = bossOf('2026-11-10');
    assert.deepEqual(a, bossOf('2026-11-10'));
    assert.ok(a.name.length > 1);
    assert.ok(BOSS_GAMES.includes(a.game));
    for (let d = 1; d < 28; d++) {
      const day = `2026-11-${String(d).padStart(2, '0')}`;
      const next = `2026-11-${String(d + 1).padStart(2, '0')}`;
      assert.notEqual(bossOf(day).game, bossOf(next).game, `${day} and ${next}`);
    }
  });
  it('keys periods by ISO week and month', () => {
    assert.equal(periodKey('week', '2026-11-10'), '2026-W46');
    assert.equal(periodKey('week', '2026-01-01'), '2026-W01');
    assert.equal(periodKey('month', '2026-11-10'), '2026-11');
  });
  it('merges rivals into the board, ranks again and keeps my row right', () => {
    const board = { rows: [{ rank: 1, id: 'u1', name: 'Dana', level: 9, exp: 700 }, { rank: 2, id: 'me', name: 'Me', level: 5, exp: 90 }], me: { rank: 2, exp: 90, above: { name: 'Dana', gap: 610 } } };
    const key = periodKey('week', '2026-11-10');
    const rivals = passingNames(key, null).map((p, i) => ({ rank: 0, id: `bot:${p.type}:${p.name}`, name: p.name, level: 5, exp: rivalExp(`bot:${p.type}:${p.name}`, p.type, 5, 'week', key, null) }));
    assert.equal(rivals.length, 6);
    assert.deepEqual(rivals, passingNames(key, null).map((p) => ({ rank: 0, id: `bot:${p.type}:${p.name}`, name: p.name, level: 5, exp: rivalExp(`bot:${p.type}:${p.name}`, p.type, 5, 'week', key, null) })));
    const out = mergeBoard(board, rivals, 'me');
    assert.equal(out.rows.length, 8);
    out.rows.forEach((r, i) => assert.equal(r.rank, i + 1));
    for (let i = 1; i < out.rows.length; i++) assert.ok(out.rows[i - 1].exp >= out.rows[i].exp);
    const mine = out.rows.find((r) => r.id === 'me')!;
    assert.equal(out.me!.rank, mine.rank);
    assert.equal(out.me!.above!.name, out.rows[mine.rank - 2].name);
    // a rival's month points are bigger than its week points, a game board's smaller
    assert.ok(rivalExp('bot:genius:Lottie', 'genius', 5, 'month', '2026-11', null) > rivalExp('bot:genius:Lottie', 'genius', 5, 'week', key, null));
    assert.ok(rivalExp('bot:genius:Lottie', 'genius', 5, 'week', key, 'the-riddler') < 400);
  });
  it('says a revenge line only with a record', () => {
    assert.equal(revengeLine(undefined, 'x'), null);
    const l = revengeLine({ w: 1, l: 0, last: 'won', game: 'the-riddler', settings: {}, at: 0 }, 'x');
    assert.ok(l && l.length > 3);
    assert.ok(l!.endsWith('1–0 to you.'));
    assert.equal(l, revengeLine({ w: 1, l: 0, last: 'won', game: 'the-riddler', settings: {}, at: 0 }, 'x'));
  });
});
