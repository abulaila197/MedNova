import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { GameAction } from '../engine/types';
import { Sim, mulberry32 } from './helpers';

/** Random (often illegal) actions and random time jumps: the engine must never throw, scores must never drop,
 *  and every match must reach its end. */
test('fuzz: 300 random online matches never throw, never lose points, and always finish', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rnd = mulberry32(seed * 7919);
    const n = 3 + Math.floor(rnd() * 4);
    const sim = new Sim({ n, seed });
    sim.must({ type: 'START_MATCH', playerId: 'p1', config: { subtype: 'mixed', rounds: 1 + Math.floor(rnd() * 3) } });
    const last: Record<string, number> = {};
    for (let i = 0; i < 4000 && sim.phase.kind !== 'matchEnd'; i++) {
      const ids = sim.ids();
      const pid = ids[Math.floor(rnd() * ids.length)];
      const tgt = ids[Math.floor(rnd() * ids.length)];
      const words = ['alpha', 'foobar', 'tb', 'x y', sim.nextClueWord(), sim.nextClueWord()];
      const choices: GameAction[] = [
        { type: 'ACK_WORD', playerId: pid },
        { type: 'SUBMIT_CLUE', playerId: sim.state.round ? sim.state.round.order[Math.floor(rnd() * sim.state.round.order.length)] : pid, text: words[Math.floor(rnd() * words.length)] },
        { type: 'DECIDE', playerId: pid, choice: rnd() < 0.5 ? 'vote' : 'extra' },
        { type: 'CAST_VOTE', playerId: pid, target: tgt },
        { type: 'SUBMIT_GUESS', playerId: pid, text: words[Math.floor(rnd() * words.length)] },
        { type: 'NEXT_ROUND', playerId: sim.state.hostId },
        { type: 'PLAYER_DISCONNECTED', playerId: pid },
        { type: 'PLAYER_RECONNECTED', playerId: pid },
        { type: 'JOIN', playerId: `x${Math.floor(rnd() * 3)}`, name: 'X' },
      ];
      sim.act(choices[Math.floor(rnd() * choices.length)]);
      if (rnd() < 0.5) sim.advance(Math.floor(rnd() * 12_000));
      for (const p of sim.state.players) {
        assert.ok(p.score >= (last[p.id] ?? 0), `score dropped (seed ${seed})`);
        last[p.id] = p.score;
      }
    }
    // let any running timers finish: everything must end by itself
    for (let k = 0; k < 400 && sim.phase.kind !== 'matchEnd'; k++) sim.advance(20_000);
    assert.equal(String(sim.phase.kind), 'matchEnd', `match did not finish (seed ${seed}, phase ${sim.phase.kind})`);
  }
});
