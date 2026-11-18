// Put it in order vs rivals (Yazan 2026-11-18): everyone gets the same question at the same time and 90 seconds. You
// see each rival fill their slots live and hear when one gets the order right, never their order. A question ends
// when everyone is done (once you are done, rivals still going finish within a few seconds) or the time runs out.
// Points as Solo: 100, 70 or 40 by try, plus up to 20 for speed. Ties go to the faster player.
import type { RaceItemResult, RacePlayer, RaceState } from '../../match/race';
import { afterAnswer, chanceOf, mindFor, type Mind } from '../../bots/brain';
import { personaOf } from '../../bots/identity';
import { YOU, type Plan, type Race, type RaceCtx } from '../../bots/race/engine';
import { rng } from '../../bots/rng';
import type { Bot, BotType } from '../../bots/types';
import { ORDER, move, pointsFor, rankRows, startRun, submit, timeUp, type QRun, type Target } from './core';
import { questionById } from './data';

export const ORDER_COUNTDOWN_MS = 3_000;
/** The reveal waits for Next, or moves on by itself after a minute. */
export const ORDER_REVEAL_MS = 60_000;

/** Seconds to fill all slots of a 5-step question, before the rival's personality. */
const FILL_S: Record<BotType, [number, number]> = { genius: [18, 34], scholar: [26, 46], freshman: [34, 62] };
/** Seconds between a wrong try and the next one (rearranging). */
const RETRY_S: Record<BotType, [number, number]> = { genius: [4, 8], scholar: [6, 11], freshman: [8, 14] };
/** Once you are done, a rival still going finishes within (as Spot the Flaw): Genius 1-2 s, Scholar 3-4 s, Freshman 5-6 s. */
const HURRY_S: Record<BotType, [number, number]> = { genius: [1, 2], scholar: [3, 4], freshman: [5, 6] };

/** A rival's go at one question: when each slot fills, when it submits each try, and which try is right (null = none). */
export type OrderPlan = { fills: number[]; tries: number[]; right: number | null };

/** Plans a rival's go at a question when it opens. Pure and seeded, so the same match plays the same way. */
export function planQuestion(mind: Mind, id: string, seed: string, progress = 0): { plan: OrderPlan; mind: Mind } {
  const r = rng(`${seed}:${mind.bot.id}:order`);
  const p = mind.bot.persona ?? personaOf(mind.bot.name);
  const q = questionById.get(id)!;
  const n = q.steps.length;
  const pace = (p === 'showoff' ? 0.85 : p === 'shy' ? 1.1 : 1) * (n / 5);
  const span = ([lo, hi]: [number, number]) => (lo + r() * (hi - lo)) * 1000;
  const fillMs = span(FILL_S[mind.bot.type]) * pace;
  const fills = Array.from({ length: n }, (_, k) => Math.round(fillMs * ((k + 0.6 + r() * 0.4) / n)));
  const hard = Math.min(0.9, 0.2 + (n - 4) * 0.2);
  let m = mind;
  let right: number | null = null;
  const tries: number[] = [];
  let at = fills[n - 1] + span([1, 3]);
  for (let k = 0; k < ORDER.tries; k++) {
    tries.push(Math.round(at));
    // Each try is a little easier: the rival has ruled an order out.
    const ok = r() < Math.min(0.97, chanceOf(m, { seed: `${seed}:${k}`, limitMs: ORDER.turnMs, hard: Math.max(0, hard - k * 0.2), progress }) + k * 0.08);
    m = afterAnswer(m, ok);
    if (ok) {
      right = k;
      break;
    }
    at += span(RETRY_S[mind.bot.type]);
  }
  return { plan: { fills, tries, right }, mind: m };
}

/** What a rival has done by `t` (ms from the question's start). */
export function progressAt(plan: OrderPlan, t: number) {
  const filled = plan.fills.filter((f) => f <= t).length;
  const sent = plan.tries.filter((x) => x <= t).length;
  const solved = plan.right != null && sent > plan.right;
  const out = !solved && sent >= ORDER.tries;
  return { filled, sent, solved, done: solved || out, doneAt: solved ? plan.tries[plan.right!] : out ? plan.tries[ORDER.tries - 1] : null };
}

/** A rival's result as a run, for the reveal rows. */
function rivalRun(plan: OrderPlan, t: number, timeIsUp: boolean): QRun {
  const g = progressAt(plan, t);
  const n = plan.fills.length;
  return {
    order: [],
    slots: Array.from({ length: n }, (_, i) => (g.solved ? i : null)),
    wrong: g.solved ? plan.right! : Math.min(g.sent, ORDER.tries),
    solved: g.solved,
    done: true,
    gone: [],
    fixed: [],
    placeUsed: false,
    decoyUsed: false,
    timeUp: !g.done && timeIsUp,
    miss: 0,
  };
}

type You = { run: QRun; doneAt: number | null };
type Cur = { start: number; limit: number; you: You; plans: Record<string, OrderPlan>; closeAt: number | null };
type Row = { points: number; ms: number; run: QRun };
type Done = { start: number; end: number; next: number; rows: Record<string, Row>; ranks: Record<string, number> };

export class OrderRace implements Race {
  readonly rivals: Bot[];
  private minds: Record<string, Mind> = {};
  private done: Done[] = [];
  private cur: Cur | null = null;
  private finished = false;

  constructor(readonly opts: RaceCtx & { ids: string[] }) {
    this.rivals = opts.rivals;
    for (const b of opts.rivals) this.minds[b.id] = mindFor(b, opts.playerLevel);
  }

  get total() {
    return this.opts.ids.length;
  }
  mindOf(id: string) {
    return this.minds[id];
  }
  plansNow(): Record<string, Plan> | null {
    return this.cur ? {} : null;
  }
  /** The open question (or the last one, at its reveal). */
  questionNow(): string | null {
    const i = this.cur ? this.done.length : this.done.length - 1;
    return this.opts.ids[Math.max(0, i)] ?? null;
  }
  /** Your run on the open question (or the last one, at its reveal). */
  mine(): QRun | null {
    return this.cur?.you.run ?? this.done[this.done.length - 1]?.rows[YOU]?.run ?? null;
  }
  runOf(i: number): { run: QRun; ms: number } | null {
    const r = this.done[i]?.rows[YOU];
    return r ? { run: r.run, ms: r.ms } : null;
  }
  /** Every player's result on the last closed question. */
  lastRows(): Record<string, Row> {
    return this.done[this.done.length - 1]?.rows ?? {};
  }
  /** Time spent on the open question (ms). */
  spentMs(t: number) {
    return this.cur ? Math.max(0, t - this.cur.start) : 0;
  }
  leftMs(t: number) {
    return this.cur ? Math.max(0, this.cur.limit - t) : 0;
  }

  private open(i: number, at: number) {
    const id = this.opts.ids[i];
    const plans: Record<string, OrderPlan> = {};
    for (const b of this.rivals) {
      const p = planQuestion(this.minds[b.id], id, `${this.opts.playId}:${i}`, i / Math.max(1, this.total));
      plans[b.id] = p.plan;
      this.minds[b.id] = p.mind;
    }
    const you: You = { run: startRun(questionById.get(id)!, rng(`${this.opts.playId}:${i}:deal`)), doneAt: null };
    this.cur = { start: at, limit: at + ORDER.turnMs, you, plans, closeAt: null };
  }

  /** Everyone's done (or the time is up) when: the last rival's last try, or the limit. */
  private allDoneAt(c: Cur) {
    let last = c.start;
    for (const b of this.rivals) {
      const g = progressAt(c.plans[b.id], Infinity);
      if (g.doneAt == null) return c.limit;
      last = Math.max(last, c.start + g.doneAt);
    }
    return Math.min(last, c.limit);
  }

  private close(end: number) {
    const c = this.cur!;
    const timeIsUp = end >= c.limit;
    const rows: Record<string, Row> = {};
    const youMs = Math.min((c.you.doneAt ?? end) - c.start, ORDER.turnMs);
    const yourRun = c.you.run.done ? c.you.run : timeUp(c.you.run);
    rows[YOU] = { run: yourRun, ms: youMs, points: yourRun.solved ? pointsFor(yourRun.wrong, youMs) : 0 };
    for (const b of this.rivals) {
      const plan = c.plans[b.id];
      const rel = end - c.start;
      const g = progressAt(plan, rel);
      const ms = Math.min(g.doneAt ?? rel, ORDER.turnMs);
      rows[b.id] = { run: rivalRun(plan, rel, timeIsUp), ms, points: g.solved ? pointsFor(plan.right!, ms) : 0 };
    }
    const ranked = rankRows(Object.entries(rows).map(([id, r]) => ({ id, ...r })));
    this.done.push({ start: c.start, end, next: end + ORDER_REVEAL_MS, rows, ranks: Object.fromEntries(ranked.map((r) => [r.id, r.rank])) });
    this.cur = null;
  }

  /** Moves the match up to match time `t`. */
  sync(t: number) {
    for (let guard = 0; guard < 50 && !this.finished; guard++) {
      if (!this.cur) {
        const i = this.done.length;
        if (i >= this.total) {
          this.finished = true;
          break;
        }
        const at = i === 0 ? ORDER_COUNTDOWN_MS : this.done[i - 1].next;
        if (t < at) break;
        this.open(i, at);
      }
      const c = this.cur!;
      const end = c.you.doneAt != null ? Math.min(c.closeAt ?? c.limit, c.limit) : c.limit;
      if (t < end) break;
      this.close(end);
    }
    return this;
  }

  private youDone(c: Cur, t: number) {
    c.you.doneAt = t;
    // Rivals still going finish soon (their remaining fills and tries squeezed into a few seconds), then the reveal.
    const rel = t - c.start;
    for (const b of this.rivals) {
      const plan = c.plans[b.id];
      const g = progressAt(plan, Infinity);
      const endAt = g.doneAt ?? Math.max(...plan.tries);
      if (endAt <= rel) continue;
      const h = Math.round((HURRY_S[b.type][0] + rng(`${this.opts.playId}:${this.done.length}:${b.id}:hurry`)() * (HURRY_S[b.type][1] - HURRY_S[b.type][0])) * 1000);
      const squeeze = (x: number) => (x <= rel ? x : rel + Math.round(((x - rel) / (endAt - rel)) * h));
      c.plans[b.id] = { ...plan, fills: plan.fills.map(squeeze), tries: plan.tries.map(squeeze) };
    }
    c.closeAt = Math.max(t, this.allDoneAt(c));
  }

  /** Your drag and drop (t = match time). Returns false when it did nothing. */
  move(t: number, card: number, to: Target) {
    this.sync(t);
    const c = this.cur;
    if (!c || c.you.doneAt != null) return false;
    const next = move(c.you.run, card, to);
    if (next === c.you.run) return false;
    c.you.run = next;
    return true;
  }

  /** Your Submit. Returns false when it did nothing. */
  submit(t: number) {
    this.sync(t);
    const c = this.cur;
    if (!c || c.you.doneAt != null) return false;
    const next = submit(c.you.run);
    if (next === c.you.run) return false;
    c.you.run = next;
    if (next.done) this.youDone(c, t);
    this.sync(t);
    return true;
  }

  /** A paid helper on your open question. Returns false when it did nothing. */
  help(t: number, apply: (run: QRun) => QRun) {
    this.sync(t);
    const c = this.cur;
    if (!c || c.you.doneAt != null) return false;
    const next = apply(c.you.run);
    if (next === c.you.run) return false;
    c.you.run = next;
    return true;
  }

  /** Next on the reveal: the next question starts now (or the results). */
  next(t: number) {
    this.sync(t);
    const last = this.done[this.done.length - 1];
    if (this.cur || !last || t >= last.next) return false;
    last.next = t;
    this.sync(t);
    return true;
  }

  // ---- the state the screen draws ----
  state(t: number): RaceState {
    this.sync(t);
    const o = this.opts;
    const totals = (id: string) => {
      const rows = this.done.map((d) => d.rows[id]);
      return { points: rows.reduce((a, r) => a + r.points, 0), ms: rows.reduce((a, r) => a + r.ms, 0) };
    };
    const ids = [YOU, ...o.rivals.map((b) => b.id)];
    const ranked = rankRows(ids.map((id) => ({ id, ...totals(id) })));
    const rankOf = Object.fromEntries(ranked.map((r) => [r.id, r.rank]));
    const last = this.done[this.done.length - 1];
    const c = this.cur;
    const base = (reveal: Done | null): RacePlayer[] => {
      const rows = [{ id: YOU, name: 'You', character: o.you.character, team: o.you.team }, ...o.rivals.map((b) => ({ id: b.id, name: b.name, character: b.character, team: b.team ?? null }))];
      return rows.map((p) => {
        const tot = totals(p.id);
        const g = c && p.id !== YOU ? progressAt(c.plans[p.id], t - c.start) : null;
        const mine = c && p.id === YOU ? c.you.run : null;
        return {
          user_id: p.id,
          name: p.name,
          character: p.character,
          team: p.team,
          score: tot.points,
          solve_ms: tot.ms,
          dropped: false,
          rank: rankOf[p.id],
          streak: 0,
          best_streak: 0,
          correct: 0,
          done: mine ? mine.done : g ? g.done : true,
          solved: reveal ? reveal.rows[p.id].run.solved : mine ? mine.solved : g ? g.solved : false,
          item_rank: reveal ? reveal.ranks[p.id] : null,
          item_points: reveal ? reveal.rows[p.id].points : null,
          // Live: tries sent; slots filled ride on greens.
          tries: g ? g.sent : mine ? mine.wrong : 0,
          greens: g ? g.filled : mine ? mine.slots.filter((x) => x != null).length : null,
        };
      });
    };
    const myItems: RaceItemResult[] = this.done.map((d, i) => ({ index: i, item: i + 1, solved_ms: d.rows[YOU].ms, rank: d.ranks[YOU], points: d.rows[YOU].points, wrong: [], guesses: [], pick: null }));
    const shared = { now: t, room_id: `bot:${o.playId}`, game: '', total: this.total, settings: o.settings, my_items: myItems };
    if (c) {
      const me = c.you.run;
      return {
        ...shared,
        phase: 'case',
        phase_started_at: c.start,
        phase_ends_at: c.limit,
        index: this.done.length,
        item: this.done.length + 1,
        answer: null,
        players: base(null),
        me: { locked_until: null, wrong: [], guesses: [], pick: null, done: me.done, solved_ms: null, rank: null, points: 0 },
      };
    }
    if (!last) return { ...shared, phase: 'countdown', phase_started_at: 0, phase_ends_at: ORDER_COUNTDOWN_MS, index: 0, item: null, answer: null, players: base(null), me: null };
    const i = this.done.length - 1;
    return {
      ...shared,
      phase: this.finished && t >= last.next ? 'done' : 'reveal',
      phase_started_at: last.end,
      phase_ends_at: last.next,
      index: i,
      item: i + 1,
      answer: null,
      players: base(last),
      me: { locked_until: null, wrong: [], guesses: [], pick: null, done: true, solved_ms: null, rank: last.ranks[YOU], points: last.rows[YOU].points },
    };
  }
}
