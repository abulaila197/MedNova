import type { PlayItem } from '../engine/types';
import { casePoints, isRight, type CaseRun } from './core';
import { caseById } from './data';

type Item = Omit<PlayItem, 'id' | 'at' | 'playId'>;

/** One item a case. A wrong case is a miss and goes to Learn (Today's review) where the mode allows it. */
export function caseItem(id: string, run: CaseRun, o: { index: number; seat?: number; learn: boolean; ms: number }): Item {
  const c = caseById.get(id)!;
  const points = casePoints(c.lv, run);
  const right = isRight(run);
  return {
    seat: o.seat ?? 0,
    itemId: id,
    answerKey: null,
    outcome: right ? 'right' : run.timeUp ? 'timed_out' : 'wrong',
    answersGiven: [run.pick == null || run.pick < 0 ? '' : c.a[run.pick].o],
    timeMs: o.ms,
    hintsUsed: run.fifty ? 1 : 0,
    revealsUsed: 0,
    points,
    feedsLearn: o.learn && !right,
    gameData: { index: o.index, level: c.lv, field: c.f, kind: c.k, right, casePoints: points, exp: points, timeUp: run.timeUp },
  };
}
