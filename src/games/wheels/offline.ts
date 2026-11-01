// The Wheels of Chaos Offline (pass the phone, WC1): the full game on one phone, 2 to 4 players, no teams
// (TM1). Cycles (acts) of 3, 2 and 2 rounds of turns, each cycle ending in a Boss Round, played here as
// turn-based swipes. Reaching the target ends the game at once; otherwise the best score after Boss Round 3 wins
// (equal top scores draw). The tarot cards were removed (#39a, Yazan 2026-11-01): Redemption is offered to last
// place once an act, and the Star and Sun are gone.
import {
  spinField, startTurn, stepTurn, turnPoints,
  type Bank, type FieldKey, type Mix, type QResult, type Question, type Rng, type Target, type Turn, type TurnEvent,
} from './core';
import { shuffle } from '../engine/random';

export const CYCLES = [3, 2, 2];

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

/**
 * WC19: one of Yazan's written rounds of 10 for the field, in his order; rounds not yet played this game come
 * first, and the last one played never repeats straight away. A bank without rounds draws 10 easy to medium.
 */
export function redemptionItems(bank: FullBank, field: FieldKey, rng: Rng, used: readonly number[] = []): { items: Question[]; round: number | null } {
  const tf = bank.redemption.filter((q) => q.style === 'tf');
  const mine = tf.filter((q) => q.field === field && q.round != null);
  const rounds = [...new Set(mine.map((q) => q.round!))];
  if (rounds.length) {
    const fresh = rounds.filter((r) => !used.includes(r));
    const last = used[used.length - 1];
    const from = fresh.length ? fresh : rounds.length > 1 ? rounds.filter((r) => r !== last) : rounds;
    const round = from[Math.floor(rng() * from.length)];
    return { items: mine.filter((q) => q.round === round).slice(0, REDEMPTION_ITEMS), round };
  }
  const easy = tf.filter((q) => q.difficulty === 'easy' || q.difficulty === 'medium');
  const pools = [easy.filter((q) => q.field === field), tf.filter((q) => q.field === field), easy, tf];
  const pool = pools.find((p) => p.length) ?? [];
  const out: Question[] = [];
  while (pool.length && out.length < REDEMPTION_ITEMS) out.push(...shuffle(pool, rng));
  return { items: out.slice(0, REDEMPTION_ITEMS), round: null };
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
  | { k: 'turn'; seat: number; points: number }
  | { k: 'redemption'; seat: number; points: number; field: FieldKey }
  | { k: 'boss'; winners: number[]; bonus: number; points: Record<number, number> }
  | { k: 'left'; seat: number };

export type Phase = 'redemptionOffer' | 'turn' | 'redemption' | 'turnOver' | 'boss' | 'bossOver' | 'done';

export type OfflineGame = {
  seats: number;
  target: Target;
  mix: Mix;
  active: number[];
  scores: number[];
  cycle: number;
  round: number;
  roundsPlayed: number;
  order: number[];
  phase: Phase;
  /** Index into order of the turn being played. */
  turnAt: number;
  turn: Turn | null;
  redemption: Redemption | null;
  boss: Boss | null;
  /** The cycle Redemption was last used in: once an act for the whole game (Yazan 2026-11-01). */
  redCycle: number | null;
  /** WC19: Redemption rounds played this game, per field, in order. */
  redRounds?: Partial<Record<FieldKey, number[]>>;
  seen: string[];
  answers: { seat: number; r: QResult }[];
  log: Log[];
  result: { winners: number[]; draw: boolean } | null;
};

export type OfflineEvent =
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
    seats, target, mix, active: Array.from({ length: seats }, (_, i) => i), scores: Array(seats).fill(0),
    cycle: 0, round: 0, roundsPlayed: 0, order: [], phase: 'turn',
    turnAt: 0, turn: null, redemption: null, boss: null, redCycle: null, seen: [], answers: [], log: [], result: null,
  };
  return beginRound(g, bank, rng);
}

/**
 * A game saved before the tarot cards were removed (#39a): drops the card parts, keeps The World's act as the
 * Redemption act, and a round caught in its card window starts its turns.
 */
export function upgradeSaved(saved: OfflineGame, bank: FullBank, rng: Rng): OfflineGame {
  const old = saved as OfflineGame & { hands?: unknown; worldCycle?: number | null; phase: string };
  if (!('hands' in old)) return saved;
  const { hands: _h, worldCycle, init: _i, attacks: _a, chain: _c, skipped: _s, sun: _u, star: _t, ...rest } = old as unknown as Record<string, unknown> & { worldCycle?: number | null };
  const g = { ...(rest as unknown as OfflineGame), redCycle: worldCycle ?? null, log: (old.log as { k: string }[]).filter((l) => ['turn', 'redemption', 'boss', 'left'].includes(l.k)) as Log[] };
  const was = old.phase as string;
  if (was === 'initiation' || was === 'reaction') return startSeatTurn({ ...g, phase: 'turn', turnAt: -1, turn: null, redemption: null }, bank, rng, 1);
  return g;
}

/** The seat holding the phone now, or null between steps. */
export function actor(g: OfflineGame): number | null {
  switch (g.phase) {
    case 'redemptionOffer': case 'turn': case 'redemption': case 'turnOver': return g.order[g.turnAt] ?? null;
    case 'boss': return g.boss ? g.boss.order[g.boss.at] : null;
    default: return null;
  }
}

export const isLowest = (g: OfflineGame, seat: number) => g.scores[seat] === Math.min(...g.active.map((s) => g.scores[s]));

/** Last place (ties allowed), a round already played, and not used yet this act by anyone (Yazan 2026-11-01). */
export const canRedeem = (g: OfflineGame, seat: number) =>
  g.redCycle !== g.cycle && g.roundsPlayed >= 1 && isLowest(g, seat);

function finish(g: OfflineGame, pool: number[]): OfflineGame {
  const top = Math.max(...pool.map((s) => g.scores[s]));
  const winners = pool.filter((s) => g.scores[s] === top);
  return { ...g, phase: 'done', turn: null, result: { winners, draw: winners.length > 1 } };
}

/** The target ends the game the moment anyone reaches it (spec 2.2). */
function checkTarget(g: OfflineGame): OfflineGame {
  const reached = g.active.filter((s) => g.scores[s] >= g.target);
  return reached.length ? finish(g, reached) : g;
}

function beginRound(g: OfflineGame, bank: FullBank, rng: Rng): OfflineGame {
  const order = shuffle(g.active, rng);
  return startSeatTurn({ ...g, order, turnAt: -1, turn: null, redemption: null }, bank, rng, 1);
}

/** The next turn in this round's order (step 1), skipping departed seats. */
function startSeatTurn(g: OfflineGame, bank: FullBank, rng: Rng, step: number): OfflineGame {
  let at = g.turnAt + step;
  while (at < g.order.length && !g.active.includes(g.order[at])) at++;
  const s = { ...g, turnAt: at, turn: null, redemption: null };
  if (at >= g.order.length) return endRound(s, bank, rng);
  const seat = g.order[at];
  if (canRedeem(s, seat)) return { ...s, phase: 'redemptionOffer' };
  return playTurn(s, seat, bank, rng);
}

function playTurn(g: OfflineGame, _seat: number, bank: FullBank, rng: Rng): OfflineGame {
  const turn = startTurn(bank, g.seen, rng, { mix: g.mix });
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
export function closeBoss(g: OfflineGame): OfflineGame {
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
  switch (s.phase) {
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
    case 'REDEEM': {
      if (g.phase !== 'redemptionOffer') return g;
      const seat = g.order[g.turnAt];
      if (!e.use) return playTurn(g, seat, bank, rng);
      const field = spinField(rng, g.mix);
      const used = g.redRounds?.[field] ?? [];
      const { items, round } = redemptionItems(bank, field, rng, used);
      const redemption: Redemption = { seat, field, items, index: 0, right: 0, answers: [], phase: 'reveal', until: null, pausedAt: null };
      const redRounds = round == null ? g.redRounds : { ...g.redRounds, [field]: [...used, round] };
      return { ...g, phase: 'redemption', redCycle: g.cycle, redemption, redRounds };
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
        log: [...g.log, { k: 'turn', seat, points }],
      });
    }
    case 'RED': {
      if (g.phase !== 'redemption' || !g.redemption) return g;
      const r = stepRedemption(g.redemption, e.e);
      if (r === g.redemption) return g;
      if (r.phase !== 'over') return { ...g, redemption: r };
      const points = r.right;
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
