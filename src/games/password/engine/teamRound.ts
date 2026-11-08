import type { TermId } from './types';

/**
 * One team's list of words. Pure and shared (the offline machine uses it directly; the game server
 * can reuse it). Rules:
 *  - the head of the queue is the current word;
 *  - every clue counts, on every word, including skipped or unfinished ones;
 *  - skipping sends the word to the end of the list (impossible when it is the only word left);
 *  - wrong guesses are free.
 */
export interface WordState {
  termId: TermId;
  /** Typed clues (online). Offline only the count is kept. */
  clues: string[];
  count: number;
  done: boolean;
}

export interface TeamRound {
  queue: TermId[];
  words: Record<TermId, WordState>;
  completed: TermId[];
  /**
   * #35 (Yazan 2026-11-01): each card holds two words. The other word of each card in the queue, by the word showing
   * now. Older saves have none (one word per card).
   */
  alts?: Record<TermId, TermId>;
}

export function newTeamRound(termIds: readonly TermId[], alts?: Record<TermId, TermId>): TeamRound {
  const words: Record<TermId, WordState> = {};
  for (const id of termIds) words[id] = { termId: id, clues: [], count: 0, done: false };
  const tr: TeamRound = { queue: termIds.slice(), words, completed: [] };
  if (alts) tr.alts = Object.fromEntries(termIds.filter((id) => alts[id]).map((id) => [id, alts[id]]));
  return tr;
}

/** The other word on the current card (upside down), if the card has two. */
export const altWord = (tr: TeamRound): TermId | null => {
  const id = currentWord(tr);
  return id !== null ? (tr.alts?.[id] ?? null) : null;
};

/**
 * #35: turns the current card round. The other word becomes the one in play and only it counts as the answer;
 * the clues already given on this card stay counted. Allowed any time (Yazan's pick).
 */
export function swapWord(tr: TeamRound): TeamRound {
  const id = currentWord(tr);
  const other = altWord(tr);
  if (id === null || other === null) return tr;
  const words = { ...tr.words };
  words[other] = { ...words[id], termId: other };
  delete words[id];
  const alts = { ...tr.alts };
  delete alts[id];
  alts[other] = id;
  return { ...tr, queue: [other, ...tr.queue.slice(1)], words, alts };
}

export const currentWord = (tr: TeamRound): TermId | null => tr.queue[0] ?? null;
export const isFinished = (tr: TeamRound): boolean => tr.queue.length === 0;
export const wordsCompleted = (tr: TeamRound): number => tr.completed.length;
/** All clues given on all words, finished or not. */
export const totalClues = (tr: TeamRound): number => Object.values(tr.words).reduce((n, w) => n + w.count, 0);

function patchCurrent(tr: TeamRound, patch: (w: WordState) => WordState): TeamRound {
  const id = currentWord(tr);
  if (id === null) return tr;
  return { ...tr, words: { ...tr.words, [id]: patch(tr.words[id]) } };
}

/** A clue was given. `text` is set online (typed clue); offline it is just a +1. */
export const addClue = (tr: TeamRound, text?: string): TeamRound => patchCurrent(tr, (w) => ({ ...w, count: w.count + 1, clues: text !== undefined ? [...w.clues, text] : w.clues }));

/** Offline undo for a mistaken +1. */
export const removeClue = (tr: TeamRound): TeamRound =>
  patchCurrent(tr, (w) => ({
    ...w,
    count: Math.max(0, w.count - 1),
    clues: w.clues.length > 0 && w.clues.length >= w.count ? w.clues.slice(0, -1) : w.clues,
  }));

/** The current word was guessed: it is done and the next one appears. */
export function markCorrect(tr: TeamRound): TeamRound {
  const id = currentWord(tr);
  if (id === null) return tr;
  return {
    queue: tr.queue.slice(1),
    words: { ...tr.words, [id]: { ...tr.words[id], done: true } },
    completed: [...tr.completed, id],
  };
}

/** Moves the current word to the end of the list; clues already given stay counted. */
export function skipWord(tr: TeamRound): TeamRound {
  if (tr.queue.length <= 1) return tr;
  return { ...tr, queue: [...tr.queue.slice(1), tr.queue[0]] };
}
