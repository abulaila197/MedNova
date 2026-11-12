import type { PlayItem } from '../engine/types';
import { caseExp, casePoints, right1, right2, type CaseRun } from './core';
import { caseById } from './data';

type Item = Omit<PlayItem, 'id' | 'at' | 'playId'>;

/**
 * One item a case. Right means both stages right. A case with any stage wrong is a miss and goes to Learn (Today's
 * review) where the mode allows it. The case's points and EXP ride on the item.
 */
export function caseItem(id: string, run: CaseRun, o: { index: number; seat?: number; learn: boolean; ms: number }): Item {
  const c = caseById.get(id)!;
  const points = casePoints(c.lv, run);
  const both = right1(run) && right2(run);
  return {
    seat: o.seat ?? 0,
    itemId: id,
    answerKey: null,
    outcome: both ? 'right' : run.timeUp && run.pick1 === -1 ? 'timed_out' : 'wrong',
    answersGiven: [run.pick1, run.pick2].map((p) => (p == null || p < 0 ? '' : c.a[p].o)),
    timeMs: o.ms,
    hintsUsed: run.fifty ? 1 : 0,
    revealsUsed: run.highlight ? 1 : 0,
    points,
    feedsLearn: o.learn && !both,
    gameData: { index: o.index, level: c.lv, field: c.f, stage1: right1(run), stage2: right2(run), casePoints: points, exp: caseExp(points), timeUp: run.timeUp },
  };
}
