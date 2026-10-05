// The Wheels of Chaos Offline (pass the phone, WC1): the full game on one phone, 2 to 4 players, no teams
// (TM1). Cycles of 3, 2 and 2 rounds, each round opening with a card window (Initiation, then each
// declared attack resolved in order through its reaction chain) and each cycle ending in a Boss Round,
// played here as turn-based swipes. Reaching the target ends the game at once; otherwise the best score
// after Boss Round 3 wins (equal top scores draw). Ported from game.py, with WC2 to WC5.
import {
  shuffle, spinField, startTurn, stepTurn, turnPoints,
  type Bank, type FieldKey, type Mix, type QResult, type Question, type Rng, type Target, type Turn, type TurnEvent,
} from './core';
import { deal, mirrorSwap, playable, react, startChain, targetsFor, TOWER_DAMAGE, type Attack, type Card, type Chain, type Play, type Reaction } from './cards';

export const CYCLES = [3, 2, 2];
export const MAX_PLAYS = 2; // per seat per Initiation (spec 8.1)

export const BOSS_ITEMS = 30;
export const BOSS_MS = 30_000;
export const BOSS_RIGHT = 2;
export const BOSS_WRONG = -1;
export const BOSS_BONUS = 20;

export const REDEMPTION_ITEMS = 10;
export const REDEMPTION_MS = 20_000;

export type BossSet = { id: string; field: FieldKey; category: string; items: { label: string; fits: boolean }[] };
/** Redemption has its own true/false set, apart from the normal-turn bank (WC13). */
export type FullBank = Bank & { boss: BossSet[]; redemption: Question[] };

// ---------------------------------------------------------------- Redemption (spec 6, WC3)

export type Redemption = {
  seat: number;
  field: FieldKey;
  items: Question[];
  index: number;
  right: number;
  answers: (boolean | null)[];
  phase: 'reveal' | 'playing' | 'over';
  until: number | null;
  pausedAt: number | null;
};

/** 10 true/false from one field, easy to medium; the pool repeats while the bank is still small. */
function redemptionItems(bank: FullBank, field: FieldKey, rng: Rng): Question[] {
  const tf = bank.redemption.filter((q) => q.style === 'tf');
  const easy = tf.filter((q) => q.difficulty === 'easy' || q.difficulty === 'medium');
  const pools = [easy.filter((q) => q.field === field), tf.filter((q) => q.field === field), easy, tf];
  const pool = pools.find((p) => p.length) ?? [];
  const out: Question[] = [];
  while (pool.length && out.length < REDEMPTION_ITEMS) out.push(...shuffle(pool, rng));
  return out.slice(0, REDEMPTION_ITEMS);
}

export type RedemptionEvent = { type: 'GO'; now: number } | { type: 'ANSWER'; value: boolean; now: number } | { type: 'TICK'; now: number };

function stepRedemption(r: Redemption, e: RedemptionEvent): Redemption {
  if (r.phase === 'over' || r.pausedAt != null) return r;
  if (e.type === 'GO') return r.phase === 'reveal' ? { ...r, phase: 'playing', until: e.now + REDEMPTION_MS } : r;
  if (r.phase !== 'playing') return r;
  if (e.type === 'TICK') return r.until != null && e.now >= r.until ? { ...r, phase: 'over', until: null } : r;
  const q = r.items[r.index];
  const ok = q.style === 'tf' && q.answer === e.value;
  const index = r.index + 1;
  return { ...r, index, right: r.right + (ok ? 1 : 0), answers: [...r.answers, e.value], phase: index >= r.items.length ? 'over' : 'playing' };
}

// ---------------------------------------------------------------- Boss Round (spec 5), turn-based offline

export type Boss = {
  field: FieldKey;
  category: string;
  items: { label: string; fits: boolean }[];
  order: number[];
  /** Index into order of the seat swiping now. */
  at: number;
  /** Each seat's own item order and the swipes they reached. */
  decks: Record<number, number[]>;
  swipes: Record<number, boolean[]>;
  phase: 'ready' | 'playing';
  until: number | null;
  pausedAt: number | null;
};

export type BossEvent = { type: 'GO'; now: number } | { type: 'SWIPE'; fits: boolean; now: number } | { type: 'TICK'; now: number };

export function bossPoints(b: Boss, seat: number): number {
  const deck = b.decks[seat] ?? [];
  return (b.swipes[seat] ?? []).reduce((a, s, i) => a + (b.items[deck[i]].fits === s ? BOSS_RIGHT : BOSS_WRONG), 0);
}

// ---------------------------------------------------------------- the game

export type Log =
  | { k: 'play'; seat: number; card: Card; target?: number }
  | { k: 'react'; seat: number; card: Reaction; to?: number }
  | { k: 'hit'; seat: number; card: 'tower' | 'moon'; loss: number }
  | { k: 'cancel'; seat: number; card: 'tower' | 'moon' }
  | { k: 'skipped'; seat: number }
  | { k: 'turn'; seat: number; points: number; sun: boolean }
  | { k: 'redemption'; seat: number; points: number; field: FieldKey }
  | { k: 'boss'; winners: number[]; bonus: number; points: Record<number, number> }
  | { k: 'left'; seat: number };

export type Phase = 'initiation' | 'reaction' | 'redemptionOffer' | 'turn' | 'redemption' | 'turnOver' | 'boss' | 'bossOver' | 'done';

export type OfflineGame = {
  seats: number;
  target: Target;
  mix: Mix;
  active: number[];
  hands: Card[][];
  scores: number[];
  cycle: number;
  round: number;
  roundsPlayed: number;
  order: number[];
  phase: Phase;
  /** Initiation: index into order and plays used by that seat. */
  init: { at: number; plays: number };
  attacks: Attack[];
  chain: Chain | null;
  skipped: number[];
  sun: number[];
  star: number[];
  /** Index into order of the turn being played. */
  turnAt: number;
  turn: Turn | null;
  redemption: Redemption | null;
  boss: Boss | null;
  /** WC2: the cycle The World was last used in. */
  worldCycle: number | null;
  seen: string[];
  answers: { seat: number; r: QResult }[];
  log: Log[];
  result: { winners: number[]; draw: boolean } | null;
};

export type OfflineEvent =
  | { type: 'PLAY'; play: Play }
  | { type: 'PASS' }
  | { type: 'REACT'; choice: Reaction | null; to?: number }
  | { type: 'REDEEM'; use: boolean }
  | { type: 'TURN'; e: TurnEvent }
  | { type: 'RED'; e: RedemptionEvent }
  | { type: 'BOSS'; e: BossEvent }
  | { type: 'NEXT' }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'REMOVE'; seat: number };

export function startOffline(seats: number, target: Target, bank: FullBank, rng: Rng, mix: Mix = 'mixed'): OfflineGame {
  const g: OfflineGame = {
    seats, target, mix, active: Array.from({ length: seats }, (_, i) => i), hands: deal(seats, rng), scores: Array(seats).fill(0),
    cycle: 0, round: 0, roundsPlayed: 0, order: [], phase: 'initiation', init: { at: 0, plays: 0 }, attacks: [], chain: null,
    skipped: [], sun: [], star: [], turnAt: 0, turn: null, redemption: null, boss: null, worldCycle: null, seen: [], answers: [], log: [], result: null,
  };
  // There is a card window before round 1 too (spec 9.1).
  return beginRound(g, bank, rng);
}

/** The seat holding the phone now, or null between steps. */
export function actor(g: OfflineGame): number | null {
  switch (g.phase) {
    case 'initiation': return g.order[g.init.at] ?? null;
    case 'reaction': return g.chain?.holder ?? null;
    case 'redemptionOffer': case 'turn': case 'redemption': case 'turnOver': return g.order[g.turnAt] ?? null;
    case 'boss': return g.boss ? g.boss.order[g.boss.at] : null;
    default: return null;
  }
}

export const isLowest = (g: OfflineGame, seat: number) => g.scores[seat] === Math.min(...g.active.map((s) => g.scores[s]));

/** WC3: holds The World, among the lowest (ties allowed), a round already played; WC2: once a cycle. */
export const canRedeem = (g: OfflineGame, seat: number) =>
  g.hands[seat].includes('world') && g.worldCycle !== g.cycle && g.roundsPlayed >= 1 && isLowest(g, seat);

function finish(g: OfflineGame, pool: number[]): OfflineGame {
  const top = Math.max(...pool.map((s) => g.scores[s]));
  const winners = pool.filter((s) => g.scores[s] === top);
  return { ...g, phase: 'done', turn: null, chain: null, result: { winners, draw: winners.length > 1 } };
}

/** The target ends the game the moment anyone reaches it (spec 2.2). */
function checkTarget(g: OfflineGame): OfflineGame {
  const reached = g.active.filter((s) => g.scores[s] >= g.target);
  return reached.length ? finish(g, reached) : g;
}

function beginRound(g: OfflineGame, bank: FullBank, rng: Rng): OfflineGame {
  const order = shuffle(g.active, rng);
  return nextInitiator({ ...g, order, phase: 'initiation', init: { at: -1, plays: 0 }, attacks: [], chain: null, skipped: [], sun: [], star: [], turnAt: 0, turn: null, redemption: null }, bank, rng);
}

/** Moves Initiation on, skipping seats with nothing they can play. */
function nextInitiator(g: OfflineGame, bank: FullBank, rng: Rng): OfflineGame {
  let at = g.init.at + 1;
  while (at < g.order.length && (!g.active.includes(g.order[at]) || !playable(g.hands, g.order[at], g.active).length)) at++;
  if (at < g.order.length) return { ...g, phase: 'initiation', init: { at, plays: 0 } };
  return nextAttack({ ...g, init: { at, plays: 0 } }, bank, rng);
}

function applyChain(g: OfflineGame, c: Chain): OfflineGame {
  const log: Log[] = [...g.log];
  for (const st of c.steps) {
    if (st.kind === 'magician') log.push({ k: 'react', seat: st.seat, card: 'magician', to: st.to });
    if (st.kind === 'mirror') log.push({ k: 'react', seat: st.seat, card: 'mirror' });
    if (st.kind === 'hermit') log.push({ k: 'react', seat: st.seat, card: 'hermit' }, { k: 'cancel', seat: st.seat, card: c.attack.card });
  }
  const v = c.result?.victim;
  if (v == null) return { ...g, hands: c.hands, log, chain: null };
  if (c.attack.card === 'moon') return { ...g, hands: c.hands, skipped: [...g.skipped, v], log: [...log, { k: 'hit', seat: v, card: 'moon', loss: 0 }], chain: null };
  const scores = [...g.scores];
  const loss = Math.min(TOWER_DAMAGE, scores[v]); // floor at 0
  scores[v] -= loss;
  return { ...g, hands: c.hands, scores, log: [...log, { k: 'hit', seat: v, card: 'tower', loss }], chain: null };
}

/** Batched reactions: each declared attack in order; then the round's turns begin. */
function nextAttack(g: OfflineGame, bank: FullBank, rng: Rng): OfflineGame {
  let s = g;
  while (s.attacks.length) {
    const [a, ...rest] = s.attacks;
    s = { ...s, attacks: rest };
    if (!s.active.includes(a.target) || !s.active.includes(a.by)) continue;
    const chain = startChain(a, s.hands, s.active);
    if (!chain.result) return { ...s, phase: 'reaction', chain };
    s = applyChain(s, chain);
  }
  return startSeatTurn({ ...s, turnAt: -1 }, bank, rng, 1);
}

/** The next turn in this round's order (step 1), skipping Moon-skipped and departed seats. */
function startSeatTurn(g: OfflineGame, bank: FullBank, rng: Rng, step: number): OfflineGame {
  let at = g.turnAt + step;
  let log = g.log;
  while (at < g.order.length && (!g.active.includes(g.order[at]) || g.skipped.includes(g.order[at]))) {
    if (g.active.includes(g.order[at])) log = [...log, { k: 'skipped', seat: g.order[at] }];
    at++;
  }
  const s = { ...g, log, turnAt: at, turn: null, redemption: null };
  if (at >= g.order.length) return endRound(s, bank, rng);
  const seat = g.order[at];
  if (canRedeem(s, seat)) return { ...s, phase: 'redemptionOffer' };
  return playTurn(s, seat, bank, rng);
}

function playTurn(g: OfflineGame, seat: number, bank: FullBank, rng: Rng): OfflineGame {
  const turn = startTurn(bank, g.seen, rng, { star: g.star.includes(seat), sun: g.sun.includes(seat), mix: g.mix });
  return { ...g, phase: 'turn', turn, seen: turn.seen };
}

function endRound(g: OfflineGame, bank: FullBank, rng: Rng): OfflineGame {
  const s = { ...g, roundsPlayed: g.roundsPlayed + 1, round: g.round + 1 };
  if (s.round < CYCLES[s.cycle]) return beginRound(s, bank, rng);
  return startBoss(s, bank, rng);
}

function startBoss(g: OfflineGame, bank: FullBank, rng: Rng): OfflineGame {
  const field = spinField(rng, g.mix);
  const sets = bank.boss.filter((b) => b.field === field);
  const pick = (sets.length ? sets : bank.boss)[Math.floor(rng() * (sets.length || bank.boss.length))];
  const items = shuffle(pick.items, rng).slice(0, BOSS_ITEMS);
  const order = shuffle(g.active, rng);
  const decks: Record<number, number[]> = {};
  for (const s of order) decks[s] = shuffle(items.map((_, i) => i), rng);
  const boss: Boss = { field, category: pick.category, items, order, at: 0, decks, swipes: {}, phase: 'ready', until: null, pausedAt: null };
  return { ...g, phase: 'boss', boss, turn: null, redemption: null };
}

/** Highest Boss points share +20, split evenly and rounded down (spec 5.2). */
function closeBoss(g: OfflineGame): OfflineGame {
  const b = g.boss!;
  const seats = b.order.filter((s) => g.active.includes(s));
  const points: Record<number, number> = {};
  for (const s of seats) points[s] = bossPoints(b, s);
  const top = Math.max(...seats.map((s) => points[s]));
  const winners = seats.filter((s) => points[s] === top);
  const bonus = Math.floor(BOSS_BONUS / winners.length);
  const scores = [...g.scores];
  for (const s of winners) scores[s] += bonus;
  return checkTarget({ ...g, scores, phase: 'bossOver', log: [...g.log, { k: 'boss', winners, bonus, points }] });
}

function stepBoss(g: OfflineGame, e: BossEvent): OfflineGame {
  const b = g.boss!;
  if (b.pausedAt != null) return g;
  if (e.type === 'GO') return b.phase === 'ready' ? { ...g, boss: { ...b, phase: 'playing', until: e.now + BOSS_MS } } : g;
  if (b.phase !== 'playing') return g;
  if (e.type === 'TICK') return b.until != null && e.now >= b.until ? stepBossNext(g) : g;
  const seat = b.order[b.at];
  const mine = [...(b.swipes[seat] ?? []), e.fits];
  const s = { ...g, boss: { ...b, swipes: { ...b.swipes, [seat]: mine } } };
  return mine.length >= b.items.length ? stepBossNext(s) : s;
}

/** The next seat's go, or the results once everyone has swiped. */
function stepBossNext(g: OfflineGame): OfflineGame {
  const b = g.boss!;
  let at = b.at + 1;
  while (at < b.order.length && !g.active.includes(b.order[at])) at++;
  const nb = { ...b, at, phase: 'ready' as const, until: null };
  return at >= b.order.length ? closeBoss({ ...g, boss: nb }) : { ...g, boss: nb };
}

function shiftTimers(g: OfflineGame, e: { type: 'PAUSE' | 'RESUME'; now: number }): OfflineGame {
  const pause = <T extends { pausedAt: number | null; until: number | null }>(x: T): T => {
    if (e.type === 'PAUSE') return x.pausedAt == null ? { ...x, pausedAt: e.now } : x;
    if (x.pausedAt == null) return x;
    return { ...x, pausedAt: null, until: x.until == null ? null : x.until + (e.now - x.pausedAt) };
  };
  return {
    ...g,
    turn: g.turn ? pause(g.turn) : null,
    redemption: g.redemption ? pause(g.redemption) : null,
    boss: g.boss ? pause(g.boss) : null,
  };
}

function removeSeat(g: OfflineGame, seat: number, bank: FullBank, rng: Rng): OfflineGame {
  if (!g.active.includes(seat)) return g;
  const was = actor(g);
  let s: OfflineGame = { ...g, active: g.active.filter((x) => x !== seat), log: [...g.log, { k: 'left', seat }] };
  if (s.active.length === 1) return finish(s, s.active); // the last one standing wins (spec 9.2)
  s = { ...s, attacks: s.attacks.filter((a) => a.by !== seat && a.target !== seat) };
  switch (s.phase) {
    case 'initiation':
      return was === seat ? nextInitiator(s, bank, rng) : s;
    case 'reaction': {
      const a = s.chain!.attack;
      const involved = a.by === seat || s.chain!.steps.some((st) => st.seat === seat || (st.kind === 'magician' && st.to === seat));
      return involved ? nextAttack({ ...s, chain: null }, bank, rng) : s;
    }
    case 'redemptionOffer': case 'turn': case 'redemption': case 'turnOver':
      return was === seat ? startSeatTurn(s, bank, rng, 1) : s;
    case 'boss':
      return was === seat ? stepBossNext(s) : s;
    case 'bossOver': case 'done':
      return s;
  }
}

export function stepOffline(g: OfflineGame, e: OfflineEvent, bank: FullBank, rng: Rng): OfflineGame {
  if (g.phase === 'done') return g;
  switch (e.type) {
    case 'REMOVE':
      return removeSeat(g, e.seat, bank, rng);
    case 'PAUSE': case 'RESUME':
      return shiftTimers(g, e);
    case 'PLAY': {
      if (g.phase !== 'initiation' || g.init.plays >= MAX_PLAYS) return g;
      const seat = g.order[g.init.at];
      const p = e.play;
      if (!playable(g.hands, seat, g.active).includes(p.card)) return g;
      if ('target' in p && !targetsFor(g.hands, seat, p.card, g.active).includes(p.target)) return g;
      let hands = g.hands.map((h, i) => (i === seat ? h.filter((c) => c !== p.card) : h));
      let s: OfflineGame = { ...g, hands, init: { ...g.init, plays: g.init.plays + 1 }, log: [...g.log, { k: 'play', seat, card: p.card, target: 'target' in p ? p.target : undefined }] };
      if (p.card === 'star') s = { ...s, star: [...s.star, seat] };
      if (p.card === 'sun') s = { ...s, sun: [...s.sun, seat] };
      if (p.card === 'tower' || p.card === 'moon') s = { ...s, attacks: [...s.attacks, { by: seat, card: p.card, target: p.target }] };
      if (p.card === 'mirror') {
        if (!hands[seat].includes(p.give)) return g;
        hands = mirrorSwap(g.hands, seat, p.target, p.give, rng).hands;
        s = { ...s, hands };
      }
      // Done once out of plays or out of playable cards.
      if (s.init.plays >= MAX_PLAYS || !playable(s.hands, seat, s.active).length) return nextInitiator(s, bank, rng);
      return s;
    }
    case 'PASS':
      return g.phase === 'initiation' ? nextInitiator(g, bank, rng) : g;
    case 'REACT': {
      if (g.phase !== 'reaction' || !g.chain) return g;
      const chain = react(g.chain, e.choice, g.active, e.to);
      if (chain === g.chain) return g;
      if (!chain.result) return { ...g, chain };
      return nextAttack(applyChain(g, chain), bank, rng);
    }
    case 'REDEEM': {
      if (g.phase !== 'redemptionOffer') return g;
      const seat = g.order[g.turnAt];
      if (!e.use) return playTurn(g, seat, bank, rng);
      const field = spinField(rng, g.mix);
      const redemption: Redemption = { seat, field, items: redemptionItems(bank, field, rng), index: 0, right: 0, answers: [], phase: 'reveal', until: null, pausedAt: null };
      return { ...g, phase: 'redemption', worldCycle: g.cycle, redemption };
    }
    case 'TURN': {
      if (g.phase !== 'turn' || !g.turn) return g;
      const turn = stepTurn(g.turn, e.e, bank, rng);
      if (turn === g.turn) return g;
      const seat = g.order[g.turnAt];
      if (turn.phase !== 'over') return { ...g, turn, seen: turn.seen };
      const points = turnPoints(turn);
      const scores = [...g.scores];
      scores[seat] += points;
      return checkTarget({
        ...g, turn, seen: turn.seen, scores, phase: 'turnOver',
        answers: [...g.answers, ...turn.results.map((r) => ({ seat, r }))],
        log: [...g.log, { k: 'turn', seat, points, sun: turn.sun }],
      });
    }
    case 'RED': {
      if (g.phase !== 'redemption' || !g.redemption) return g;
      const r = stepRedemption(g.redemption, e.e);
      if (r === g.redemption) return g;
      if (r.phase !== 'over') return { ...g, redemption: r };
      // The Sun doubles whatever the turn earns, Redemption included.
      const points = r.right * (g.sun.includes(r.seat) ? 2 : 1);
      const scores = [...g.scores];
      scores[r.seat] += points;
      return checkTarget({ ...g, redemption: r, scores, phase: 'turnOver', log: [...g.log, { k: 'redemption', seat: r.seat, points, field: r.field }] });
    }
    case 'BOSS':
      return g.phase === 'boss' && g.boss ? stepBoss(g, e.e) : g;
    case 'NEXT':
      if (g.phase === 'turnOver') return startSeatTurn(g, bank, rng, 1);
      if (g.phase === 'bossOver') {
        const cycle = g.cycle + 1;
        if (cycle >= CYCLES.length) return finish({ ...g, boss: null }, g.active);
        return beginRound({ ...g, cycle, round: 0, boss: null }, bank, rng);
      }
      return g;
  }
}

/** Points scored in this cycle's Redemption-free turns are in the log; this is the live table. */
export const standings = (g: OfflineGame) => g.active.map((seat) => ({ seat, score: g.scores[seat] })).sort((a, b) => b.score - a.score);
