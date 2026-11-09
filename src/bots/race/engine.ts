import type { RaceItemResult, RacePlayer, RaceState } from '../../match/race';
import { afterAnswer, mindFor, type Mind } from '../brain';
import type { Bot } from '../types';

/**
 * A Vs rivals match on the phone (G4, Yazan 2026-11-09). The same shape the old online races had (RaceState), so the
 * race screens stay the same; here the phone referees. Everything runs on match time (paused while you pause) and is
 * worked out from it: rivals' moves are planned by the brain when each question starts, so the match is the same
 * however often the screen asks.
 *
 * A question ends when everyone is done or its time is up, then the answer shows for a few seconds (the reveal).
 */

export const ORDER_POINTS = [100, 80, 65, 50, 40, 30, 20, 10];
export const orderPoints = (rank: number) => ORDER_POINTS[Math.min(ORDER_POINTS.length, Math.max(1, rank)) - 1];

/** What a rival will do on one question. Times are ms from the question's start. */
export type Plan = {
  /** When it is done with the question (solved, out of tries, or answered); null = still going when time is up. */
  doneAt: number | null;
  solved: boolean;
  /** Visible wrong guesses before that (Diagnostic Pursuit). */
  wrongAt: number[];
  /** Quiz Parade: its answer, as the game encodes it (compared and scored at the close). */
  answer?: string | null;
  /** Quiz Parade: points it earns when the game scores itself (`scoreAll`); solved stays the full-right flag. */
  points?: number;
  /** What those wrong guesses were (shown live in Diagnostic Pursuit), in the same order. */
  wrongs?: string[];
  /** Medicordle: its rows, each with when it is played and its colours (g = green, y = yellow, x = grey). */
  rows?: { at: number; colours: string }[];
  /** Streak Master: the choice it picks. */
  pick?: number | null;
};

export type PlanCtx = { seed: string; index: number; item: number; gap: number; progress: number; limitMs: number; mind: Mind };

export type Rules = {
  /** The time one question gives, or a function of the item when types differ (Quiz Parade). */
  limitMs: number | ((item: number) => number);
  revealMs: number;
  /** Your lock after a wrong guess. */
  lockMs: number;
  countdownMs?: number;
  plan(bot: Bot, ctx: PlanCtx): Plan;
  /** Points for one player on one question. */
  points(p: { rank: number | null; solved: boolean; doneAt: number | null; tries: number; streak: number; limitMs: number }): number;
  /** Shown at the reveal: the answer id, word, or the right choice. */
  answerOf(item: number): string | null;
  /** The most one question can score, to judge how far apart players are. */
  maxPoints: number;
  /** Streak games: a miss drops the streak to 0. */
  streaks?: boolean;
  /**
   * Scores a whole question at once, when a player's points depend on the others' answers (Quiz Parade: nearest
   * guess wins Closest number, first fully right gets +1). Replaces `points` for that question.
   */
  scoreAll?(item: number, rows: { id: string; solved: boolean; doneAt: number | null; answer: string | null; rank: number | null }[]): Record<string, number>;
};

type You = { doneAt: number | null; solved: boolean; wrong: string[]; guesses: string[]; tries: number; lockedUntil: number; pick: number | null; greens: number | null };
type Done = { plans: Record<string, Plan>; you: You; start: number; end: number; ranks: Record<string, number | null>; points: Record<string, number> };
type Tot = { score: number; solveMs: number; streak: number; best: number; correct: number };

const freshYou = (): You => ({ doneAt: null, solved: false, wrong: [], guesses: [], tries: 0, lockedUntil: 0, pick: null, greens: null });
export const YOU = 'you';

/** What every Vs rivals match is built from (the hook gathers it when the match opens). */
export type RaceCtx = { playId: string; items: number[]; you: { name: string; character: string; team: number | null }; rivals: (Bot & { team?: number | null })[]; settings: Record<string, unknown>; playerLevel: number };

/** What the screen hook needs from any match engine (the question races here, the Crossword claim race in its game). */
export interface Race {
  state(t: number): RaceState;
  plansNow(): Record<string, Plan> | null;
  mindOf(id: string): Mind;
}

export class BotRace implements Race {
  readonly rivals: Bot[];
  private minds: Record<string, Mind> = {};
  private tot: Record<string, Tot> = {};
  private done: Done[] = [];
  private cur: { start: number; plans: Record<string, Plan>; you: You } | null = null;
  private finished = false;

  constructor(readonly opts: RaceCtx & { rules: Rules }) {
    this.rivals = opts.rivals;
    for (const b of opts.rivals) this.minds[b.id] = mindFor(b, opts.playerLevel);
    for (const id of [YOU, ...opts.rivals.map((b) => b.id)]) this.tot[id] = { score: 0, solveMs: 0, streak: 0, best: 0, correct: 0 };
  }

  get rules() {
    return this.opts.rules;
  }
  get total() {
    return this.opts.items.length;
  }
  /** The time question `i` gives. */
  limitOf(i: number) {
    const l = this.opts.rules.limitMs;
    return typeof l === 'function' ? l(this.opts.items[i]) : l;
  }
  get countdown() {
    return this.opts.rules.countdownMs ?? 3000;
  }
  mindOf(id: string) {
    return this.minds[id];
  }
  scoreOf(id: string) {
    return this.tot[id]?.score ?? 0;
  }

  /** The plans for the question now running (or null between questions). */
  plansNow() {
    return this.cur?.plans ?? null;
  }
  /** The plans of question `i`, running or finished (Case Files shows every rival's answers at the reveal). */
  plansAt(i: number) {
    return this.done[i]?.plans ?? (i === this.done.length ? this.cur?.plans : undefined) ?? null;
  }
  startOfNow() {
    return this.cur?.start ?? null;
  }

  private startItem(i: number, at: number) {
    const r = this.opts.rules;
    const stake = Math.max(1, r.maxPoints * this.total);
    const plans: Record<string, Plan> = {};
    for (const b of this.rivals) {
      const gap = (this.tot[b.id].score - this.tot[YOU].score) / stake;
      plans[b.id] = r.plan(b, { seed: `${this.opts.playId}:${i}`, index: i, item: this.opts.items[i], gap, progress: i / Math.max(1, this.total), limitMs: this.limitOf(i), mind: this.minds[b.id] });
    }
    this.cur = { start: at, plans, you: freshYou() };
  }

  /** The end of the running question, if it is known yet: everyone done, or its time up. */
  private endOf(t: number): number | null {
    const c = this.cur!;
    const limit = c.start + this.limitOf(this.done.length);
    const times = [c.you.doneAt, ...Object.values(c.plans).map((p) => p.doneAt)];
    if (times.every((x) => x != null)) return Math.min(limit, c.start + Math.max(...(times as number[])));
    return t >= limit ? limit : null;
  }

  private closeItem(end: number) {
    const c = this.cur!;
    const r = this.opts.rules;
    const i = this.done.length;
    const limitMs = this.limitOf(i);
    const rows: { id: string; solved: boolean; doneAt: number | null; tries: number; answer: string | null }[] = [
      { id: YOU, solved: c.you.solved, doneAt: c.you.doneAt, tries: c.you.tries, answer: c.you.guesses[0] ?? null },
      ...this.rivals.map((b) => {
        const p = c.plans[b.id];
        const inTime = p.doneAt != null && p.doneAt <= limitMs;
        // The answer goes to `scoreAll` even when the rival ran out of time: Case Files still pays the lists it filed.
        return { id: b.id, solved: inTime && p.solved, doneAt: inTime ? p.doneAt : null, tries: p.rows?.length ?? p.wrongAt.length + (p.solved ? 1 : 0), answer: p.answer ?? null };
      }),
    ];
    const solvers = rows.filter((x) => x.solved).sort((a, b) => a.doneAt! - b.doneAt! || (a.id === YOU ? -1 : b.id === YOU ? 1 : 0));
    const ranks: Record<string, number | null> = {};
    const points: Record<string, number> = {};
    for (const x of rows) ranks[x.id] = x.solved ? solvers.indexOf(x) + 1 : null;
    const all = r.scoreAll?.(this.opts.items[i], rows.map((x) => ({ ...x, rank: ranks[x.id] })));
    for (const x of rows) {
      const rank = ranks[x.id];
      const t = this.tot[x.id];
      t.streak = x.solved ? t.streak + 1 : r.streaks ? 0 : t.streak;
      t.best = Math.max(t.best, t.streak);
      points[x.id] = all ? (all[x.id] ?? 0) : r.points({ rank, solved: x.solved, doneAt: x.doneAt, tries: x.tries, streak: t.streak, limitMs });
      t.score += points[x.id];
      if (x.solved) {
        t.correct++;
        t.solveMs += x.doneAt!;
      } else t.solveMs += limitMs;
      if (x.id !== YOU) this.minds[x.id] = afterAnswer(this.minds[x.id], x.solved);
    }
    this.done.push({ plans: c.plans, you: c.you, start: c.start, end, ranks, points });
    this.cur = null;
  }

  /** Moves the match up to match time `t`: starts, ends and reveals questions as their times come. */
  sync(t: number) {
    const r = this.opts.rules;
    for (let guard = 0; guard < 1000 && !this.finished; guard++) {
      if (!this.cur) {
        const i = this.done.length;
        if (i >= this.total) {
          this.finished = true;
          break;
        }
        const at = i === 0 ? this.countdown : this.done[i - 1].end + r.revealMs;
        if (t < at) break;
        this.startItem(i, at);
      }
      const end = this.endOf(t);
      if (end == null || t < end) break;
      this.closeItem(end);
    }
    return this;
  }

  // ---- your moves (t = match time) ----

  /** A wrong guess: locks you for a moment (unlimited guesses games) or uses a try. */
  wrong(t: number, answer: string, opts: { lock?: boolean; outAfter?: number } = {}) {
    this.sync(t);
    const c = this.cur;
    if (!c || c.you.doneAt != null || t < c.you.lockedUntil) return 'ignored' as const;
    if (c.you.wrong.includes(answer)) return 'ignored' as const;
    const tries = c.you.tries + 1;
    const out = opts.outAfter != null && tries >= opts.outAfter;
    c.you = { ...c.you, wrong: [...c.you.wrong, answer], guesses: [...c.you.guesses, answer], tries, lockedUntil: opts.lock === false ? 0 : t + this.opts.rules.lockMs, doneAt: out ? t - c.start : null };
    this.sync(t);
    return out ? ('out' as const) : ('wrong' as const);
  }

  /** You solved it (or picked right). */
  solve(t: number, extra: { pick?: number; guess?: string; greens?: number } = {}) {
    this.sync(t);
    const c = this.cur;
    if (!c || c.you.doneAt != null) return 'ignored' as const;
    c.you = { ...c.you, solved: true, doneAt: t - c.start, tries: c.you.tries + 1, pick: extra.pick ?? null, greens: extra.greens ?? c.you.greens, guesses: extra.guess ? [...c.you.guesses, extra.guess] : c.you.guesses };
    this.sync(t);
    return 'right' as const;
  }

  /** You are done without solving (a wrong pick in Streak Master, or out of tries). */
  miss(t: number, extra: { pick?: number; guess?: string; greens?: number } = {}) {
    this.sync(t);
    const c = this.cur;
    if (!c || c.you.doneAt != null) return 'ignored' as const;
    c.you = { ...c.you, doneAt: t - c.start, tries: c.you.tries + 1, pick: extra.pick ?? null, greens: extra.greens ?? c.you.greens, guesses: extra.guess ? [...c.you.guesses, extra.guess] : c.you.guesses };
    this.sync(t);
    return 'missed' as const;
  }

  /** A Medicordle row that wasn't the word: counts a try and remembers your greens. */
  row(t: number, guess: string, greens: number) {
    this.sync(t);
    const c = this.cur;
    if (!c || c.you.doneAt != null) return;
    c.you = { ...c.you, tries: c.you.tries + 1, guesses: [...c.you.guesses, guess], greens: Math.max(c.you.greens ?? 0, greens) };
  }

  // ---- the state the screens draw ----

  state(t: number): RaceState {
    this.sync(t);
    const r = this.opts.rules;
    const o = this.opts;
    const players = (live: (id: string) => Partial<RacePlayer>): RacePlayer[] =>
      [{ id: YOU, name: 'You', character: o.you.character, team: o.you.team }, ...o.rivals.map((b) => ({ id: b.id, name: b.name, character: b.character, team: b.team ?? null }))].map((p) => {
        const tt = this.tot[p.id];
        return {
          user_id: p.id,
          name: p.name,
          character: p.character,
          team: p.team,
          score: tt.score,
          solve_ms: tt.solveMs,
          dropped: false,
          rank: null,
          streak: tt.streak,
          best_streak: tt.best,
          correct: tt.correct,
          done: false,
          solved: false,
          item_rank: null,
          item_points: null,
          tries: 0,
          greens: null,
          ...live(p.id),
        };
      });
    const ranked = (ps: RacePlayer[]) => {
      const order = [...ps].sort((a, b) => b.score - a.score || b.best_streak - a.best_streak || b.correct - a.correct || a.solve_ms - b.solve_ms);
      return ps.map((p) => ({ ...p, rank: order.indexOf(p) + 1 }));
    };
    const myItems: RaceItemResult[] = this.done.map((d, i) => ({ index: i, item: o.items[i], solved_ms: d.you.solved ? d.you.doneAt : null, rank: d.ranks[YOU], points: d.points[YOU], wrong: d.you.wrong, guesses: d.you.guesses, pick: d.you.pick }));
    const base = { now: t, room_id: `bot:${o.playId}`, game: '', total: this.total, settings: o.settings, my_items: myItems };

    if (this.cur) {
      const c = this.cur;
      const el = t - c.start;
      const live = (id: string): Partial<RacePlayer> => {
        if (id === YOU) return { done: c.you.doneAt != null, solved: c.you.solved, tries: c.you.tries, greens: c.you.greens };
        const p = c.plans[id];
        const done = p.doneAt != null && p.doneAt <= el;
        const rows = p.rows?.filter((x) => x.at <= el) ?? [];
        return { done, solved: done && p.solved, tries: p.rows ? rows.length : p.wrongAt.filter((w) => w <= el).length + (done && p.solved ? 1 : 0), greens: p.rows ? Math.max(0, ...rows.map((x) => [...x.colours].filter((ch) => ch === 'g').length)) : null };
      };
      // Solve order so far, for "Sara solved it, 2nd".
      const ps = players(live);
      const solvedNow = ps.filter((p) => p.solved).map((p) => ({ p, at: p.user_id === YOU ? c.you.doneAt! : c.plans[p.user_id].doneAt! })).sort((a, b) => a.at - b.at);
      const withRank = ps.map((p) => ({ ...p, item_rank: p.solved ? solvedNow.findIndex((x) => x.p.user_id === p.user_id) + 1 : null }));
      return {
        ...base,
        phase: 'case',
        phase_started_at: c.start,
        phase_ends_at: c.start + this.limitOf(this.done.length),
        index: this.done.length,
        item: o.items[this.done.length],
        answer: null,
        players: ranked(withRank),
        me: { locked_until: c.you.lockedUntil || null, wrong: c.you.wrong, guesses: c.you.guesses, pick: c.you.pick, done: c.you.doneAt != null, solved_ms: c.you.solved ? c.you.doneAt : null, rank: c.you.solved ? (withRank.find((p) => p.user_id === YOU)?.item_rank ?? null) : null, points: 0 },
      };
    }

    const last = this.done[this.done.length - 1];
    if (!last) {
      return { ...base, phase: 'countdown', phase_started_at: 0, phase_ends_at: this.countdown, index: 0, item: null, answer: null, players: ranked(players(() => ({}))), me: null };
    }
    const i = this.done.length - 1;
    const after = (id: string): Partial<RacePlayer> => {
      const p = id === YOU ? null : last.plans[id];
      const solved = last.ranks[id] != null;
      return { done: true, solved, item_rank: last.ranks[id], item_points: last.points[id], pick: id === YOU ? last.you.pick : (p?.pick ?? null), tries: id === YOU ? last.you.tries : (p?.rows?.length ?? 0) };
    };
    return {
      ...base,
      phase: this.finished && t >= last.end + r.revealMs ? 'done' : 'reveal',
      phase_started_at: last.end,
      phase_ends_at: last.end + r.revealMs,
      index: i,
      item: o.items[i],
      answer: r.answerOf(o.items[i]),
      players: ranked(players(after)),
      me: { locked_until: null, wrong: last.you.wrong, guesses: last.you.guesses, pick: last.you.pick, done: true, solved_ms: last.you.solved ? last.you.doneAt : null, rank: last.ranks[YOU], points: last.points[YOU] },
    };
  }
}
