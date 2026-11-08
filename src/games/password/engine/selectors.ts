import { CONFIG } from './config';
import { findTerm, searchTerms } from './terms';
import { elapsed } from './timer';
import { currentWord, totalClues, wordsCompleted } from './teamRound';
import type { Term } from './types';
import type { OfflineState } from './offlineMachine';
import { msLeft, myProgress, opponentProgress, type OnlineState } from './onlineMachine';

/** Read-only helpers for the UI. */

/** Offline giver screen: the current word, the clue counter, words done and the clock. */
export function offlineGiverView(terms: readonly Term[], s: OfflineState, now: number) {
  if (s.ui.name !== 'playing' || !s.turn) return null;
  const { tr, timer } = s.turn;
  const id = currentWord(tr);
  const used = elapsed(timer, now);
  return {
    team: s.turn.team,
    giverId: s.turn.giverId,
    guesserId: s.turn.guesserId,
    word: id ? (findTerm(terms, id)?.name ?? null) : null,
    clueCount: id ? tr.words[id].count : 0, // clues on the current word
    totalClues: totalClues(tr),
    wordsDone: wordsCompleted(tr),
    wordsTotal: tr.queue.length + wordsCompleted(tr),
    msLeft: Math.max(0, CONFIG.ROUND_MAX_MS - used),
    canSkip: tr.queue.length > 1,
  };
}

/** Online screens: role, current word (giver only), clue stack, guess suggestions, both teams' progress. */
export function onlineView(terms: readonly Term[], s: OnlineState, now: number) {
  return {
    role: s.role,
    secretTerm: s.role === 'giver' && s.currentTermId ? (findTerm(terms, s.currentTermId)?.name ?? null) : null,
    clues: s.clues,
    wrongGuesses: s.guesses.map((id) => findTerm(terms, id)?.name ?? id),
    mine: myProgress(s),
    opponentWordsCompleted: opponentProgress(s)?.completed ?? 0, // nothing else of the other team is shown
    msLeft: msLeft(s, now),
    notice: s.notice,
  };
}

/** Guesser autocomplete: suggestions appear after 3 letters, over the whole term list. */
export const guessSuggestions = (terms: readonly Term[], query: string) => searchTerms(terms, query);
