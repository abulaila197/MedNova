// The Wheels of Chaos core: the three wheels, the 7 question styles, judging, and one player's turn as a
// pure reducer. Solo (WC1) is an endless run of turns until the point target; no cards, boss or redemption.
// Ported from the old Python engine (wheels.py, scoring.py, models.py).

export type Rng = () => number;

export type Style = 'mcq' | 'tf' | 'r2o' | 'match' | 'riddle' | 'reverse' | 'lie';
export type FieldKey =
  | 'anatomy' | 'physiology' | 'pathology' | 'pharmacology' | 'microbiology' | 'biochemistry'
  | 'medicine' | 'surgery' | 'pediatrics' | 'obgyn';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme';

export const STYLES: Record<Style, { name: string; points: number; seconds: number }> = {
  mcq: { name: 'Direct MCQ', points: 1, seconds: 20 },
  tf: { name: 'True or False', points: 1, seconds: 15 },
  r2o: { name: 'Rule 2 Out', points: 2, seconds: 30 },
  match: { name: 'Matching', points: 3, seconds: 30 },
  riddle: { name: 'Riddle MCQ', points: 1, seconds: 20 },
  reverse: { name: 'Reverse Question', points: 2, seconds: 30 },
  lie: { name: 'Three Truths and a Lie', points: 2, seconds: 30 },
};
export const STYLE_KEYS = Object.keys(STYLES) as Style[];

export const FIELDS: { key: FieldKey; name: string; group: 'basic' | 'clinical' }[] = [
  { key: 'anatomy', name: 'Anatomy', group: 'basic' },
  { key: 'physiology', name: 'Physiology', group: 'basic' },
  { key: 'pathology', name: 'Pathology', group: 'basic' },
  { key: 'pharmacology', name: 'Pharmacology', group: 'basic' },
  { key: 'microbiology', name: 'Microbiology', group: 'basic' },
  { key: 'biochemistry', name: 'Biochemistry', group: 'basic' },
  { key: 'medicine', name: 'Internal Medicine', group: 'clinical' },
  { key: 'surgery', name: 'Surgery', group: 'clinical' },
  { key: 'pediatrics', name: 'Pediatrics', group: 'clinical' },
  { key: 'obgyn', name: 'Obs & Gynae', group: 'clinical' },
];
export const fieldName = (k: FieldKey) => FIELDS.find((f) => f.key === k)?.name ?? k;

/** Wheel 1: one, two or three questions at 40/35/25. */
export const COUNT_WEIGHTS: [number, number][] = [[1, 0.4], [2, 0.35], [3, 0.25]];
/** Wheel 3: the 6 basic fields share half, the 4 clinical fields share the other half. */
export const FIELD_WEIGHTS: [FieldKey, number][] = FIELDS.map((f) => [f.key, f.group === 'basic' ? 0.5 / 6 : 0.5 / 4]);

/** QS1: the setup's question type. Clinical or Basic spins only that group's fields; Mixed keeps the half-and-half wheel. */
export type Mix = 'mixed' | 'clinical' | 'basic';
export const MIXES: { value: Mix; label: string }[] = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'clinical', label: 'Clinical' },
  { value: 'basic', label: 'Basic science' },
];
export const fieldWeights = (mix: Mix = 'mixed'): [FieldKey, number][] =>
  mix === 'mixed' ? FIELD_WEIGHTS : FIELDS.filter((f) => f.group === mix).map((f) => [f.key, 1]);

export const TARGETS = [50, 100] as const;
export type Target = (typeof TARGETS)[number];
export const FEEDBACK_MS = { right: 1100, wrong: 1800 }; // as coded
export const STAR_WINDOW_MS = 3000; // WC5

// ---------------------------------------------------------------- questions

/** round: a Redemption question's written round of 10 (WC19). */
type Base = { id: string; field: FieldKey; difficulty: Difficulty; prompt: string; round?: number };
export type Question =
  | (Base & { style: 'mcq' | 'riddle' | 'reverse'; choices: string[]; answer: number })
  | (Base & { style: 'tf'; answer: boolean })
  | (Base & { style: 'r2o'; items: string[]; out: [number, number] })
  | (Base & { style: 'match'; pairs: [string, string][] })
  | (Base & { style: 'lie'; statements: string[]; lie: number });

/**
 * A submitted answer: a choice index (MCQ, riddle, reverse, lie), true/false, the two ruled-out item
 * indexes (r2o), or for matching the right-hand pair index picked for each left item. null = time up.
 */
export type Answer = number | boolean | number[] | null;

export function judge(q: Question, a: Answer): boolean {
  if (a == null) return false;
  switch (q.style) {
    case 'mcq': case 'riddle': case 'reverse': return a === q.answer;
    case 'tf': return a === q.answer;
    case 'lie': return a === q.lie;
    case 'r2o': // all or nothing: exactly the two
      return Array.isArray(a) && a.length === 2 && new Set(a).size === 2 && a.every((i) => q.out.includes(i as 0));
    case 'match': // all or nothing: every left item to its own right item
      return Array.isArray(a) && a.length === q.pairs.length && a.every((r, i) => r === i);
  }
}

export const pointsFor = (q: Question, right: boolean) => (right ? STYLES[q.style].points : 0);

export type Bank = { questions: Question[] };

/**
 * A question for a wheel result. An exhausted Style+Field pool repeats (spec 11). While the bank is
 * still the sample set, a missing pool falls back to the same style in any field, then anything.
 */
export function pickQuestion(bank: Bank, style: Style, field: FieldKey, seen: readonly string[], rng: Rng): Question {
  const pools = [
    bank.questions.filter((q) => q.style === style && q.field === field),
    bank.questions.filter((q) => q.style === style),
    bank.questions,
  ];
  const pool = pools.find((p) => p.length)!;
  const fresh = pool.filter((q) => !seen.includes(q.id));
  const from = fresh.length ? fresh : pool;
  return from[Math.floor(rng() * from.length)];
}

// ---------------------------------------------------------------- wheels

function weighted<T>(items: [T, number][], rng: Rng): T {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [v, w] of items) {
    if ((r -= w) < 0) return v;
  }
  return items[items.length - 1][0];
}

export const spinCount = (rng: Rng) => weighted(COUNT_WEIGHTS, rng);
export const spinStyle = (rng: Rng) => STYLE_KEYS[Math.floor(rng() * STYLE_KEYS.length)];
export const spinField = (rng: Rng, mix: Mix = 'mixed') => weighted(fieldWeights(mix), rng);

export type Combo = { style: Style; field: FieldKey };

/** Style then Field; the same pair as the turn's previous question re-spins once (spec 3.4). */
export function spinCombo(prev: Combo | null, rng: Rng, mix: Mix = 'mixed'): Combo {
  let c = { style: spinStyle(rng), field: spinField(rng, mix) };
  if (prev && c.style === prev.style && c.field === prev.field) c = { style: spinStyle(rng), field: spinField(rng, mix) };
  return c;
}

export function shuffle<T>(xs: readonly T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------- one turn

export type QResult = { id: string; style: Style; field: FieldKey; right: boolean; points: number; answer: Answer };

export type TurnPhase = 'reveal' | 'star' | 'question' | 'feedback' | 'over';

export type Turn = {
  count: number;
  k: number; // question index, 0-based
  combo: Combo;
  question: Question;
  phase: TurnPhase;
  /** Question timer, Star window or feedback end. */
  until: number | null;
  /** WC5: the Star re-spin is still open for the first question. */
  star: 'pending' | 'used' | 'none';
  /** The Sun doubles the turn's points. */
  sun: boolean;
  mix: Mix;
  results: QResult[];
  seen: string[];
  pausedAt: number | null;
};

export type TurnEvent =
  | { type: 'GO'; now: number } // wheels finished spinning on screen
  | { type: 'STAR'; now: number } // re-spin the field (WC5)
  | { type: 'KEEP'; now: number } // keep the field, skip the Star window
  | { type: 'ANSWER'; answer: Answer; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number };

export function startTurn(bank: Bank, seen: readonly string[], rng: Rng, opts: { star?: boolean; sun?: boolean; mix?: Mix } = {}): Turn {
  const mix = opts.mix ?? 'mixed';
  const count = spinCount(rng);
  const combo = spinCombo(null, rng, mix);
  const question = pickQuestion(bank, combo.style, combo.field, seen, rng);
  return {
    count, k: 0, combo, question, phase: 'reveal', until: null,
    star: opts.star ? 'pending' : 'none', sun: !!opts.sun, mix, results: [], seen: [...seen, question.id], pausedAt: null,
  };
}

export const turnPoints = (t: Turn) => t.results.reduce((a, r) => a + r.points, 0) * (t.sun ? 2 : 1);

function ask(t: Turn, now: number): Turn {
  return { ...t, phase: 'question', until: now + STYLES[t.question.style].seconds * 1000 };
}

function answer(t: Turn, a: Answer, now: number): Turn {
  const right = judge(t.question, a);
  const r: QResult = { id: t.question.id, style: t.question.style, field: t.question.field, right, points: pointsFor(t.question, right), answer: a };
  return { ...t, phase: 'feedback', until: now + (right ? FEEDBACK_MS.right : FEEDBACK_MS.wrong), results: [...t.results, r] };
}

function nextQuestion(t: Turn, bank: Bank, rng: Rng): Turn {
  if (t.k + 1 >= t.count) return { ...t, phase: 'over', until: null };
  const combo = spinCombo(t.combo, rng, t.mix);
  const question = pickQuestion(bank, combo.style, combo.field, t.seen, rng);
  return { ...t, k: t.k + 1, combo, question, phase: 'reveal', until: null, seen: [...t.seen, question.id] };
}

export function stepTurn(t: Turn, e: TurnEvent, bank: Bank, rng: Rng): Turn {
  if (t.phase === 'over') return t;
  if (e.type === 'PAUSE') return t.pausedAt == null ? { ...t, pausedAt: e.now } : t;
  if (e.type === 'RESUME') {
    if (t.pausedAt == null) return t;
    const d = e.now - t.pausedAt;
    return { ...t, pausedAt: null, until: t.until == null ? null : t.until + d };
  }
  if (t.pausedAt != null) return t;
  switch (e.type) {
    case 'GO':
      if (t.phase !== 'reveal') return t;
      // WC5: the Star window sits between the first wheels and the first question.
      if (t.k === 0 && t.star === 'pending') return { ...t, phase: 'star', until: e.now + STAR_WINDOW_MS };
      return ask(t, e.now);
    case 'STAR': {
      if (t.phase !== 'star') return t;
      const field = spinField(rng, t.mix);
      const combo = { style: t.combo.style, field };
      const question = pickQuestion(bank, combo.style, field, t.seen.slice(0, -1), rng);
      return { ...t, combo, question, phase: 'reveal', star: 'used', until: null, seen: [...t.seen.slice(0, -1), question.id] };
    }
    case 'KEEP':
      return t.phase === 'star' ? ask({ ...t, star: 'used' }, e.now) : t;
    case 'ANSWER':
      return t.phase === 'question' ? answer(t, e.answer, e.now) : t;
    case 'TICK':
      if (t.until == null || e.now < t.until) return t;
      if (t.phase === 'star') return ask({ ...t, star: 'used' }, e.now);
      if (t.phase === 'question') return answer(t, null, e.now);
      if (t.phase === 'feedback') return nextQuestion(t, bank, rng);
      return t;
  }
}

/** Time left on the current timer, frozen while paused. */
export const timeLeft = (t: Turn, now: number) => (t.until == null ? 0 : Math.max(0, t.until - (t.pausedAt ?? now)));

// ---------------------------------------------------------------- Solo (WC1)

export type SoloRun = {
  target: Target;
  mix: Mix;
  score: number;
  turnNo: number;
  turn: Turn | null;
  /** 'turnOver' shows the points between turns; 'done' once the target is reached. */
  phase: 'turn' | 'turnOver' | 'done';
  history: QResult[];
  seen: string[];
};

export type SoloEvent = TurnEvent | { type: 'NEXT' } | { type: 'END' };

export function startSolo(bank: Bank, target: Target, seen: readonly string[], rng: Rng, mix: Mix = 'mixed'): SoloRun {
  const turn = startTurn(bank, seen, rng, { mix });
  return { target, mix, score: 0, turnNo: 1, turn, phase: 'turn', history: [], seen: turn.seen };
}

export function stepSolo(s: SoloRun, e: SoloEvent, bank: Bank, rng: Rng): SoloRun {
  if (s.phase === 'done') return s;
  if (e.type === 'END') return { ...s, phase: 'done', turn: s.turn };
  if (e.type === 'NEXT') {
    if (s.phase !== 'turnOver') return s;
    const turn = startTurn(bank, s.seen, rng, { mix: s.mix });
    return { ...s, turnNo: s.turnNo + 1, turn, phase: 'turn', seen: turn.seen };
  }
  if (s.phase !== 'turn' || !s.turn) return s;
  const turn = stepTurn(s.turn, e, bank, rng);
  if (turn === s.turn) return s;
  if (turn.phase !== 'over') return { ...s, turn, seen: turn.seen };
  const score = s.score + turnPoints(turn);
  return { ...s, turn, seen: turn.seen, score, history: [...s.history, ...turn.results], phase: score >= s.target ? 'done' : 'turnOver' };
}

/** WC11: Solo EXP is half the run's points, rounded down. */
export const soloExp = (points: number) => Math.floor(points / 2);
