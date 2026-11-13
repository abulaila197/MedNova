import { create } from 'zustand';

import { GAMES } from '@/data/games';

import { tagRank } from './GameTag';

/** The Games list order: grouped by tag (On duty, Play and learn, Party time), each group keeping the games order. */
export const LISTED = [...GAMES].sort((a, b) => tagRank(a.key) - tagRank(b.key));

/** Which game the Games page shows next; `n` changes on every request so the same game can be asked for twice. */
export const useGamesFocus = create<{ j: number; n: number }>(() => ({ j: 0, n: 0 }));

/** "Back to games" lands on the game just played (Yazan 2026-10-26, #20). */
export function focusGame(key: string) {
  const j = LISTED.findIndex((g) => g.key === key);
  if (j < 0) return;
  // The Games list scrolls to that game's strip.
  useGamesFocus.setState((s) => ({ j, n: s.n + 1 }));
}
