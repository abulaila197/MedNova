// Nova Crossword: pure rules for the grid, the answer popup, Solo (CW2-CW4, CW8, CW9) and the shared helpers.
// Ported from the coded engine (games-src/code/nova-crosswords/src/core). A puzzle is a freeform grid whose
// words start empty; solving a word locks its letters into every crossing word.

export type Direction = 'across' | 'down';
export type CellPos = { r: number; c: number };
/** "row,col" */
export type CellKey = string;
export type Stars = 0 | 1 | 2 | 3;
export type Rng = () => number;

export type Question = { kind: 'text'; text: string } | { kind: 'image'; imageKey: string };

export type WordDef = {
  id: string;
  /** Uppercase A-Z only. */
  answer: string;
  direction: Direction;
  start: CellPos;
  category: string;
  question: Question;
  /** CW1: disease answers link their dossier; the rest become term cards in Today's review. */
  dossier?: string;
};

export type PuzzleDef = { id: string; level: number; rows: number; cols: number; words: WordDef[] };

export const CW = {
  hearts: 5, // CW2: per puzzle (Solo), per player (Offline)
  /** CW4: a hint costs 1 token and reveals a third of the word's empty letters. */
  hintPrice: 1,
  /** CW3: a token revive gives 1 heart (Solo unlimited, Offline once per player). */
  revivePrice: 1,
  reviveHearts: 1,
  /** CW9: 4 EXP per star; replays pay only for stars above the best. */
  expPerStar: 4,
  maxGrid: 15,
  minWords: 10,
};

export const QWERTY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'] as const;

// ---- Grid ----

export const cellKey = (p: CellPos): CellKey => `${p.r},${p.c}`;

export function wordCells(w: WordDef): CellPos[] {
  return Array.from({ length: w.answer.length }, (_, i) => (w.direction === 'across' ? { r: w.start.r, c: w.start.c + i } : { r: w.start.r + i, c: w.start.c }));
}

export type PuzzleIndex = {
  puzzle: PuzzleDef;
  wordById: Map<string, WordDef>;
  cellsOf: Map<string, CellPos[]>;
  /** Word ids covering a cell (1 or 2), across first. */
  wordsAt: Map<CellKey, string[]>;
  letterAt: Map<CellKey, string>;
};

const cache = new WeakMap<PuzzleDef, PuzzleIndex>();

export function indexOf(puzzle: PuzzleDef): PuzzleIndex {
  const hit = cache.get(puzzle);
  if (hit) return hit;
  const wordById = new Map<string, WordDef>();
  const cellsOf = new Map<string, CellPos[]>();
  const wordsAt = new Map<CellKey, string[]>();
  const letterAt = new Map<CellKey, string>();
  for (const w of puzzle.words) {
    wordById.set(w.id, w);
    const cells = wordCells(w);
    cellsOf.set(w.id, cells);
    cells.forEach((cell, i) => {
      const k = cellKey(cell);
      wordsAt.set(k, [...(wordsAt.get(k) ?? []), w.id]);
      if (!letterAt.has(k)) letterAt.set(k, w.answer[i]);
    });
  }
  const rank = (id: string) => (wordById.get(id)!.direction === 'across' ? 0 : 1);
  for (const ids of wordsAt.values()) ids.sort((a, b) => rank(a) - rank(b));
  const idx = { puzzle, wordById, cellsOf, wordsAt, letterAt };
  cache.set(puzzle, idx);
  return idx;
}

/** Problems with a puzzle; empty = valid (as coded, run over every bundled puzzle in the tests). */
export function validatePuzzle(p: PuzzleDef): string[] {
  const errors: string[] = [];
  if (p.rows > CW.maxGrid || p.cols > CW.maxGrid) errors.push(`grid must be within ${CW.maxGrid}x${CW.maxGrid}`);
  if (p.words.length < CW.minWords) errors.push(`needs at least ${CW.minWords} words`);
  const letters = new Map<CellKey, { letter: string; dir: Direction; id: string }>();
  for (const w of p.words) {
    if (!/^[A-Z]{2,}$/.test(w.answer)) errors.push(`${w.id}: answer must be A-Z`);
    wordCells(w).forEach((cell, i) => {
      if (cell.r < 0 || cell.c < 0 || cell.r >= p.rows || cell.c >= p.cols) return void errors.push(`${w.id}: outside the grid`);
      const k = cellKey(cell);
      const prev = letters.get(k);
      if (!prev) letters.set(k, { letter: w.answer[i], dir: w.direction, id: w.id });
      else if (prev.dir === w.direction) errors.push(`${w.id} overlaps ${prev.id}`);
      else if (prev.letter !== w.answer[i]) errors.push(`${w.id} and ${prev.id} disagree at ${k}`);
    });
  }
  const idx = indexOf(p);
  for (const w of p.words) if (idx.cellsOf.get(w.id)!.every((c) => idx.wordsAt.get(cellKey(c))!.length > 1)) errors.push(`${w.id}: fully crossed`);
  return errors;
}

/** Cells whose letter shows: cells of solved words plus hint-revealed cells. */
export function lockedCells(idx: PuzzleIndex, solved: Iterable<string>, revealed: Iterable<CellKey> = []): Set<CellKey> {
  const locked = new Set<CellKey>(revealed);
  for (const id of solved) for (const c of idx.cellsOf.get(id) ?? []) locked.add(cellKey(c));
  return locked;
}

/** Words whose every cell is already showing count as solved (safety net, as coded). Returns only the new ones. */
export function autoSolved(idx: PuzzleIndex, solved: Iterable<string>, revealed: Iterable<CellKey> = []): string[] {
  const cur = new Set(solved);
  const out: string[] = [];
  for (let changed = true; changed; ) {
    changed = false;
    const locked = lockedCells(idx, cur, revealed);
    for (const w of idx.puzzle.words) {
      if (cur.has(w.id) || !idx.cellsOf.get(w.id)!.every((c) => locked.has(cellKey(c)))) continue;
      cur.add(w.id);
      out.push(w.id);
      changed = true;
    }
  }
  return out;
}

// ---- Answer popup (as coded: reusable tiles, no backspace, tap a slot to clear it, full = submit) ----

export type Slot = { cell: CellPos; locked: boolean; letter: string | null };
export type Typed = (string | null)[];

export function buildSlots(idx: PuzzleIndex, wordId: string, locked: ReadonlySet<CellKey>): Slot[] {
  return idx.cellsOf.get(wordId)!.map((cell) => {
    const k = cellKey(cell);
    return { cell, locked: locked.has(k), letter: locked.has(k) ? idx.letterAt.get(k)! : null };
  });
}

export function placeLetter(slots: Slot[], typed: Typed, letter: string): Typed | null {
  const i = slots.findIndex((s, n) => !s.locked && typed[n] == null);
  if (i < 0) return null;
  const next = typed.slice();
  next[i] = letter;
  return next;
}

export function removeSlot(slots: Slot[], typed: Typed, i: number): Typed {
  if (!slots[i] || slots[i].locked || typed[i] == null) return typed;
  const next = typed.slice();
  next[i] = null;
  return next;
}

export const isFilled = (slots: Slot[], typed: Typed) => slots.some((s) => !s.locked) && slots.every((s, i) => s.locked || typed[i] != null);
export const composeAnswer = (slots: Slot[], typed: Typed) => slots.map((s, i) => (s.locked ? s.letter! : (typed[i] ?? ''))).join('');

// ---- Stars, levels, hints ----

/** CW2: 0 words left = 3 stars, 1 = 2, 2 = 1, more = 0. */
export function starsFor(total: number, solved: number): Stars {
  const left = total - solved;
  return left <= 0 ? 3 : left === 1 ? 2 : left === 2 ? 1 : 0;
}

/** CW2: level N opens once level N-1 has 1 star or more. */
export const isUnlocked = (level: number, best: Record<number, number>) => level <= 1 || (best[level - 1] ?? 0) >= 1;

/** CW9: EXP for a finished level given the best stars before it (replays pay only new stars). */
export const levelExp = (stars: number, bestBefore: number) => Math.max(0, stars - bestBefore) * CW.expPerStar;

/**
 * CW4: one hint reveals a third of the word's empty letters (rounded up) at random, never the last empty one.
 * Empty result = no hint possible.
 */
export function pickHintCells(idx: PuzzleIndex, wordId: string, locked: ReadonlySet<CellKey>, rng: Rng = Math.random): CellKey[] {
  const open = idx.cellsOf.get(wordId)!.map(cellKey).filter((k) => !locked.has(k));
  if (open.length <= 1) return [];
  const a = open.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(Math.ceil(open.length / 3), open.length - 1));
}

// ---- Solo run (one puzzle) ----

export type SoloPhase = 'playing' | 'out' | 'done';

export type SoloRun = {
  puzzleId: string;
  phase: SoloPhase;
  solved: string[];
  revealed: CellKey[];
  hearts: number;
  /** Wrong full answers per word; repeating one is blocked and costs nothing (as coded). */
  tried: Record<string, string[]>;
  hints: number;
  revives: number;
  /** Set when the player leaves before solving every word. */
  left: boolean;
};

export type SoloEvent =
  | { type: 'SUBMIT'; wordId: string; answer: string }
  | { type: 'HINT'; cells: CellKey[] }
  | { type: 'REVIVE' }
  | { type: 'LEAVE' };

export const startSolo = (puzzleId: string): SoloRun => ({ puzzleId, phase: 'playing', solved: [], revealed: [], hearts: CW.hearts, tried: {}, hints: 0, revives: 0, left: false });

export type SubmitOutcome = 'right' | 'wrong' | 'repeat' | 'ignored';

/** What a submit would do, so the popup can shake, lock or say "already tried" before the state changes. */
export function judge(p: PuzzleDef, solved: string[], tried: Record<string, string[]>, wordId: string, answer: string): SubmitOutcome {
  const w = indexOf(p).wordById.get(wordId);
  if (!w || solved.includes(wordId)) return 'ignored';
  if (answer === w.answer) return 'right';
  return (tried[wordId] ?? []).includes(answer) ? 'repeat' : 'wrong';
}

export function stepSolo(p: PuzzleDef, r: SoloRun, e: SoloEvent): SoloRun {
  const idx = indexOf(p);
  switch (e.type) {
    case 'SUBMIT': {
      if (r.phase !== 'playing') return r;
      const out = judge(p, r.solved, r.tried, e.wordId, e.answer);
      if (out === 'right') {
        const solved = [...r.solved, e.wordId];
        const all = [...solved, ...autoSolved(idx, solved, r.revealed)];
        return { ...r, solved: all, phase: all.length >= p.words.length ? 'done' : 'playing' };
      }
      if (out !== 'wrong') return r;
      const hearts = r.hearts - 1;
      return { ...r, hearts, tried: { ...r.tried, [e.wordId]: [...(r.tried[e.wordId] ?? []), e.answer] }, phase: hearts <= 0 ? 'out' : 'playing' };
    }
    case 'HINT': {
      if (r.phase !== 'playing' || !e.cells.length) return r;
      const revealed = [...new Set([...r.revealed, ...e.cells])];
      const solved = [...r.solved, ...autoSolved(idx, r.solved, revealed)];
      return { ...r, revealed, solved, hints: r.hints + 1, phase: solved.length >= p.words.length ? 'done' : 'playing' };
    }
    case 'REVIVE':
      return r.phase === 'out' ? { ...r, phase: 'playing', hearts: CW.reviveHearts, revives: r.revives + 1 } : r;
    case 'LEAVE':
      return r.phase === 'done' ? r : { ...r, phase: 'done', left: true };
  }
}

export const soloStars = (p: PuzzleDef, r: SoloRun) => starsFor(p.words.length, r.solved.length);
