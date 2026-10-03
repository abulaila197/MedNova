// Diagnostic Pursuit rules, ported from the original game code (config, attempt, solo scoring, answer search).
// Pure: no clock, no storage. The solo run on top of these lives in solo.ts.

export const DP = {
  clueCount: 6,
  maxGuesses: 6,
  /** Points by clues shown when solved (index 0 = 1 clue shown). */
  cluePoints: [100, 80, 60, 40, 20, 10] as const,
  speedBonusMax: 20,
  fullBonusUntilMs: 30_000,
  zeroBonusAtMs: 120_000,
  hintTokenCost: 1,
  search: { minQueryLength: 2, maxSuggestions: 5 },
};

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Extreme';

export type DPCase = {
  number: number;
  difficulty: Difficulty;
  fields: string[];
  disease: string;
  canonical_id: string;
  /** Guess-list entry that is correct for this case. */
  answer_id: string;
  clues: string[];
};

export type GuessEntry = { id: string; label: string; aliases: string[]; answer: boolean; canonical_id: string | null };

// ---- attempt (one case) ----

export type AttemptStatus = 'active' | 'solved' | 'failed' | 'skipped';
export type Attempt = { cluesShown: number; wrong: string[]; reveals: number; status: AttemptStatus };

export const newAttempt = (): Attempt => ({ cluesShown: 1, wrong: [], reveals: 0, status: 'active' });

export function reveal(a: Attempt): Attempt {
  return a.status === 'active' && a.cluesShown < DP.clueCount ? { ...a, cluesShown: a.cluesShown + 1, reveals: a.reveals + 1 } : a;
}

export type GuessOutcome = 'correct' | 'wrong' | 'wrong_out' | 'ignored';

/** A wrong guess shows the next clue; the 6th wrong guess fails the case. The same wrong pick twice is ignored. */
export function guess(a: Attempt, answerId: string, accepted: boolean): { attempt: Attempt; outcome: GuessOutcome } {
  if (a.status !== 'active') return { attempt: a, outcome: 'ignored' };
  if (accepted) return { attempt: { ...a, status: 'solved' }, outcome: 'correct' };
  if (a.wrong.includes(answerId)) return { attempt: a, outcome: 'ignored' };
  const wrong = [...a.wrong, answerId];
  if (wrong.length >= DP.maxGuesses) return { attempt: { ...a, wrong, status: 'failed' }, outcome: 'wrong_out' };
  return { attempt: { ...a, wrong, cluesShown: Math.min(DP.clueCount, a.cluesShown + 1) }, outcome: 'wrong' };
}

// ---- scoring ----

export function cluePoints(cluesShown: number) {
  const t = DP.cluePoints;
  return t[Math.min(t.length, Math.max(1, Math.trunc(cluesShown))) - 1];
}

/** Full bonus up to 30 s, then linear down to 0 at 2 minutes. */
export function speedBonus(elapsedMs: number) {
  if (elapsedMs <= DP.fullBonusUntilMs) return DP.speedBonusMax;
  if (elapsedMs >= DP.zeroBonusAtMs) return 0;
  return Math.round((DP.speedBonusMax * (DP.zeroBonusAtMs - elapsedMs)) / (DP.zeroBonusAtMs - DP.fullBonusUntilMs));
}

/** Most points a case can give: first clue + full speed bonus = 120. */
export const MAX_CASE_POINTS = DP.cluePoints[0] + DP.speedBonusMax;

// ---- answer search ----

export function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type Indexed = { entry: GuessEntry; main: string; full: string };

export function buildIndex(list: readonly GuessEntry[]): Indexed[] {
  return list.map((entry) => ({ entry, main: normalize(entry.label), full: normalize([entry.label, ...entry.aliases].join(' ')) }));
}

/** Nothing until 2 letters; then up to 5 matches: label prefix, then word prefix (aliases too), then all words. */
export function search(index: readonly Indexed[], raw: string): GuessEntry[] {
  const q = normalize(raw);
  if (q.replace(/\s/g, '').length < DP.search.minQueryLength) return [];
  const tokens = q.split(' ');
  const hits: { e: Indexed; s: number }[] = [];
  for (const e of index) {
    const s = e.main.startsWith(q) ? 0 : (' ' + e.full).includes(' ' + q) ? 1 : tokens.every((t) => e.full.includes(t)) ? 2 : -1;
    if (s >= 0) hits.push({ e, s });
  }
  hits.sort((a, b) => a.s - b.s || a.e.main.length - b.e.main.length || a.e.main.localeCompare(b.e.main));
  return hits.slice(0, DP.search.maxSuggestions).map((h) => h.e.entry);
}
