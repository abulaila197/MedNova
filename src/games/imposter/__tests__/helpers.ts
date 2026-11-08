import assert from 'node:assert/strict';
import bankJson from './sample-pairs.json';
import { RULES } from '../engine/constants';
import { createGame, reduce, type Env } from '../engine/engine';
import { createProfanityChecker } from '../engine/profanity';
import type { GameAction, GameEvent, GameState, Mode, WordBank } from '../engine/types';

export const bank = bankJson as unknown as WordBank;
// fake blocklist: no real profanity in the tests. "anus" is listed here only to prove the allowlist wins.
export const profanity = createProfanityChecker({ blocklist: ['foobar', 'bazqux', 'anus', 'anal'], allowlist: ['anus'] });

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLUE_WORDS = ['kappa', 'lambda', 'sigma', 'omega', 'delta', 'gamma', 'theta', 'iota', 'zeta', 'alpha', 'beta',
  'omicron', 'upsilon', 'epsilon', 'kilo', 'lima', 'mike', 'nova', 'oscar', 'papa', 'quebec', 'romeo', 'tango', 'victor',
  'whiskey', 'yankee', 'zulu', 'bravo', 'charlie', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'sierra',
  'uniform', 'xray', 'ranger', 'falcon', 'tiger', 'eagle', 'cobra', 'viper', 'panda', 'koala', 'otter', 'bison'];

export class Sim {
  state: GameState;
  now = 1_000_000;
  events: GameEvent[] = [];
  rng: () => number;
  private clueCounter = 0;
  bank: WordBank = bank;
  constructor(opts: { mode?: Mode; n?: number; seed?: number; bank?: WordBank } = {}) {
    if (opts.bank) this.bank = opts.bank;
    const mode = opts.mode ?? 'online';
    const n = opts.n ?? 4;
    this.rng = mulberry32(opts.seed ?? 1);
    this.state = createGame({ roomId: 'room', mode, host: { id: 'p1', name: 'P1' } });
    for (let i = 2; i <= n; i++) this.must({ type: 'JOIN', playerId: `p${i}`, name: `P${i}` });
  }
  env(): Env {
    return { now: this.now, rng: this.rng, bank: this.bank, profanity };
  }
  act(a: GameAction) {
    const res = reduce(this.state, a, this.env());
    this.state = res.state;
    this.events.push(...res.events);
    return res;
  }
  must(a: GameAction) {
    const res = this.act(a);
    assert.equal(res.error, null, `${a.type} failed: ${res.error?.code}`);
    return res;
  }
  advance(ms: number) {
    this.now += ms;
    return this.act({ type: 'TICK' });
  }
  get round() { return this.state.round!; }
  get phase() { return this.state.phase; }
  ids() { return this.state.players.map((p) => p.id); }
  nonImposters() { return this.round.participants.filter((id) => id !== this.round.imposterId); }
  score(id: string) { return this.state.players.find((p) => p.id === id)!.score; }
  nextClueWord() { return CLUE_WORDS[this.clueCounter++ % CLUE_WORDS.length]; }

  startOnline(subtype: 'clinical' | 'basic' | 'mixed' = 'clinical', rounds = 2) {
    this.must({ type: 'START_MATCH', playerId: 'p1', config: { subtype, rounds } });
    this.ackAll();
  }
  /** Online: the word is shown for a fixed 10 s. Offline: every player taps "done" after hold-to-view. */
  ackAll() {
    if (this.state.mode === 'online') { this.advance(RULES.wordRevealMs); return; }
    for (const id of this.round.participants) this.must({ type: 'ACK_WORD', playerId: id });
  }
  /** Everybody types a valid clue, in order, with the 3 s pauses, until the clue phase is over. */
  playClues() {
    let guard = 0;
    while (this.phase.kind === 'clue' && guard++ < 200) {
      const ph = this.phase;
      if (ph.stage === 'typing') {
        this.must({ type: 'SUBMIT_CLUE', playerId: this.round.order[ph.slot], text: this.nextClueWord() });
      } else this.advance(3000);
    }
  }
  /** Both obligatory turns, then everybody taps "Vote now". Leaves the game in the vote phase. */
  toVote() {
    this.playClues();
    assert.equal(this.phase.kind, 'decision');
    for (const id of this.round.participants) this.must({ type: 'DECIDE', playerId: id, choice: 'vote' });
    assert.equal(this.phase.kind, 'vote');
  }
  everybodyVotesImposter(gapMs = 100) {
    const imp = this.round.imposterId;
    const others = this.nonImposters();
    for (const id of others) { this.must({ type: 'CAST_VOTE', playerId: id, target: imp }); this.now += gapMs; }
    this.must({ type: 'CAST_VOTE', playerId: imp, target: others[0] });
  }
  majorityWord() {
    const r = this.round;
    return r.pair[r.imposterSide === 'a' ? 'b' : 'a'].word;
  }
}

/** Plays one complete online round to the end: caught, redemption answered correctly. */
export function playRoundCaught(sim: Sim, guess?: string) {
  if (sim.phase.kind === 'wordReveal') sim.ackAll();
  sim.toVote();
  sim.everybodyVotesImposter();
  sim.advance(5000);
  assert.equal(String(sim.phase.kind), 'redemption');
  sim.must({ type: 'SUBMIT_GUESS', playerId: sim.round.imposterId, text: guess ?? sim.majorityWord() });
  assert.equal(String(sim.phase.kind), 'roundResult');
}
