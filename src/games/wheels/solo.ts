// Wheels Solo with acts (Yazan 2026-11-12): the Solo run of turns (core.ts) now ends each act with a Boss Round,
// like Pass the phone, and once a game a turn with a miss can be followed by a Redemption round that wins points back.
// Acts are 3, 2 and 2 turns, then 2 turns each, as in Pass the phone.
import { spinField, startSolo, stepSolo, STYLES, type Mix, type Rng, type SoloEvent, type SoloRun, type Target } from './core';
import {
  BOSS_ITEMS, BOSS_MS, bossBonus, bossPoints, redemptionItems, roundsIn, stepRedemption,
  type Boss, type BossEvent, type FullBank, type Redemption, type RedemptionEvent,
} from './offline';
import { shuffle } from '../engine/random';

/** Solo Boss Round: every 4 Boss points (+2 a right swipe, -1 a wrong one) is +1, up to a fifth of the target. */
export const SOLO_BOSS_PER = 4;
export const soloBossBonus = (target: number, bossPts: number) => Math.min(bossBonus(target), Math.floor(Math.max(0, bossPts) / SOLO_BOSS_PER));

export type SoloStage = 'run' | 'boss' | 'bossOver' | 'redemption' | 'redOver';

export type SoloGame = {
  run: SoloRun;
  /** 0-based act and the turns played in it. */
  act: number;
  inAct: number;
  stage: SoloStage;
  boss: Boss | null;
  redemption: Redemption | null;
  /** Redemption is once a game. */
  redUsed: boolean;
  redRounds: number[];
  /** What the last Boss Round or Redemption added. */
  extra: { k: 'boss' | 'redemption'; points: number; of: number } | null;
};

export type SoloGameEvent =
  | { type: 'RUN'; e: SoloEvent }
  | { type: 'BOSS'; e: BossEvent }
  | { type: 'RED'; e: RedemptionEvent }
  | { type: 'REDEEM' }
  | { type: 'ON' } // past a Boss or Redemption result
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number };

export function startSoloGame(bank: FullBank, target: Target, rng: Rng, mix: Mix = 'mixed', noClock = false): SoloGame {
  return { run: startSolo(bank, target, [], rng, mix, noClock), act: 0, inAct: 1, stage: 'run', boss: null, redemption: null, redUsed: false, redRounds: [], extra: null };
}

/** A game saved before acts came (a plain run) carries on as act I. */
export const asSoloGame = (x: SoloGame | SoloRun): SoloGame =>
  'stage' in x ? x : { run: x, act: 0, inAct: x.turnNo, stage: 'run', boss: null, redemption: null, redUsed: false, redRounds: [], extra: null };

/** The points the last turn missed: what a Redemption round can win back. */
export function missedPoints(g: SoloGame): number {
  const t = g.run.turn;
  if (!t || g.run.phase !== 'turnOver') return 0;
  return t.results.filter((r) => !r.right).reduce((a, r) => a + STYLES[r.style].points, 0);
}

export const canRedeem = (g: SoloGame) => g.stage === 'run' && !g.redUsed && missedPoints(g) > 0;

function addPoints(g: SoloGame, points: number): SoloGame {
  const score = g.run.score + points;
  return { ...g, run: { ...g.run, score, phase: score >= g.run.target ? 'done' : g.run.phase } };
}

function startBoss(g: SoloGame, bank: FullBank, rng: Rng): SoloGame {
  const field = spinField(rng, g.run.mix);
  const sets = bank.boss.filter((b) => b.field === field);
  const from = sets.length ? sets : bank.boss;
  const pick = from[Math.floor(rng() * from.length)];
  const items = shuffle(pick.items, rng).slice(0, BOSS_ITEMS);
  const boss: Boss = { field, category: pick.category, items, order: [0], at: 0, decks: { 0: items.map((_, i) => i) }, swipes: {}, phase: 'ready', until: null, pausedAt: null };
  return { ...g, stage: 'boss', boss, extra: null };
}

function closeBoss(g: SoloGame): SoloGame {
  const pts = bossPoints(g.boss!, 0);
  const bonus = soloBossBonus(g.run.target, pts);
  return addPoints({ ...g, stage: 'bossOver', extra: { k: 'boss', points: bonus, of: pts } }, bonus);
}

function stepBoss(g: SoloGame, e: BossEvent): SoloGame {
  const b = g.boss;
  if (!b || b.pausedAt != null) return g;
  if (e.type === 'GO') return b.phase === 'ready' ? { ...g, boss: { ...b, phase: 'playing', until: e.now + BOSS_MS } } : g;
  if (b.phase !== 'playing') return g;
  if (e.type === 'TICK') return b.until != null && e.now >= b.until ? closeBoss(g) : g;
  const mine = [...(b.swipes[0] ?? []), e.fits];
  const s = { ...g, boss: { ...b, swipes: { 0: mine } } };
  return mine.length >= b.items.length ? closeBoss(s) : s;
}

function pauseAll(g: SoloGame, e: { type: 'PAUSE' | 'RESUME'; now: number }, bank: FullBank, rng: Rng): SoloGame {
  const shift = <T extends { pausedAt: number | null; until: number | null }>(x: T): T => {
    if (e.type === 'PAUSE') return x.pausedAt == null ? { ...x, pausedAt: e.now } : x;
    if (x.pausedAt == null) return x;
    return { ...x, pausedAt: null, until: x.until == null ? null : x.until + (e.now - x.pausedAt) };
  };
  return { ...g, run: stepSolo(g.run, e, bank, rng), boss: g.boss ? shift(g.boss) : null, redemption: g.redemption ? shift(g.redemption) : null };
}

export function stepSoloGame(g: SoloGame, e: SoloGameEvent, bank: FullBank, rng: Rng): SoloGame {
  if (g.run.phase === 'done') return g;
  switch (e.type) {
    case 'PAUSE': case 'RESUME':
      return pauseAll(g, e, bank, rng);
    case 'RUN': {
      if (g.stage !== 'run') return g;
      // The act's last turn is over: its Boss Round comes before the next spin.
      if (e.e.type === 'NEXT' && g.run.phase === 'turnOver' && g.inAct >= roundsIn(g.act)) return startBoss(g, bank, rng);
      const run = stepSolo(g.run, e.e, bank, rng);
      if (run === g.run) return g;
      const next = e.e.type === 'NEXT' && run.turnNo !== g.run.turnNo;
      return { ...g, run, inAct: next ? g.inAct + 1 : g.inAct, extra: next ? null : g.extra };
    }
    case 'BOSS':
      return g.stage === 'boss' ? stepBoss(g, e.e) : g;
    case 'REDEEM': {
      if (!canRedeem(g) || !g.run.turn) return g;
      const { items, round } = redemptionItems(bank, g.run.turn.combo.field, rng, g.redRounds);
      const redemption: Redemption = { seat: 0, field: g.run.turn.combo.field, items, index: 0, right: 0, answers: [], phase: 'reveal', until: null, pausedAt: null };
      return { ...g, stage: 'redemption', redemption, redUsed: true, redRounds: round == null ? g.redRounds : [...g.redRounds, round] };
    }
    case 'RED': {
      if (g.stage !== 'redemption' || !g.redemption) return g;
      const r = stepRedemption(g.redemption, e.e);
      if (r === g.redemption) return g;
      if (r.phase !== 'over') return { ...g, redemption: r };
      const won = Math.min(r.right, missedPoints(g));
      return addPoints({ ...g, redemption: r, stage: 'redOver', extra: { k: 'redemption', points: won, of: r.right } }, won);
    }
    case 'ON': {
      if (g.stage === 'redOver') return { ...g, stage: 'run', redemption: null };
      if (g.stage !== 'bossOver') return g;
      // A new act, and its first spin.
      const run = stepSolo(g.run, { type: 'NEXT' }, bank, rng);
      return { ...g, run, act: g.act + 1, inAct: 1, stage: 'run', boss: null, extra: null };
    }
  }
}
