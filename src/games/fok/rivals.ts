// Four of a Kind vs rivals (Yazan 2026-11-12): everyone races the same board, each on their own copy. Rivals' found
// groups show live. A board ends when you are done (all found, or out of hearts) or its clock runs out; rivals then
// finish their own go at it from their plans. Places on a board: points, then fewer mistakes, then faster.
import type { RaceItemResult, RacePlayer, RaceState } from '../../match/race';
import { afterAnswer, chanceOf, mindFor, type Mind } from '../../bots/brain';
import { personaOf } from '../../bots/identity';
import { YOU, type Plan, type Race, type RaceCtx } from '../../bots/race/engine';
import { rng } from '../../bots/rng';
import type { Bot, BotType } from '../../bots/types';
import { FOK, boardPoints, buyHeart, endRun, rankRows, reshuffle, reveal, shuffle, startRun, submit, tilesOf, type Board, type BoardRun, type Level, type Verdict } from './core';
import { groupById } from './data';

export const FOK_COUNTDOWN_MS = 3_000;
export const FOK_REVEAL_MS = 7_000;

/** Seconds one group takes each type, before the group's level and the rival's personality. */
const GROUP_S: Record<BotType, [number, number]> = { genius: [12, 28], scholar: [20, 40], freshman: [30, 60] };
const LEVEL_PACE: Record<Level, number> = { 1: 0.8, 2: 1, 3: 1.35 };

/** One move in a rival's go at a board: when (ms from the board's start), and the group it found or null for a wrong pick. */
export type Move = { at: number; slot: number | null };

/**
 * A rival's whole go at one board, planned when the board starts: it goes for the easier groups first, each try takes
 * a while and is right by its chance (type, form, the group's level). 3 wrong picks and it is out (rivals buy no
 * token). Pure and seeded, so the same match plays the same way.
 */
export function planBoard(mind: Mind, board: Board, seed: string, progress = 0): { moves: Move[]; mind: Mind } {
  const r = rng(`${seed}:${mind.bot.id}:fok`);
  const p = mind.bot.persona ?? personaOf(mind.bot.name);
  const lv = (slot: number) => groupById.get(board.groups[slot].id)!.lv;
  const todo = shuffle([0, 1, 2, 3], r).sort((a, b) => lv(a) - lv(b));
  const moves: Move[] = [];
  let at = 0;
  let hearts = FOK.hearts;
  let m = mind;
  while (todo.length > 1 && hearts > 0) {
    const slot = todo[0];
    const [lo, hi] = GROUP_S[m.bot.type];
    let s = (lo + r() * (hi - lo)) * LEVEL_PACE[lv(slot)];
    if (p === 'showoff') s *= 0.85;
    if (p === 'shy') s *= 1.1;
    if (r() < 0.15) s *= 1.3;
    at += Math.round(s * 1000);
    const right = r() < chanceOf(m, { seed: `${seed}:${moves.length}`, limitMs: 60_000, hard: 0.15 + (lv(slot) - 1) * 0.35, progress });
    m = afterAnswer(m, right);
    if (right) {
      moves.push({ at, slot });
      todo.shift();
    } else {
      moves.push({ at, slot: null });
      hearts--;
      // After a miss it may try another group first.
      if (todo.length > 2 && r() < 0.4) todo.push(todo.shift()!);
    }
  }
  // Three found: the last one falls into place at once.
  if (todo.length === 1 && hearts > 0) moves.push({ at, slot: todo[0] });
  return { moves, mind: m };
}

/** A rival's board so far: its run rebuilt from its moves up to `t` (ms from the board's start). */
export function runAt(board: Board, moves: Move[], t: number): BoardRun {
  let run: BoardRun = { ...startRun(() => 0.5), order: Array.from({ length: 16 }, (_, i) => i) };
  for (const mv of moves) {
    if (mv.at > t) break;
    if (mv.slot != null) {
      if (run.found.includes(mv.slot)) continue;
      run = submit(run, tilesOf(mv.slot)).run;
    } else {
      // A wrong pick: three from one group and one from another, never the same four twice.
      const open = [0, 1, 2, 3].filter((s) => !run.found.includes(s));
      const a = open[run.mistakes % open.length];
      const b = open[(run.mistakes + 1) % open.length];
      run = submit(run, [...tilesOf(a).slice(0, 3), tilesOf(b)[run.mistakes % 4]]).run;
      if (run.phase === 'out') run = endRun(run);
    }
  }
  return run;
}

type You = { run: BoardRun; doneAt: number | null };
type Cur = { start: number; limit: number; you: You; plans: Record<string, Move[]> };
type Row = { points: number; mistakes: number; ms: number; found: number; solved: boolean; run: BoardRun };
type Done = { start: number; end: number; rows: Record<string, Row>; ranks: Record<string, number> };

export class FokRace implements Race {
  readonly rivals: Bot[];
  private minds: Record<string, Mind> = {};
  private done: Done[] = [];
  private cur: Cur | null = null;
  private finished = false;

  constructor(readonly opts: RaceCtx & { boards: Board[]; limitMs: number }) {
    this.rivals = opts.rivals;
    for (const b of opts.rivals) this.minds[b.id] = mindFor(b, opts.playerLevel);
  }

  get total() {
    return this.opts.boards.length;
  }
  mindOf(id: string) {
    return this.minds[id];
  }
  plansNow(): Record<string, Plan> | null {
    return this.cur ? {} : null;
  }
  boardNow(): Board | null {
    const i = this.cur ? this.done.length : this.done.length - 1;
    return this.opts.boards[Math.max(0, i)] ?? null;
  }
  /** Your run on the open board (or the last one, at its reveal). */
  mine(): BoardRun | null {
    return this.cur?.you.run ?? this.done[this.done.length - 1]?.rows[YOU]?.run ?? null;
  }
  /** Your final run on a closed board. */
  runOfBoard(i: number): BoardRun | null {
    return this.done[i]?.rows[YOU]?.run ?? null;
  }
  /** Each rival's run on the open board at time `t`, or its final run at the reveal. */
  runOf(id: string, t: number): BoardRun | null {
    if (this.cur) return runAt(this.opts.boards[this.done.length], this.cur.plans[id] ?? [], t - this.cur.start);
    return this.done[this.done.length - 1]?.rows[id]?.run ?? null;
  }
  /** The open board's time left (ms), or null with no clock. */
  leftMs(t: number) {
    return this.cur && Number.isFinite(this.cur.limit) ? Math.max(0, this.cur.limit - t) : null;
  }

  private startBoard(i: number, at: number) {
    const board = this.opts.boards[i];
    const plans: Record<string, Move[]> = {};
    for (const b of this.rivals) {
      const p = planBoard(this.minds[b.id], board, `${this.opts.playId}:${i}`, i / Math.max(1, this.total));
      plans[b.id] = p.moves;
      this.minds[b.id] = p.mind;
    }
    const you: You = { run: { ...startRun(rng(`${this.opts.playId}:${i}:deal`)) }, doneAt: null };
    this.cur = { start: at, limit: this.opts.limitMs ? at + this.opts.limitMs : Infinity, you, plans };
  }

  private closeBoard(end: number) {
    const c = this.cur!;
    const board = this.opts.boards[this.done.length];
    const timeUp = end >= c.limit;
    const rows: Record<string, Row> = {};
    const row = (run: BoardRun, ms: number): Row => ({ points: boardPoints(board, groupById, run), mistakes: run.mistakes, ms, found: run.found.length, solved: run.solved, run });
    const you = c.you.run.phase === 'done' ? c.you.run : endRun(c.you.run);
    rows[YOU] = row(you, (c.you.doneAt ?? end) - c.start);
    for (const b of this.rivals) {
      // You finished first: the rivals finish their go. The clock ran out: they stop where they are.
      const upTo = timeUp ? end - c.start : Infinity;
      const run = endRun(runAt(board, c.plans[b.id], upTo));
      const moves = c.plans[b.id].filter((m) => m.at <= upTo);
      rows[b.id] = row(run, moves.length ? moves[moves.length - 1].at : end - c.start);
    }
    const ranked = rankRows(Object.entries(rows).map(([id, r]) => ({ id, ...r })));
    const ranks = Object.fromEntries(ranked.map((r) => [r.id, r.rank]));
    this.done.push({ start: c.start, end, rows, ranks });
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
        const at = i === 0 ? FOK_COUNTDOWN_MS : this.done[i - 1].end + FOK_REVEAL_MS;
        if (t < at) break;
        this.startBoard(i, at);
      }
      const c = this.cur!;
      if (c.you.doneAt != null) {
        this.closeBoard(c.you.doneAt);
        continue;
      }
      if (t >= c.limit) {
        this.closeBoard(c.limit);
        continue;
      }
      break;
    }
    return this;
  }

  // ---- your moves (t = match time) ----
  private move(t: number, fn: (r: BoardRun) => BoardRun) {
    this.sync(t);
    const c = this.cur;
    if (!c || c.you.doneAt != null) return false;
    const next = fn(c.you.run);
    if (next === c.you.run) return false;
    c.you.run = next;
    if (next.phase === 'done') c.you.doneAt = t;
    this.sync(t);
    return true;
  }
  submit(t: number, tiles: number[]): Verdict {
    let v: Verdict = 'ignored';
    this.move(t, (r) => {
      const out = submit(r, tiles);
      v = out.verdict;
      return out.run;
    });
    return v;
  }
  shuffle(t: number) {
    this.move(t, (r) => reshuffle(r, Math.random));
  }
  hint(t: number) {
    return this.move(t, reveal);
  }
  buyHeart(t: number) {
    return this.move(t, buyHeart);
  }
  decline(t: number) {
    this.move(t, endRun);
  }

  // ---- the state the screen draws ----
  state(t: number): RaceState {
    this.sync(t);
    const o = this.opts;
    const totals = (id: string) => {
      const rows = this.done.map((d) => d.rows[id]);
      return { points: rows.reduce((a, r) => a + r.points, 0), mistakes: rows.reduce((a, r) => a + r.mistakes, 0), ms: rows.reduce((a, r) => a + r.ms, 0) };
    };
    const ids = [YOU, ...o.rivals.map((b) => b.id)];
    const ranked = rankRows(ids.map((id) => ({ id, ...totals(id) })));
    const rankOf = Object.fromEntries(ranked.map((r) => [r.id, r.rank]));
    const last = this.done[this.done.length - 1];
    const base = (now: (id: string) => BoardRun | null, itemRank: (id: string) => number | null): RacePlayer[] => {
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
          done: run ? run.phase !== 'play' : false,
          solved: run ? run.solved : false,
          item_rank: itemRank(p.id),
          item_points: run && this.boardNow() ? boardPoints(this.boardNow()!, groupById, run) : null,
          tries: run ? run.mistakes : 0,
          greens: run ? run.found.length : null,
          hearts: run ? run.hearts : FOK.hearts,
          revived: run ? run.token : false,
        };
      });
    };
    const myItems: RaceItemResult[] = this.done.map((d, i) => ({ index: i, item: i + 1, solved_ms: d.rows[YOU].solved ? d.rows[YOU].ms : null, rank: d.ranks[YOU], points: d.rows[YOU].points, wrong: [], guesses: [], pick: null }));
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
        players: base((id) => (id === YOU ? me : this.runOf(id, t)), () => null),
        me: { locked_until: null, wrong: [], guesses: [], pick: null, done: me.phase === 'done', solved_ms: null, rank: null, points: boardPoints(o.boards[this.done.length], groupById, me) },
      };
    }
    if (!last) {
      return { ...shared, phase: 'countdown', phase_started_at: 0, phase_ends_at: FOK_COUNTDOWN_MS, index: 0, item: null, answer: null, players: base(() => null, () => null), me: null };
    }
    const i = this.done.length - 1;
    return {
      ...shared,
      phase: this.finished && t >= last.end + FOK_REVEAL_MS ? 'done' : 'reveal',
      phase_started_at: last.end,
      phase_ends_at: last.end + FOK_REVEAL_MS,
      index: i,
      item: i + 1,
      answer: null,
      players: base((id) => last.rows[id].run, (id) => last.ranks[id]),
      me: { locked_until: null, wrong: [], guesses: [], pick: null, done: true, solved_ms: null, rank: last.ranks[YOU], points: last.rows[YOU].points },
    };
  }
}
