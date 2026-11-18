import type { PlayItem } from '../engine/types';
import { cardOf, runExp, runPoints, type QRun } from './core';
import { questionById } from './data';

type Item = Omit<PlayItem, 'id' | 'at' | 'playId'>;

/** One item a question. A question not solved is a miss and goes to Learn where the mode allows it. */
export function questionItem(id: string, run: QRun, o: { index: number; seat?: number; learn: boolean; ms: number }): Item {
  const q = questionById.get(id)!;
  const points = runPoints(run, o.ms);
  return {
    seat: o.seat ?? 0,
    itemId: id,
    answerKey: null,
    outcome: run.solved ? 'right' : run.timeUp ? 'timed_out' : 'wrong',
    answersGiven: run.slots.map((c) => (c == null ? '' : cardOf(q, c).t)),
    timeMs: o.ms,
    hintsUsed: run.placeUsed ? 1 : 0,
    revealsUsed: run.decoyUsed ? 1 : 0,
    points,
    feedsLearn: o.learn && !run.solved,
    gameData: { index: o.index, cat: q.cat, tries: run.wrong + (run.solved ? 1 : 0), exp: runExp(points), timeUp: run.timeUp },
  };
}
