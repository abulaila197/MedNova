/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clock } from '../../engine/clock';
import { cluesShown, conquerorShown } from '../shown';

// What the online screen drew from the clock before (OnlinePlay + atlas Top + Countdown + HoldPage + Clue).
function drawn(sv: number, st: Parameters<typeof conquerorShown>[1] & object, seat: number) {
  const o = st.state;
  const due = o ? o.deadline : st.phase_ends_at;
  const nudge = due != null && sv >= due + seat * 1500;
  if (!o) return JSON.stringify([Math.max(1, Math.ceil(Math.max(0, st.phase_ends_at - sv) / 1000)), nudge]);
  const seconds = o.deadline ? Math.max(0, (o.deadline - sv) / 1000) : null;
  const hold = o.holds.find((h) => h.until > sv);
  const hs = hold ? Math.max(0, (hold.until - sv) / 1000) : null;
  const clue = o.m.phase === 'versus' && o.m.versus?.style === 'clue' ? cluesShown(Math.max(0, sv - o.started)) : null;
  return JSON.stringify([seconds == null ? null : [clock(seconds * 1000, { down: true }), seconds <= 5], hold?.until ?? null, hs == null ? null : clock(hs * 1000, { down: true }), clue, nudge]);
}

test('conquerorShown: the screen redraws whenever anything it draws from the clock changes (250 ms ticks)', () => {
  const started = 1_000_037;
  const cases = [
    { phase: 'countdown', phase_ends_at: started + 7_311, state: null },
    { phase: 'case', phase_ends_at: 0, state: { m: { phase: 'versus', versus: { style: 'clue' } }, deadline: started + 41_123, started, holds: [] } },
    { phase: 'case', phase_ends_at: 0, state: { m: { phase: 'solo_play' }, deadline: started + 23_456, started, holds: [{ until: started + 9_876 }, { until: started + 15_432 }] } },
    { phase: 'case', phase_ends_at: 0, state: { m: { phase: 'moves' }, deadline: null, started, holds: [] } },
  ];
  for (const st of cases)
    for (const seat of [0, 2])
      for (let sv = started - 3000; sv < started + 50_000; sv += 250) {
        const a = drawn(sv, st, seat);
        const b = drawn(sv + 250, st, seat);
        if (a !== b) assert.notEqual(conquerorShown(sv, st), conquerorShown(sv + 250, st), `${st.state?.m.phase ?? 'countdown'} at ${sv - started}`);
      }
});

test('cluesShown: a new clue every 8 s, at most 4 (same as the server)', () => {
  assert.equal(cluesShown(0), 1);
  assert.equal(cluesShown(7_999), 1);
  assert.equal(cluesShown(8_000), 2);
  assert.equal(cluesShown(24_000), 4);
  assert.equal(cluesShown(90_000), 4);
});
