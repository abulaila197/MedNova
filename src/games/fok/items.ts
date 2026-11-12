import type { PlayItem } from '../engine/types';
import { boardPoints, levelPoints, type Board, type BoardRun } from './core';
import { groupById } from './data';

type Item = Omit<PlayItem, 'id' | 'at' | 'playId'>;

/**
 * One item per group on a board. A group you found is right and earns its level's points; the rest are misses.
 * Misses go to Learn (Today's review) where the mode allows it, never Wordplay (Yazan 2026-11-12). The board's
 * points, after mistakes and the hint, ride on its first item so the shell can add them up once.
 */
export function boardItems(board: Board, run: BoardRun, o: { index: number; seat?: number; learn: boolean; ms: number; foundBy?: Record<number, number> }): Item[] {
  const points = boardPoints(board, groupById, run);
  return board.groups.map((bg, slot) => {
    const g = groupById.get(bg.id)!;
    const found = o.foundBy ? o.foundBy[slot] != null : run.found.includes(slot);
    return {
      seat: o.foundBy?.[slot] ?? o.seat ?? 0,
      itemId: g.id,
      answerKey: null,
      outcome: found ? 'right' : 'wrong',
      answersGiven: [],
      timeMs: slot === 0 ? o.ms : 0,
      hintsUsed: run.revealed === slot ? 1 : 0,
      revealsUsed: 0,
      points: found ? levelPoints(g.lv) : 0,
      feedsLearn: o.learn && !found && g.f !== 'wordplay',
      gameData: { board: o.index, slot, level: g.lv, field: g.f, boxes: bg.boxes.map((i) => g.b[i][0]), auto: run.auto === slot, ...(slot === 0 ? { boardPoints: points, mistakes: run.mistakes, solved: run.solved } : null) },
    };
  });
}
