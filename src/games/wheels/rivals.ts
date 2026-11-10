// Live on stage (The Wheels of Chaos vs rivals, G5): the full show refereed on the phone. The Pass the phone game
// runs under the online referee (online.ts: every wait has a deadline), and each rival makes its moves at planned
// moments: answers at its type's pace, Redemption calls, Boss swipes at once with you.
import type { RacePlayer, RaceState } from '../../match/race';
import { afterAnswer, chanceOf, decide, mindFor, moodOf, type Mind } from '../../bots/brain';
import { YOU, type Plan, type Race, type RaceCtx } from '../../bots/race/engine';
import { between, pickOf, rng, type Rand } from '../../bots/rng';
import type { Bot, BotType } from '../../bots/types';
import { STYLES, type Answer, type Mix, type Question, type Rng, type Target } from './core';
import { actor, bossPoints, type FullBank, type OfflineGame } from './offline';
import { dueOf, onlineRanks, startOnline, stepOnline, type Move, type OnlineWheels, type Outside } from './online';

export const WC_COUNTDOWN_MS = 3_000;
/** "Final curtain…" shows this long before the results. */
export const WC_CURTAIN_MS = 4_000;

/** Seconds between two Boss swipes, by type (30 items in 40 s needs 1.33 s a swipe). */
const SWIPE_S: Record<BotType, [number, number]> = { genius: [0.9, 1.4], scholar: [1.15, 1.9], freshman: [1.5, 2.6] };
/** Seconds between two Redemption calls, by type (10 calls in 20 s). */
const CALL_S: Record<BotType, [number, number]> = { genius: [1.0, 1.7], scholar: [1.4, 2.3], freshman: [1.8, 3.0] };
const HARD: Record<Question['difficulty'], number> = { easy: 0.25, medium: 0.5, hard: 0.75, extreme: 0.9 };

export const rightAnswer = (q: Question): Answer => {
  switch (q.style) {
    case 'mcq': case 'riddle': case 'reverse': return q.answer;
    case 'tf': return q.answer;
    case 'lie': return q.lie;
    case 'r2o': return [...q.out];
    case 'match': return q.pairs.map((_, i) => i);
  }
};

/** A wrong answer that looks tried: one choice off, the other value, one item right of two, one pair crossed. */
export function wrongAnswer(q: Question, wrongPick: number, r: Rand): Answer {
  const others = (n: number, not: number) => Array.from({ length: n }, (_, i) => i).filter((i) => i !== not);
  switch (q.style) {
    case 'mcq': case 'riddle': case 'reverse': {
      const o = others(q.choices.length, q.answer);
      return o[(wrongPick + Math.floor(r() * o.length)) % o.length] ?? q.answer;
    }
    case 'tf': return !q.answer;
    case 'lie': {
      const o = others(q.statements.length, q.lie);
      return o[(wrongPick + Math.floor(r() * o.length)) % o.length] ?? q.lie;
    }
    case 'r2o': {
      const keep = pickOf(r, q.out);
      const other = pickOf(r, others(q.items.length, -1).filter((i) => !q.out.includes(i as 0)));
      return [keep, other ?? keep];
    }
    case 'match': {
      const map = q.pairs.map((_, i) => i);
      if (map.length >= 2) {
        const a = Math.floor(r() * map.length);
        const b = (a + 1 + Math.floor(r() * (map.length - 1))) % map.length;
        [map[a], map[b]] = [map[b], map[a]];
      }
      return map;
    }
  }
}

/** What the current wait is about: the referee's key plus the call and swipe counts, so each call gets its own moment. */
function keyOf(g: OfflineGame): string {
  return [g.phase, actor(g), g.cycle, g.round, g.turnAt, g.turn ? `${g.turn.k}.${g.turn.phase}` : '', g.redemption ? `${g.redemption.phase}.${g.redemption.index}` : '', g.boss?.phase ?? ''].join('|');
}

type Planned = { at: number; seat: number; move: Move };
type Swipe = { at: number; fits: boolean };

/**
 * The show: you are seat 0, the rivals seats 1 to 3. Everything runs on match time (paused while you pause). The
 * referee's deadlines carry every wait; a rival's own moves land at the moments planned when the wait began.
 */
export class WheelsShow implements Race {
  readonly rivals: Bot[];
  private minds: Record<string, Mind> = {};
  private rngGame: Rng;
  private o: OnlineWheels;
  private key = '';
  private since = 0;
  private planned: Planned | null = null;
  private bossSwipes: Record<number, Swipe[]> = {};
  private bossKey = '';
  private mine: boolean[] = [];
  private doneAt: number | null = null;

  constructor(
    readonly opts: RaceCtx & { bank: FullBank; target: Target; mix: Mix },
  ) {
    this.rivals = opts.rivals;
    for (const b of opts.rivals) this.minds[b.id] = mindFor(b, opts.playerLevel);
    this.rngGame = rng(`${opts.playId}:wheels`);
    this.o = startOnline(1 + opts.rivals.length, opts.target, opts.mix, 'local', opts.bank, this.rngGame, WC_COUNTDOWN_MS);
    this.rekey(WC_COUNTDOWN_MS);
  }

  mindOf(id: string) {
    return this.minds[id];
  }
  plansNow(): Record<string, Plan> | null {
    return null;
  }
  /** The game as it stands (call `sync` or `state` first). */
  get game() {
    return this.o.g;
  }
  /** When the current wait runs out (match time), or null. */
  get deadline() {
    return this.o.deadline;
  }
  seatOf(id: string) {
    return id === YOU ? 0 : this.rivals.findIndex((b) => b.id === id) + 1;
  }
  idOf(seat: number) {
    return seat === 0 ? YOU : (this.rivals[seat - 1]?.id ?? YOU);
  }
  /** A seat's Boss swipes made by match time `t`. */
  swipesOf(seat: number, t: number): boolean[] {
    if (seat === 0) return this.mine;
    return (this.bossSwipes[seat] ?? []).filter((s) => s.at <= t).map((s) => s.fits);
  }

  private out(t: number): Outside {
    const swipes: Outside['swipes'] = { 0: this.mine };
    for (const s of Object.keys(this.bossSwipes)) swipes[Number(s)] = this.swipesOf(Number(s), t);
    return { dropped: [], swipes };
  }

  /** The wait changed: remember when, and plan the rival's move in it (if it is a rival's move). */
  private rekey(t: number) {
    const g = this.o.g;
    const k = keyOf(g);
    if (k === this.key) return;
    // Form: a rival's question result moves its mood.
    if (g.phase === 'turn' && g.turn?.phase === 'feedback' && this.key.includes('.question')) {
      const seat = actor(g);
      const last = g.turn.results[g.turn.results.length - 1];
      if (seat != null && seat > 0 && last) this.minds[this.idOf(seat)] = afterAnswer(this.minds[this.idOf(seat)], last.right);
    }
    this.key = k;
    this.since = t;
    this.planned = this.planFor(g, t);
    if (g.phase === 'boss' && g.boss?.phase === 'playing') {
      const bk = `${g.cycle}`;
      if (this.bossKey !== bk) {
        this.bossKey = bk;
        this.mine = [];
        this.bossSwipes = {};
        for (const [i, b] of this.rivals.entries()) this.bossSwipes[i + 1] = this.swipePlan(b, i + 1, g, t);
      }
    }
    if (g.phase === 'done' && this.doneAt == null) this.doneAt = t;
  }

  private gapOf(seat: number) {
    const g = this.o.g;
    return (g.scores[seat] - g.scores[0]) / Math.max(1, g.target);
  }
  private progress() {
    const g = this.o.g;
    return Math.min(1, Math.max(...g.scores) / Math.max(1, g.target));
  }

  /** A rival's move in the wait that began at `t`, or null when the referee's deadline is all it takes. */
  private planFor(g: OfflineGame, t: number): Planned | null {
    const seat = actor(g);
    if (seat == null || seat === 0) return null;
    const bot = this.rivals[seat - 1];
    const mind = this.minds[bot.id];
    const seed = `${this.opts.playId}:${g.cycle}.${g.round}.${g.turnAt}:${seat}`;
    switch (g.phase) {
      case 'redemptionOffer': {
        const r = rng(`${seed}:redeem`);
        // Most take the second chance; a tilted rival always does.
        return { at: t + between(r, 2000, 4500), seat, move: { type: 'REDEEM', use: moodOf(mind) === 'tilt' || r() < 0.7 } };
      }
      case 'turn': {
        const turn = g.turn;
        if (!turn || turn.phase !== 'question') return null;
        const q = turn.question;
        const limitMs = STYLES[q.style].seconds * 1000;
        const mv = decide(mind, { seed: `${seed}:q${turn.k}`, limitMs, hard: HARD[q.difficulty] ?? 0.5, gap: this.gapOf(seat), progress: this.progress() });
        if (mv.ms == null) return null;
        const answer = mv.right ? rightAnswer(q) : wrongAnswer(q, mv.wrongPick, rng(`${seed}:q${turn.k}:wrong`));
        return { at: t + Math.max(1200, mv.ms), seat, move: { type: 'ANSWER', answer } };
      }
      case 'redemption': {
        const red = g.redemption;
        if (!red) return null;
        const r = rng(`${seed}:call${red.index}`);
        if (red.phase === 'reveal') return { at: t + between(r, 2500, 4000), seat, move: { type: 'GO' } };
        const q = red.items[red.index];
        if (!q || q.style !== 'tf') return null;
        const right = r() < chanceOf(mind, { seed: `${seed}:call${red.index}`, limitMs: 2000, hard: 0.3 });
        return { at: t + between(r, ...CALL_S[bot.type]) * 1000, seat, move: { type: 'CALL', value: right ? q.answer : !q.answer } };
      }
      default:
        return null;
    }
  }

  /** A rival's Boss swipes: at its pace, right as often as its skill says, in its own deck order. */
  private swipePlan(bot: Bot, seat: number, g: OfflineGame, t: number): Swipe[] {
    const b = g.boss!;
    const r = rng(`${this.opts.playId}:boss${g.cycle}:${seat}`);
    const mind = this.minds[bot.id];
    const chance = Math.min(0.92, chanceOf(mind, { seed: `${this.opts.playId}:boss${g.cycle}`, limitMs: 1500, hard: 0.35 }) + 0.05);
    const out: Swipe[] = [];
    let at = t + between(r, 1500, 3000);
    for (const ix of b.decks[seat] ?? []) {
      const fits = b.items[ix].fits;
      out.push({ at: Math.round(at), fits: r() < chance ? fits : !fits });
      at += between(r, ...SWIPE_S[bot.type]) * 1000;
    }
    return out;
  }

  /** Moves the show up to match time `t`: deadlines and rivals' moves, each at its moment. */
  sync(t: number) {
    for (let guard = 0; guard < 2000; guard++) {
      const g = this.o.g;
      if (g.phase === 'done') break;
      const due = dueOf(this.o);
      const bot = this.planned && this.planned.at <= t ? this.planned : null;
      let swipeAt: number | null = null;
      if (g.phase === 'boss' && g.boss?.phase === 'playing') {
        // The round closes early once every seat has swiped its deck.
        const n = g.boss.items.length;
        const ends = g.active.map((s) => (s === 0 ? (this.mine.length >= n ? t : Infinity) : (this.bossSwipes[s]?.[n - 1]?.at ?? Infinity)));
        const all = Math.max(...ends);
        if (all <= t) swipeAt = all;
      }
      const times = [due != null && due <= t ? due : null, bot?.at ?? null, swipeAt].filter((x): x is number => x != null);
      if (!times.length) break;
      const at = Math.min(...times);
      const before = this.o;
      if (bot && bot.at === at) {
        this.o = stepOnline(this.o, bot.move, bot.seat, this.out(at), this.opts.bank, this.rngGame, at);
        this.planned = null;
      } else this.o = stepOnline(this.o, { type: 'TICK' }, null, this.out(at), this.opts.bank, this.rngGame, at);
      if (this.o === before && !bot) break;
      this.rekey(at);
    }
    return this;
  }

  // ---- your moves (t = match time) ----

  move(t: number, m: Move) {
    this.sync(t);
    const before = this.o;
    this.o = stepOnline(this.o, m, 0, this.out(t), this.opts.bank, this.rngGame, t);
    this.rekey(t);
    this.sync(t);
    return this.o !== before;
  }

  swipe(t: number, fits: boolean) {
    this.sync(t);
    const g = this.o.g;
    if (g.phase !== 'boss' || g.boss?.phase !== 'playing' || this.mine.length >= g.boss.items.length) return;
    this.mine = [...this.mine, fits];
    this.sync(t);
  }

  /** Your Boss points so far. */
  myBossPoints() {
    const b = this.o.g.boss;
    return b ? bossPoints({ ...b, swipes: { 0: this.mine } }, 0) : 0;
  }

  // ---- the state the hook draws ----

  state(t: number): RaceState {
    this.sync(t);
    const o = this.opts;
    const g = this.o.g;
    const ranks = g.phase === 'done' ? onlineRanks(g) : null;
    const live = [...g.scores].map((_, s) => s).sort((a, b) => g.scores[b] - g.scores[a] || a - b);
    const players: RacePlayer[] = [{ id: YOU, name: 'You', character: o.you.character, team: null }, ...o.rivals.map((b) => ({ id: b.id, name: b.name, character: b.character, team: null }))].map((p, seat) => ({
      user_id: p.id,
      name: p.name,
      character: p.character,
      team: p.team,
      score: g.scores[seat],
      solve_ms: 0,
      dropped: false,
      rank: ranks ? ranks[seat] : live.indexOf(seat) + 1,
      streak: 0,
      best_streak: 0,
      correct: 0,
      done: g.phase === 'done',
      solved: g.phase === 'done' && !!g.result?.winners.includes(seat),
      item_rank: null,
      item_points: null,
      tries: 0,
      greens: null,
    }));
    const phase: RaceState['phase'] = t < WC_COUNTDOWN_MS ? 'countdown' : g.phase !== 'done' ? 'case' : t < (this.doneAt ?? t) + WC_CURTAIN_MS ? 'reveal' : 'done';
    return {
      now: t,
      room_id: `bot:${o.playId}`,
      game: '',
      phase,
      phase_started_at: phase === 'countdown' ? 0 : phase === 'case' ? WC_COUNTDOWN_MS : (this.doneAt ?? t),
      phase_ends_at: phase === 'countdown' ? WC_COUNTDOWN_MS : phase === 'case' ? Infinity : (this.doneAt ?? t) + WC_CURTAIN_MS,
      index: g.cycle,
      total: Math.max(1, g.cycle + 1),
      item: phase === 'countdown' ? null : 1,
      answer: null,
      settings: o.settings,
      players,
      me: phase === 'countdown' ? null : { locked_until: null, wrong: [], guesses: [], pick: null, done: g.phase === 'done', solved_ms: null, rank: ranks ? ranks[0] : null, points: g.scores[0] },
      my_items: g.phase === 'done' ? [{ index: 0, item: 1, solved_ms: null, rank: ranks ? ranks[0] : null, points: g.scores[0], wrong: [], guesses: [], pick: null }] : [],
    };
  }
}
