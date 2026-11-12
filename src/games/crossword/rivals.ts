// Grid showdown (Nova Crossword vs rivals, G5): the claim race on one grid, refereed on the phone.
import type { RaceItemResult, RacePlayer, RaceState } from '../../match/race';
import { afterAnswer, chanceOf, mindFor, moodOf, type Mind } from '../../bots/brain';
import { personaOf } from '../../bots/identity';
import { YOU, type Plan, type Race, type RaceCtx } from '../../bots/race/engine';
import { rng, type Rand } from '../../bots/rng';
import type { Bot, BotType } from '../../bots/types';
import { CW, autoSolved, indexOf, type PuzzleDef } from './core';

/** Stars by place on a puzzle (CW12): 1st 3, 2nd 2, the rest 1, only for players who claimed a word. */
export const showdownStars = (rank: number, words: number) => (words < 1 ? 0 : rank <= 1 ? 3 : rank === 2 ? 2 : 1);

export const CW_COUNTDOWN_MS = 3_000;
export const CW_REVEAL_MS = 6_000;
/** A rival that lands on the word you are typing waits this long and tries another (or the same one, if it is the last). */
const DEFER_MS = 4_000;

/** How long one word takes each type (s), before personality, form and the word's length. */
const WORD_S: Record<BotType, [number, number]> = { genius: [25, 50], scholar: [40, 75], freshman: [60, 110] };

/** One attempt in a rival's plan: how long it spends, and whether it gets the word. The word itself is chosen when the attempt lands. */
export type Attempt = { ms: number; right: boolean };

/**
 * A rival's next attempt on the grid: how long it takes and whether it is right, from its type, hidden personality,
 * form and the gap to you. Pure and seeded, so the same match replays the same way.
 */
export function nextAttempt(mind: Mind, a: { seed: string; n: number; len: number; gap: number; progress: number; limitMs: number }): Attempt {
  const r: Rand = rng(`${a.seed}:${mind.bot.id}:cw:${a.n}`);
  const p = mind.bot.persona ?? personaOf(mind.bot.name);
  const mood = moodOf(mind);
  const [lo, hi] = WORD_S[mind.bot.type];
  let s = lo + r() * (hi - lo);
  s *= 0.8 + 0.04 * a.len; // a long word takes longer
  if (p === 'showoff') s *= 0.85;
  if (p === 'shy') s *= 1.1;
  if (p === 'sleepy' && a.progress < 0.35) s *= 1.3;
  if (mood === 'fire') s *= 0.9;
  if (mood === 'tilt') s *= p === 'hot' ? 0.9 : 1.1;
  if (r() < 0.15) s *= 1.3; // stuck on a clue now and then
  const hard = Math.min(1, Math.max(0, (a.len - 5) / 8)); // longer answers are harder
  const right = r() < chanceOf(mind, { seed: a.seed, limitMs: a.limitMs, hard, gap: a.gap, progress: a.progress });
  return { ms: Math.round(s * 1000), right };
}

type Claim = { word_id: string; user_id: string; at_ms: number; auto: boolean };
type Seat = { hearts: number; revived: boolean; /** Out of hearts and not coming back (declined, or a rival). */ out: boolean; /** Letters this puzzle. */ points: number; words: number; tried: Record<string, string[]>; lastAt: number };
type Rival = { next: { at: number; right: boolean } | null; n: number; order: string[] };
type Cur = { start: number; limit: number; seats: Record<string, Seat>; rivals: Record<string, Rival>; claims: Claim[]; open: string | null };
type Done = { start: number; end: number; seats: Record<string, Seat>; claims: Claim[]; ranks: Record<string, number> };

export type Submit = 'right' | 'wrong' | 'repeat' | 'taken' | 'ignored';

/**
 * The claim race: everyone works the same grid; the first right answer claims a word and its letters, and a crossing
 * word it completes comes with it. A wrong answer costs a heart; at 0 hearts you may revive once (a token), a rival is
 * out. The puzzle ends when every word is claimed, everyone is out, or time is up; then a reveal, then the next
 * puzzle (1 to 3). A rival never takes the word you have open.
 */
export class CwRace implements Race {
  readonly rivals: Bot[];
  private minds: Record<string, Mind> = {};
  private score: Record<string, number> = {};
  private done: Done[] = [];
  private cur: Cur | null = null;
  private finished = false;

  constructor(
    readonly opts: RaceCtx & { puzzleOf: (item: number) => PuzzleDef; limitMs: number },
  ) {
    this.rivals = opts.rivals;
    for (const b of opts.rivals) this.minds[b.id] = mindFor(b, opts.playerLevel);
    for (const id of this.ids) this.score[id] = 0;
  }

  private get ids() {
    return [YOU, ...this.opts.rivals.map((b) => b.id)];
  }
  get total() {
    return this.opts.items.length;
  }
  mindOf(id: string) {
    return this.minds[id];
  }
  plansNow(): Record<string, Plan> | null {
    return this.cur ? {} : null;
  }
  puzzleNow() {
    return this.cur ? this.opts.puzzleOf(this.opts.items[this.done.length]) : null;
  }

  /** The word you have open (a rival leaves it alone), or null. */
  setOpen(wordId: string | null) {
    if (this.cur) this.cur.open = wordId;
  }

  private seatFresh = (): Seat => ({ hearts: CW.onlineHearts, revived: false, out: false, points: 0, words: 0, tried: {}, lastAt: 0 });

  private startItem(i: number, at: number) {
    const p = this.opts.puzzleOf(this.opts.items[i]);
    const seats: Record<string, Seat> = {};
    for (const id of this.ids) seats[id] = this.seatFresh();
    const rivals: Record<string, Rival> = {};
    for (const b of this.rivals) {
      // Each rival has its own idea of where to start on the grid.
      const r = rng(`${this.opts.playId}:${i}:${b.id}:order`);
      const order = p.words.map((w) => w.id);
      for (let k = order.length - 1; k > 0; k--) {
        const j = Math.floor(r() * (k + 1));
        [order[k], order[j]] = [order[j], order[k]];
      }
      rivals[b.id] = { next: null, n: 0, order };
    }
    this.cur = { start: at, limit: at + this.opts.limitMs, seats, rivals, claims: [], open: null };
    for (const b of this.rivals) this.schedule(b.id, at);
  }

  /** Plans a rival's next attempt from `from`. */
  private schedule(id: string, from: number) {
    const c = this.cur!;
    const rv = c.rivals[id];
    const i = this.done.length;
    const p = this.opts.puzzleOf(this.opts.items[i]);
    const stake = Math.max(1, p.words.reduce((a, w) => a + w.answer.length, 0));
    const gap = (c.seats[id].points - c.seats[YOU].points) / stake;
    const target = this.wordFor(id);
    const len = target ? p.words.find((w) => w.id === target)!.answer.length : 7;
    const a = nextAttempt(this.minds[id], { seed: `${this.opts.playId}:${i}`, n: rv.n, len, gap, progress: i / Math.max(1, this.total), limitMs: this.opts.limitMs });
    rv.n++;
    rv.next = { at: from + a.ms, right: a.right };
  }

  /** The unclaimed word this rival goes for now (never the one you have open, unless it is the last). */
  private wordFor(id: string, allowOpen = false): string | null {
    const c = this.cur!;
    const claimed = new Set(c.claims.map((x) => x.word_id));
    const free = c.rivals[id].order.filter((w) => !claimed.has(w));
    const w = free.find((x) => allowOpen || x !== c.open);
    return w ?? null;
  }

  private claim(p: PuzzleDef, id: string, wordId: string, at: number) {
    const c = this.cur!;
    const idx = indexOf(p);
    const solved = c.claims.map((x) => x.word_id);
    const got = [wordId, ...autoSolved(idx, [...solved, wordId])];
    const seat = c.seats[id];
    for (const [k, w] of got.entries()) {
      c.claims.push({ word_id: w, user_id: id, at_ms: at - c.start, auto: k > 0 });
      seat.points += idx.wordById.get(w)!.answer.length;
    }
    seat.words++;
    seat.lastAt = at;
    this.score[id] += got.reduce((a, w) => a + idx.wordById.get(w)!.answer.length, 0);
    return got;
  }

  /** A rival's attempt lands. */
  private land(id: string, at: number) {
    const c = this.cur!;
    const rv = c.rivals[id];
    const right = rv.next!.right;
    const p = this.puzzleNow()!;
    const w = this.wordFor(id);
    if (!w) {
      // Only the word you have open is left: wait for you a moment, then take it if it is still free.
      if (this.wordFor(id, true)) rv.next = { at: at + DEFER_MS, right };
      else rv.next = null;
      if (rv.next && at + DEFER_MS > c.limit) rv.next = null;
      return;
    }
    const seat = c.seats[id];
    if (right) this.claim(p, id, w, at);
    else {
      seat.hearts--;
      if (seat.hearts <= 0) seat.out = true;
    }
    this.minds[id] = afterAnswer(this.minds[id], right);
    if (seat.out) rv.next = null;
    else this.schedule(id, at);
  }

  private allClaimed(p: PuzzleDef) {
    return this.cur!.claims.length >= p.words.length;
  }

  /** The puzzle's end, if it has come by `t`: the grid full, everyone out, or time up. */
  private endOf(t: number): number | null {
    const c = this.cur!;
    const p = this.puzzleNow()!;
    if (this.allClaimed(p)) return Math.max(c.start, ...c.claims.map((x) => c.start + x.at_ms));
    if (this.ids.every((id) => c.seats[id].out)) return Math.max(c.start, ...this.ids.map((id) => c.seats[id].lastAt));
    return t >= c.limit ? c.limit : null;
  }

  private closeItem(end: number) {
    const c = this.cur!;
    const order = [...this.ids].sort((a, b) => c.seats[b].points - c.seats[a].points || c.seats[a].lastAt - c.seats[b].lastAt || (a === YOU ? -1 : 1));
    const ranks: Record<string, number> = {};
    order.forEach((id, k) => (ranks[id] = k + 1));
    this.done.push({ start: c.start, end, seats: c.seats, claims: c.claims, ranks });
    this.cur = null;
  }

  /** Moves the match up to match time `t`, landing the rivals' attempts in order. */
  sync(t: number) {
    for (let guard = 0; guard < 5000 && !this.finished; guard++) {
      if (!this.cur) {
        const i = this.done.length;
        if (i >= this.total) {
          this.finished = true;
          break;
        }
        const at = i === 0 ? CW_COUNTDOWN_MS : this.done[i - 1].end + CW_REVEAL_MS;
        if (t < at) break;
        this.startItem(i, at);
      }
      const c = this.cur!;
      const end = this.endOf(t);
      // The next rival attempt before the end (and before t).
      let who: string | null = null;
      for (const b of this.rivals) {
        const n = c.rivals[b.id].next;
        if (n && n.at <= t && (end == null || n.at <= end) && (!who || n.at < c.rivals[who].next!.at)) who = b.id;
      }
      if (who && c.rivals[who].next!.at < c.limit) {
        this.land(who, c.rivals[who].next!.at);
        continue;
      }
      if (end == null || t < end) break;
      this.closeItem(end);
    }
    return this;
  }

  // ---- your moves (t = match time) ----

  /** Your full answer for a word. */
  submit(t: number, wordId: string, answer: string): Submit {
    this.sync(t);
    const c = this.cur;
    if (!c) return 'ignored';
    const p = this.puzzleNow()!;
    const w = indexOf(p).wordById.get(wordId);
    const me = c.seats[YOU];
    if (!w || me.hearts <= 0 || me.out) return 'ignored';
    if (c.claims.some((x) => x.word_id === wordId)) return 'taken';
    if (answer === w.answer) {
      this.claim(p, YOU, wordId, t);
      this.sync(t);
      return 'right';
    }
    if ((me.tried[wordId] ?? []).includes(answer)) return 'repeat';
    me.tried[wordId] = [...(me.tried[wordId] ?? []), answer];
    me.hearts--;
    me.lastAt = t;
    this.sync(t);
    return 'wrong';
  }

  /** The token revive: one heart back, as often as you pay, like Solo (Yazan 2026-11-12). */
  revive(t: number) {
    this.sync(t);
    const me = this.cur?.seats[YOU];
    if (!me || me.hearts > 0 || me.out) return false;
    me.hearts = CW.reviveHearts;
    me.revived = true;
    return true;
  }

  /** No revive: you watch the rest of the puzzle. */
  decline(t: number) {
    this.sync(t);
    const me = this.cur?.seats[YOU];
    if (!me || me.hearts > 0) return;
    me.out = true;
    me.lastAt = t;
    this.sync(t);
  }

  // ---- the state the screen draws ----

  state(t: number): RaceState {
    this.sync(t);
    const o = this.opts;
    const base = (seats: Record<string, Seat> | null, extra: (id: string) => Partial<RacePlayer>): RacePlayer[] => {
      const rows = [{ id: YOU, name: 'You', character: o.you.character, team: o.you.team }, ...o.rivals.map((b) => ({ id: b.id, name: b.name, character: b.character, team: b.team ?? null }))];
      const ps: RacePlayer[] = rows.map((p) => {
        const s = seats?.[p.id];
        return {
          user_id: p.id,
          name: p.name,
          character: p.character,
          team: p.team,
          score: this.score[p.id],
          solve_ms: 0,
          dropped: false,
          rank: null,
          streak: 0,
          best_streak: 0,
          correct: 0,
          done: s ? s.out : false,
          solved: s ? s.words > 0 : false,
          item_rank: null,
          item_points: s ? s.points : null,
          tries: 0,
          greens: null,
          hearts: s ? s.hearts : CW.onlineHearts,
          revived: s ? s.revived : false,
          ...extra(p.id),
        };
      });
      const order = [...ps].sort((a, b) => b.score - a.score || (a.user_id === YOU ? -1 : 1));
      return ps.map((p) => ({ ...p, rank: order.indexOf(p) + 1 }));
    };
    const myItems: RaceItemResult[] = this.done.map((d, i) => ({ index: i, item: o.items[i], solved_ms: d.seats[YOU].words ? d.seats[YOU].lastAt - d.start : null, rank: d.ranks[YOU], points: d.seats[YOU].points, wrong: [], guesses: [], pick: null }));
    const claims = [...this.done.flatMap((d) => d.claims), ...(this.cur?.claims ?? [])];
    const tried = { ...Object.assign({}, ...this.done.map((d) => d.seats[YOU].tried)), ...(this.cur?.seats[YOU].tried ?? {}) } as Record<string, string[]>;
    const shared = { now: t, room_id: `bot:${o.playId}`, game: '', total: this.total, settings: o.settings, my_items: myItems, claims, tried };

    if (this.cur) {
      const c = this.cur;
      const me = c.seats[YOU];
      return {
        ...shared,
        phase: 'case',
        phase_started_at: c.start,
        phase_ends_at: c.limit,
        index: this.done.length,
        item: o.items[this.done.length],
        answer: null,
        players: base(c.seats, () => ({})),
        me: { locked_until: null, wrong: [], guesses: [], pick: null, done: me.out, solved_ms: me.words ? me.lastAt - c.start : null, rank: null, points: me.points },
      };
    }
    const last = this.done[this.done.length - 1];
    if (!last) {
      return { ...shared, phase: 'countdown', phase_started_at: 0, phase_ends_at: CW_COUNTDOWN_MS, index: 0, item: null, answer: null, players: base(null, () => ({})), me: null };
    }
    const i = this.done.length - 1;
    return {
      ...shared,
      phase: this.finished && t >= last.end + CW_REVEAL_MS ? 'done' : 'reveal',
      phase_started_at: last.end,
      phase_ends_at: last.end + CW_REVEAL_MS,
      index: i,
      item: o.items[i],
      answer: null,
      players: base(last.seats, (id) => ({ done: true, item_rank: last.ranks[id] })),
      me: { locked_until: null, wrong: [], guesses: [], pick: null, done: true, solved_ms: null, rank: last.ranks[YOU], points: last.seats[YOU].points },
    };
  }
}
