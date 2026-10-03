import { useCallback, useEffect, useRef, useState } from 'react';

import { engine } from '../engine';
import { recordItem } from '../shell/flow';
import type { PlayProps } from '../shell/types';
import { usePauseHide } from '../engine/usePauseHide';
import { DP } from './core';
import { caseById, guessById, poolFor } from './data';
import type { Difficulty } from './core';
import { snapshot, startRun, step, type SoloEvent, type SoloRun } from './solo';

/** Runs one solo game on the engine: picks unseen cases, bookmarks every step, records each case, pays hints. */
export function useSoloRun({ play, onFinish }: Pick<PlayProps, 'play' | 'onFinish'>) {
  const [run, setRun] = useState<SoloRun | null>(null);
  const runRef = useRef<SoloRun | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Start fresh, or resume the bookmark at the exact case and clock (rules 7, 10).
  useEffect(() => {
    let live = true;
    (async () => {
      const saved = play.resume as SoloRun | null;
      let r = saved;
      if (!r) {
        const ids = await engine.picker.pick(play.game, poolFor(play.settings.difficulty as Difficulty), Number(play.settings.cases) || 5);
        r = startRun(ids, Date.now());
      }
      if (live) {
        runRef.current = r;
        setRun(r);
      }
    })();
    return () => {
      live = false;
    };
  }, [play]);

  const dispatch = useCallback(
    (e: SoloEvent) => {
      const prev = runRef.current;
      if (!prev) return;
      const next = step(prev, e);
      if (next === prev) return;
      runRef.current = next;
      setRun(next);
      const now = Date.now();
      engine.recorder.bookmark(play.id, { ...snapshot(next, now), index: next.index }, next.score);
      // a case just closed: record it, mark it seen (rule 15); failed and skipped feed Learn (DP8)
      if (next.results.length > prev.results.length) {
        const r = next.results[next.results.length - 1];
        const c = caseById.get(r.caseId)!;
        engine.picker.markSeen(play.game, r.caseId);
        recordItem(play, {
          seat: 0,
          itemId: r.caseId,
          answerKey: c.canonical_id,
          outcome: r.outcome,
          answersGiven: r.wrong.map((id) => guessById.get(id)?.label ?? id),
          timeMs: r.timeMs,
          hintsUsed: r.hint ? 1 : 0,
          revealsUsed: r.reveals,
          points: r.points,
          feedsLearn: r.outcome !== 'right',
          gameData: { cluesShown: r.cluesShown, cluePoints: r.cluePoints, speedBonus: r.speedBonus, difficulty: c.difficulty },
        });
      }
      if (next.phase === 'done' && prev.phase !== 'done') onFinish(next.score);
    },
    [play, onFinish],
  );

  // Rule 4: leaving the app pauses and hides the case.
  usePauseHide(() => dispatch({ type: 'PAUSE', now: Date.now() }));

  /** Hint costs 1 token; refunded if the case closed before it could show (rule 18). */
  const hint = useCallback(async () => {
    const r = runRef.current;
    if (!r || r.hint || r.phase !== 'playing') return;
    const index = r.index;
    const receipt = await engine.wallet.spend(DP.hintTokenCost, 'diagnostic_hint', play.id);
    if (!receipt) return setNotice('You need 1 token for a hint. Earn tokens from EXP: 200 EXP makes 1 token.');
    const cur = runRef.current;
    if (!cur || cur.index !== index || (cur.phase !== 'playing' && cur.phase !== 'paused')) {
      await engine.wallet.refund(receipt);
      return setNotice('Hint refunded.');
    }
    dispatch({ type: 'HINT_GRANTED' });
  }, [dispatch, play.id]);

  const current = run ? caseById.get(run.caseIds[run.index]) ?? null : null;
  return { run, current, dispatch, hint, notice, clearNotice: () => setNotice(null) };
}
