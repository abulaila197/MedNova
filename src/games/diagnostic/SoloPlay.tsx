import { useEffect } from 'react';

import { PauseMenu } from '../shell/PauseMenu';
import type { PlayProps } from '../shell/types';
import { GameScreen } from '../shell/ui';
import { CaseBoard, pointsLine } from './CaseBoard';
import { elapsed } from './solo';
import { useSoloRun } from './useSoloRun';
import { second, useTicker } from '../engine/useTicker';

/** Solo: a set of cases on the shared case screen, with the paid Hint. */
export function SoloPlay({ play, onFinish, onQuit }: PlayProps) {
  const { run, current, dispatch, hint, notice, clearNotice } = useSoloRun({ play, onFinish });

  // Clock tick while a case is running.
  const now = useTicker(run?.phase === 'playing', 250, undefined, { shown: (n) => run && second(elapsed(run, n)) });

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(clearNotice, 3200);
    return () => clearTimeout(id);
  }, [notice, clearNotice]);

  if (!run || !current) return <GameScreen scroll={false}>{null}</GameScreen>;

  const paused = run.phase === 'paused';
  const over = run.phase === 'caseOver' || (paused && run.before === 'caseOver');
  const r = over ? run.results[run.results.length - 1] : null;
  const last = run.index + 1 >= run.caseIds.length;

  return (
    <CaseBoard
      turnKey={String(run.index)}
      c={current}
      attempt={run.attempt}
      phase={paused ? 'paused' : over ? 'over' : 'playing'}
      title={`Case ${run.index + 1}`}
      sub={`of ${run.caseIds.length}`}
      slim={`Case ${run.index + 1} of ${run.caseIds.length}`}
      clock={{ label: 'Clock', ms: elapsed(run, now) }}
      wrongSeq={run.wrongSeq}
      clueSeq={run.clueSeq}
      hint={{ granted: run.hint, onHint: hint }}
      result={
        r
          ? {
              outcome: r.outcome,
              points: r.points,
              line: pointsLine(r, 'No points this time. This case goes to your Learn review.'),
              nextLabel: last ? 'See results' : 'Next case',
              onNext: () => dispatch({ type: 'NEXT', now: Date.now() }),
            }
          : null
      }
      notice={notice}
      pausedNote="The clock is stopped. Resume to see the case again."
      onPause={() => dispatch({ type: 'PAUSE', now: Date.now() })}
      onGuess={(g) => dispatch({ type: 'GUESS', answerId: g.id, accepted: g.id === current.answer_id, now: Date.now() })}
      onSkip={() => dispatch({ type: 'SKIP', now: Date.now() })}
      onReveal={() => dispatch({ type: 'REVEAL' })}>
      <PauseMenu open={paused} mode="solo" onResume={() => dispatch({ type: 'RESUME', now: Date.now() })} onQuit={onQuit} />
    </CaseBoard>
  );
}
