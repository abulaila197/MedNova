// Nova Medicordle rules engine: pure functions, no React. Decisions NM1-NM25 in build/shared-rules.md.

export type Style = 'classic' | 'custom';

/** A word from the bank. `dossier` is the canonical disease id for the results link (RS1), when there is one. */
export type Word = { id: string; style: Style; word: string; definition: string; dossier: string | null };

/** ok = right letter, right place (green); near = in the word, wrong place (yellow); off = not in the word (grey);
 *  missing = a column past the end of a short Custom guess (grey, NM4). */
export type Mark = 'ok' | 'near' | 'off' | 'missing';

export const MAX_ROWS = 6;
export const CLASSIC_LEN = 6;
export const CUSTOM_MIN = 7;
export const CUSTOM_MAX = 15;

/** NM23: up to two letter hints per Custom word, 1 token then 2 tokens. */
export const HINT_COSTS = [1, 2];

/** Scores one guess against the answer, with the usual duplicate-letter rule: greens first, then yellows left to right
 *  from the answer letters that are left (including the columns a short guess doesn't reach). */
export function score(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array.from({ length: answer.length }, (_, i) => (i < guess.length ? 'off' : 'missing'));
  const pool: Record<string, number> = {};
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) marks[i] = 'ok';
    else pool[answer[i]] = (pool[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === 'ok') continue;
    const ch = guess[i];
    if (pool[ch] > 0) {
      marks[i] = 'near';
      pool[ch]--;
    }
  }
  return marks;
}

/** Why a guess can't be played; costs no try (NM2). */
export type Reject = 'short' | 'long' | 'unknown';

/** Length rule: Classic is exactly 6; Custom is 7 up to the answer's length (NM4). */
export function lengthCheck(guess: string, style: Style, answerLen: number): Reject | null {
  const min = style === 'classic' ? CLASSIC_LEN : CUSTOM_MIN;
  const max = style === 'classic' ? CLASSIC_LEN : answerLen;
  if (guess.length < min) return 'short';
  if (guess.length > max) return 'long';
  return null;
}

/** Binary search in one length's sorted, fixed-width string from guesses.json. */
export function inList(packed: string | undefined, word: string): boolean {
  if (!packed) return false;
  const w = word.length;
  let lo = 0;
  let hi = packed.length / w - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = packed.slice(mid * w, mid * w + w);
    if (s === word) return true;
    if (s < word) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}

/** Best result per keyboard letter: green beats yellow beats grey (NM21). */
export function keyStates(guesses: string[], answer: string): Record<string, 'ok' | 'near' | 'off'> {
  const rank = { off: 0, near: 1, ok: 2 } as const;
  const out: Record<string, 'ok' | 'near' | 'off'> = {};
  for (const g of guesses) {
    score(g, answer).forEach((m, i) => {
      if (m === 'missing') return;
      const ch = g[i];
      if (!out[ch] || rank[m] > rank[out[ch]]) out[ch] = m;
    });
  }
  return out;
}

/** Columns already green in any guess. */
export function greenColumns(guesses: string[], answer: string): Set<number> {
  const s = new Set<number>();
  for (const g of guesses) score(g, answer).forEach((m, i) => m === 'ok' && s.add(i));
  return s;
}

/**
 * NM3 letter hint (Custom only), the case doc's rule: look at the answer's columns that are not green yet
 * (and not already revealed), take the letter that repeats most among them, ties at random, and if nothing
 * repeats pick one at random. Reveals every one of those columns holding that letter. Null when nothing is left.
 */
export function pickHint(answer: string, guesses: string[], revealed: number[], rng: () => number = Math.random): { letter: string; columns: number[] } | null {
  const green = greenColumns(guesses, answer);
  const open = [...answer].map((ch, i) => ({ ch, i })).filter((x) => !green.has(x.i) && !revealed.includes(x.i));
  if (!open.length) return null;
  const count: Record<string, number> = {};
  for (const x of open) count[x.ch] = (count[x.ch] ?? 0) + 1;
  const top = Math.max(...Object.values(count));
  const letters = Object.keys(count).filter((ch) => count[ch] === top).sort();
  const letter = letters[Math.min(letters.length - 1, Math.floor(rng() * letters.length))];
  return { letter, columns: open.filter((x) => x.ch === letter).map((x) => x.i) };
}

/** NM11 "close" alert threshold: two-thirds of the letters green, rounded up (4 of 6 in Classic). */
export const closeThreshold = (len: number) => Math.ceil((len * 2) / 3);
export const isClose = (guesses: string[], answer: string) => greenColumns(guesses, answer).size >= closeThreshold(answer.length);

/** NM22 Solo EXP by the guess that solved it: 12, 10, 8, 6, 4, 2; a miss is 0. Daily words earn double. */
export function soloExp(solvedOnGuess: number | null, daily: boolean): number {
  if (!solvedOnGuess || solvedOnGuess < 1 || solvedOnGuess > MAX_ROWS) return 0;
  return (14 - 2 * solvedOnGuess) * (daily ? 2 : 1);
}

/** NM14: rows round up to full laps so every player gets the same number of guesses. */
export function offlineRows(players: number): number {
  if (players <= 1) return MAX_ROWS;
  return Math.ceil(MAX_ROWS / players) * players;
}

/**
 * NM14: one lap = every active player once, in a random order, never starting with the player who
 * took the last turn (so nobody plays twice in a row, across laps and words). With 2 players this is strict alternation.
 */
export function nextLap(seats: number[], last: number | null, rng: () => number = Math.random): number[] {
  const a = [...seats];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (a.length > 1 && last != null && a[0] === last) {
    const k = 1 + Math.floor(rng() * (a.length - 1));
    [a[0], a[k]] = [a[k], a[0]];
  }
  return a;
}

/** Share card (NM7): coloured squares only, never letters. */
export function shareText(title: string, rows: Mark[][], solved: boolean): string {
  const sq: Record<Mark, string> = { ok: '🟩', near: '🟨', off: '⬛', missing: '⬛' };
  return [`${title} ${solved ? rows.length : 'X'}/${MAX_ROWS}`, '', ...rows.map((r) => r.map((m) => sq[m]).join(''))].join('\n');
}

// ---- Daily words (NM5, NM6): picked from the local date, the same for everyone, works offline. ----

/** Day 1 of the daily number shown on the slide label. */
const EPOCH = Date.UTC(2026, 9, 1);

/** Whole days since the epoch for a local calendar date. */
export function dayNumber(d: Date): number {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 86_400_000);
}

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Small seeded generator, so every phone shuffles the bank the same way. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The daily word for a style: a fixed shuffle of the bank walked one per day, so no word repeats until the bank runs out. */
export function dailyWord<T extends { id: string }>(pool: T[], style: Style, day: number): T {
  const order = [...pool].sort((a, b) => (a.id < b.id ? -1 : 1));
  const cycle = Math.floor(day / order.length);
  const rng = seeded((style === 'classic' ? 0x51ed : 0xc0de) + cycle * 7919);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order[((day % order.length) + order.length) % order.length];
}

/** Daily streak (NM7): consecutive days solved; a missed or failed day resets it. */
export type Streak = { current: number; best: number; lastDay: number | null };
export function bumpStreak(s: Streak, day: number, solved: boolean): Streak {
  if (s.lastDay === day) return s;
  const current = solved ? (s.lastDay === day - 1 ? s.current + 1 : 1) : 0;
  return { current, best: Math.max(s.best, current), lastDay: day };
}
/** What the label shows today: yesterday's streak still counts until today is played. */
export const liveStreak = (s: Streak, day: number) => (s.lastDay != null && day - s.lastDay <= 1 ? s.current : 0);
