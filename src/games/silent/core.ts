// The Silent Artist: pure rules shared by Solo and Offline (SA1-SA8, TMG-SA), ported from the old game's
// tested engine (games-src/code/the-silent-artist). No React here, so the engine tests can run it in Node.

export type Word = { id: string; name: string; field: string; aliases: string[]; dossier?: string };
export type Kind = 'drawing' | 'acting';

export const SA = {
  /** SA5: the performer picks 1 of 3 diseases in 10 s, or one is picked for them. */
  pickMs: 10_000,
  options: 3,
  /** SA5: the host picks the turn time. */
  turnChoices: [60, 90, 120] as const,
  /** Offline teams: one steal for the next team. */
  stealMs: 15_000,
  /** Solo practice turn (as coded). */
  soloMs: 60_000,
  /** Words a phone avoids repeating across matches. */
  recentMemory: 50,
  hints: { field: 0.3, lettersStart: 0.4, lettersEnd: 0.9, maxFraction: 0.35, maxLetters: 8 },
  score: { min: 20, max: 100, early: 25, performerShare: 0.5, steal: 10 },
};

/* ------------------------------ random ------------------------------ */

/** FNV-1a: turns a text seed into a number. */
export function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 with its state kept outside, so a whole run stays plain JSON. */
export function nextRandom(state: number): [number, number] {
  const t = (state + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
}

export function shuffle<T>(items: readonly T[], state: number): [T[], number] {
  const a = items.slice();
  let s = state;
  for (let i = a.length - 1; i > 0; i--) {
    const [r, n] = nextRandom(s);
    s = n;
    const j = Math.floor(r * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return [a, s];
}

/* ------------------------------ words ------------------------------ */

/**
 * Picks `count` different words, best first: not used this match and not seen lately, then not used
 * this match, then anything (only when the list runs out). Solo can limit it to some fields.
 */
export function pickWords(pool: readonly Word[], state: number, p: { count: number; used: readonly string[]; recent: readonly string[]; fields?: readonly string[] }): [Word[], number] {
  const fields = p.fields?.length ? new Set(p.fields) : null;
  const eligible = fields ? pool.filter((w) => fields.has(w.field)) : pool;
  const used = new Set(p.used);
  const recent = new Set(p.recent);
  const tiers = [eligible.filter((w) => !used.has(w.id) && !recent.has(w.id)), eligible.filter((w) => !used.has(w.id) && recent.has(w.id)), eligible.filter((w) => used.has(w.id))];
  const out: Word[] = [];
  let s = state;
  for (const tier of tiers) {
    if (out.length >= p.count) break;
    const [mixed, n] = shuffle(tier, s);
    s = n;
    out.push(...mixed.slice(0, p.count - out.length));
  }
  return [out, s];
}

export const remember = (recent: readonly string[], id: string) => [...recent.filter((x) => x !== id), id].slice(-SA.recentMemory);

/* ------------------------------ hints ------------------------------ */

export type HintPlan = { words: number; field: string; fieldAt: number; lettersAt: number; template: string; slots: number[]; times: number[] };
export type HintView = { words: number; field: string | null; mask: string | null };

const guessable = (ch: string) => /[A-Za-z0-9]/.test(ch);
export const countWords = (name: string) => name.trim().split(/\s+/).filter(Boolean).length;

/** How many letters the ladder shows: about a third, at most 8, and never the whole name. */
export function lettersToReveal(n: number) {
  if (n < 2) return 0;
  return Math.min(Math.min(Math.max(Math.floor(n * SA.hints.maxFraction), 1), SA.hints.maxLetters), n - 1);
}

/**
 * SA5 hint ladder, stretched to the turn time: word count from the start, the field at 30%,
 * blanks at 40%, then letters one by one until 90%. Longer names show letters faster.
 */
export function hintPlan(word: Word, turnMs: number, seed: number): HintPlan {
  const name = word.name;
  const positions = [...name].map((ch, i) => (guessable(ch) ? i : -1)).filter((i) => i >= 0);
  const n = lettersToReveal(positions.length);
  const start = Math.round(SA.hints.lettersStart * turnMs);
  const end = Math.round(SA.hints.lettersEnd * turnMs);
  const gap = n > 0 ? (end - start) / n : 0;
  const [order] = shuffle(positions, hashSeed(`hints:${seed}:${word.id}`));
  const slots = order.slice(0, n);
  return {
    words: countWords(name),
    field: word.field,
    fieldAt: Math.round(SA.hints.field * turnMs),
    lettersAt: start,
    template: [...name].map((ch) => (guessable(ch) ? '_' : ch)).join(''),
    slots,
    times: slots.map((_, i) => Math.round(start + (i + 1) * gap)),
  };
}

/** What the room may see `elapsed` ms into the turn. */
export function hintView(word: Word, plan: HintPlan, elapsed: number): HintView {
  let mask: string | null = null;
  if (elapsed >= plan.lettersAt) {
    const chars = [...plan.template];
    plan.slots.forEach((pos, i) => {
      if (plan.times[i] <= elapsed) chars[pos] = word.name[pos];
    });
    mask = chars.join('');
  }
  return { words: plan.words, field: elapsed >= plan.fieldAt ? plan.field : null, mask };
}

/** Which rung the ladder is on (for the little progress dots): 0 words, 1 field, 2 blanks, 3 letters. */
export function hintStage(plan: HintPlan, elapsed: number) {
  if (elapsed >= (plan.times[0] ?? Infinity)) return 3;
  if (elapsed >= plan.lettersAt) return 2;
  if (elapsed >= plan.fieldAt) return 1;
  return 0;
}

/* ------------------------------ scoring ------------------------------ */

/** SA7 guesser points: 100 down to 20 by time left, +25 if guessed before the field showed. */
export function guesserPoints(elapsed: number, turnMs: number, fieldAt: number) {
  const left = Math.min(1, Math.max(0, (turnMs - elapsed) / turnMs));
  return Math.round(SA.score.min + (SA.score.max - SA.score.min) * left + (elapsed < fieldAt ? SA.score.early : 0));
}

/** Offline individuals: the performer earns half of what the guesser scored (as coded). */
export const performerShare = (points: number) => Math.round(points * SA.score.performerShare);
