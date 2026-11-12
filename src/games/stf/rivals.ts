// Spot the Flaw vs rivals (Yazan 2026-11-12): everyone gets the same case at the same time. You see who has locked in
// each stage, never what they picked; all the answers show at the reveal. A case ends when you have locked both
// stages (rivals then finish their go) or its clock runs out (what is not locked is wrong). Most points wins, no speed
// bonus; ties go to fewer double-wrongs, then the faster player. No help vs rivals.
import type { RaceItemResult, RacePlayer, RaceState } from '../../match/race';
import { afterAnswer, chanceOf, mindFor, type Mind } from '../../bots/brain';
import { personaOf } from '../../bots/identity';
import { YOU, type Plan, type Race, type RaceCtx } from '../../bots/race/engine';
import { rng } from '../../bots/rng';
import type { Bot, BotType } from '../../bots/types';
import { casePoints, doubleWrong, lock, rankRows, startCase, timeUp, type CaseRun, type Level } from './core';
import { caseById } from './data';

export const STF_COUNTDOWN_MS = 3_000;
/** The reveal (explanation card) waits for Next, or moves on by itself after a minute. */
export const STF_REVEAL_MS = 60_000;

/** Seconds each stage takes each type, before the case's level and the rival's personality. */
const STAGE1_S: Record<BotType, [number, number]> = { genius: [22, 40], scholar: [30, 55], freshman: [40, 75] };
const STAGE2_S: Record<BotType, [number, number]> = { genius: [6, 14], scholar: [9, 20], freshman: [12, 28] };
const LEVEL_PACE: Record<Level, number> = { 1: 0.85, 2: 1, 3: 1.2 };

/** A rival's go at one case: when it locks each stage (ms from the case's start) and what it picks (0 = right). */
export type CasePlan = { at1: number; pick1: number; at2: number; pick2: number };

/** Plans a rival's go at a case when it opens. Pure and seeded, so the same match plays the same way. */
export function planCase(mind: Mind, id: string, seed: string, progress = 0): { plan: CasePlan; mind: Mind } {
  const r = rng(`${seed}:${mind.bot.id}:stf`);
  const p = mind.bot.persona ?? personaOf(mind.bot.name);
  const lv = caseById.get(id)!.lv;
  const secs = ([lo, hi]: [number, number]) => {
    let s = (lo + r() * (hi - lo)) * LEVEL_PACE[lv];
    if (p === 'showoff') s *= 0.85;
    if (p === 'shy') s *= 1.1;
    return Math.round(s * 1000);
  };
  const wrong = () => 1 + Math.floor(r() * 3);
  let m = mind;
  const ok1 = r() < chanceOf(m, { seed: `${seed}:1`, limitMs: 60_000, hard: 0.2 + (lv - 1) * 0.25, progress });
  m = afterAnswer(m, ok1);
  // Stage 2 is easier once the flaw is found.
  const ok2 = r() < chanceOf(m, { seed: `${seed}:2`, limitMs: 60_000, hard: ok1 ? 0.05 + (lv - 1) * 0.15 : 0.6, progress });
  m = afterAnswer(m, ok2);
  const at1 = secs(STAGE1_S[m.bot.type]);
  const at2 = at1 + secs(STAGE2_S[m.bot.type]);
  return { plan: { at1, pick1: ok1 ? 0 : wrong(), at2, pick2: ok2 ? 0 : wrong() }, mind: m };
}

/** A rival's run on the case at `t` (ms from the case's start). */
export function runAt(plan: CasePlan, t: number): CaseRun {
  let run = startCase(() => 0.5);
  if (t >= plan.at1) run = lock(run, plan.pick1);
  if (t >= plan.at2) run = lock(run, plan.pick2);
  return run;
}

const locked = (run: CaseRun) => (run.stage === 1 ? 0 : run.stage === 2 ? 1 : 2);

type You = { run: CaseRun; doneAt: number | null };
type Cur = { start: number; limit: number; you: You; plans: Record<string, CasePlan> };
type Row = { points: number; doubles: number; ms: number; run: CaseRun };
type Done = { start: number; end: number; next: number; rows: Record<string, Row>; ranks: Record<string, number> };

export class StfRace implements Race {
  readonly rivals: Bot[];
  private minds: Record<string, Mind> = {};
  private done: Done[] = [];
  private cur: Cur | null = null;
  private finished = false;

  constructor(readonly opts: RaceCtx & { cases: string[]; limitMs: number }) {
    this.rivals = opts.rivals;
    for (const b of opts.rivals) this.minds[b.id] = mindFor(b, opts.playerLevel);
  }

  get total() {
    return this.opts.cases.length;
  }
  mindOf(id: string) {
    return this.minds[id];
  }
  plansNow(): Record<string, Plan> | null {
    return this.cur ? {} : null;
  }
  /** The open case (or the last one, at its reveal). */
  caseNow(): string | null {
    const i = this.cur ? this.done.length : this.done.length - 1;
    return this.opts.cases[Math.max(0, i)] ?? null;
  }
  /** Your run on the open case (or the last one, at its reveal). */
  mine(): CaseRun | null {
    return this.cur?.you.run ?? this.done[this.done.length - 1]?.rows[YOU]?.run ?? null;
  }
  /** Your final run on a closed case. */
  runOfCase(i: number): CaseRun | null {
    return this.done[i]?.rows[YOU]?.run ?? null;
  }
  /** Every player's final run on the last closed case (for the reveal). */
  lastRuns(): Record<string, CaseRun> {
    const d = this.done[this.done.length - 1];
    return d ? Object.fromEntries(Object.entries(d.rows).map(([id, r]) => [id, r.run])) : {};
  }
  /** The open case's time left (ms), or null with no clock. */
  leftMs(t: number) {
    return this.cur && Number.isFinite(this.cur.limit) ? Math.max(0, this.cur.limit - t) : null;
  }

  private startCase(i: number, at: number) {
    const id = this.opts.cases[i];
    const plans: Record<string, CasePlan> = {};
    for (const b of this.rivals) {
      const p = planCase(this.minds[b.id], id, `${this.opts.playId}:${i}`, i / Math.max(1, this.total));
      plans[b.id] = p.plan;
      this.minds[b.id] = p.mind;
    }
    const you: You = { run: startCase(rng(`${this.opts.playId}:${i}:deal`)), doneAt: null };
    this.cur = { start: at, limit: this.opts.limitMs ? at + this.opts.limitMs : Infinity, you, plans };
  }

  private closeCase(end: number) {
    const c = this.cur!;
    const lv = caseById.get(this.opts.cases[this.done.length])!.lv;
    const timeIsUp = end >= c.limit;
    const rows: Record<string, Row> = {};
    const row = (run: CaseRun, ms: number): Row => ({ points: casePoints(lv, run), doubles: doubleWrong(run) ? 1 : 0, ms, run });
    rows[YOU] = row(timeUp(c.you.run), (c.you.doneAt ?? end) - c.start);
    for (const b of this.rivals) {
      // You finished first: the rivals finish their go. The clock ran out: they stop where they are.
      const plan = c.plans[b.id];
      const upTo = timeIsUp ? end - c.start : Infinity;
      rows[b.id] = row(timeUp(runAt(plan, upTo)), Math.min(plan.at2, end - c.start));
    }
    const ranked = rankRows(Object.entries(rows).map(([id, r]) => ({ id, ...r })));
    this.done.push({ start: c.start, end, next: end + STF_REVEAL_MS, rows, ranks: Object.fromEntries(ranked.map((r) => [r.id, r.rank])) });
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
        const at = i === 0 ? STF_COUNTDOWN_MS : this.done[i - 1].next;
        if (t < at) break;
        this.startCase(i, at);
      }
      const c = this.cur!;
      if (c.you.doneAt != null) {
        this.closeCase(c.you.doneAt);
        continue;
      }
      if (t >= c.limit) {
        this.closeCase(c.limit);
        continue;
      }
      break;
    }
    return this;
  }

  /** Locks your choice in the open stage (t = match time). Returns false when it did nothing. */
  lock(t: number, pick: number) {
    this.sync(t);
    const c = this.cur;
    if (!c || c.you.doneAt != null) return false;
    const next = lock(c.you.run, pick);
    if (next === c.you.run) return false;
    c.you.run = next;
    if (next.stage === 'done') c.you.doneAt = t;
    this.sync(t);
    return true;
  }

  /** Next on the reveal: the next case starts now (or the results). */
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
      return { points: Math.max(0, rows.reduce((a, r) => a + r.points, 0)), doubles: rows.reduce((a, r) => a + r.doubles, 0), ms: rows.reduce((a, r) => a + r.ms, 0) };
    };
    const ids = [YOU, ...o.rivals.map((b) => b.id)];
    const ranked = rankRows(ids.map((id) => ({ id, ...totals(id) })));
    const rankOf = Object.fromEntries(ranked.map((r) => [r.id, r.rank]));
    const last = this.done[this.done.length - 1];
    const base = (now: (id: string) => CaseRun | null, reveal: Done | null): RacePlayer[] => {
      const rows = [{ id: YOU, name: 'You', character: o.you.character, team: o.you.team }, ...o.rivals.map((b) => ({ id: b.id, name: b.name, character: b.character, team: b.team ?? null }))];
      return rows.map((p) => {
        const run = now(p.id);
        const tot = totals(p.id);
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
          done: run ? run.stage === 'done' : false,
          // Picks stay hidden until the reveal.
          solved: reveal ? reveal.rows[p.id].points > 0 : false,
          item_rank: reveal ? reveal.ranks[p.id] : null,
          item_points: reveal ? reveal.rows[p.id].points : null,
          tries: reveal ? reveal.rows[p.id].doubles : 0,
          greens: run ? locked(run) : null,
        };
      });
    };
    const myItems: RaceItemResult[] = this.done.map((d, i) => ({ index: i, item: i + 1, solved_ms: d.rows[YOU].ms, rank: d.ranks[YOU], points: d.rows[YOU].points, wrong: [], guesses: [], pick: null }));
    const shared = { now: t, room_id: `bot:${o.playId}`, game: '', total: this.total, settings: o.settings, my_items: myItems };
    if (this.cur) {
      const c = this.cur;
      const me = c.you.run;
      return {
        ...shared,
        phase: 'case',
        phase_started_at: c.start,
        phase_ends_at: Number.isFinite(c.limit) ? c.limit : c.start + 3_600_000,
        index: this.done.length,
        item: this.done.length + 1,
        answer: null,
        players: base((id) => (id === YOU ? me : runAt(c.plans[id], t - c.start)), null),
        me: { locked_until: null, wrong: [], guesses: [], pick: null, done: me.stage === 'done', solved_ms: null, rank: null, points: 0 },
      };
    }
    if (!last) {
      return { ...shared, phase: 'countdown', phase_started_at: 0, phase_ends_at: STF_COUNTDOWN_MS, index: 0, item: null, answer: null, players: base(() => null, null), me: null };
    }
    const i = this.done.length - 1;
    return {
      ...shared,
      phase: this.finished && t >= last.next ? 'done' : 'reveal',
      phase_started_at: last.end,
      phase_ends_at: last.next,
      index: i,
      item: i + 1,
      answer: null,
      players: base((id) => last.rows[id].run, last),
      me: { locked_until: null, wrong: [], guesses: [], pick: null, done: true, solved_ms: null, rank: last.ranks[YOU], points: last.rows[YOU].points },
    };
  }
}
