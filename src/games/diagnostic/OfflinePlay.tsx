import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { engine, rank } from '../engine';
import { usePauseHide } from '../engine/usePauseHide';
import { Curtain } from '../shell/Curtain';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import type { PlayProps } from '../shell/types';
import { GameScreen } from '../shell/ui';
import { CaseBoard, pointsLine } from './CaseBoard';
import type { Difficulty } from './core';
import { caseById, guessById, poolFor } from './data';
import {
  currentCase, currentSeat, dpTieBreak, offlineRows, snapshotOffline, startOffline, stepOffline, timeLeft,
  type OfflineEvent, type OfflineRun,
} from './offline';

const shuffle = <T,>(xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Offline Multiplayer (pass and play): own case per player each round, 90 s turns, no hint (DPO1-DPO7). */
export function OfflinePlay({ play, onFinish, onQuit }: PlayProps) {
  const [run, setRun] = useState<OfflineRun | null>(null);
  const runRef = useRef<OfflineRun | null>(null);
  const [now, setNow] = useState(Date.now());
  const seatOf = useMemo(() => new Map(play.seats.map((x) => [x.seat, x])), [play.seats]);
  const names = useMemo(() => Object.fromEntries(play.seats.map((x) => [x.seat, x.name])), [play.seats]);

  // Start fresh (turn order shuffled once, as coded), or resume at the exact turn and clock (rule 10).
  useEffect(() => {
    let live = true;
    (async () => {
      let r = play.resume as OfflineRun | null;
      if (!r) {
        const seats = play.seats.filter((x) => !x.removed).map((x) => x.seat);
        const rounds = Number(play.settings.cases) || 3;
        const ids = await engine.picker.pick(play.game, poolFor(play.settings.difficulty as Difficulty), rounds * seats.length);
        r = startOffline(shuffle(seats), rounds, ids);
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
    (e: OfflineEvent) => {
      const prev = runRef.current;
      if (!prev) return;
      const next = stepOffline(prev, e);
      if (next === prev) return;
      runRef.current = next;
      setRun(next);
      const owner = next.results.filter((x) => x.seat === 0).reduce((a, x) => a + x.points, 0);
      engine.recorder.bookmark(play.id, snapshotOffline(next, Date.now()), owner);
      // A turn just closed: record it under that player's seat. Only the phone owner's misses feed Learn (DPO6).
      if (next.results.length > prev.results.length) {
        const r = next.results[next.results.length - 1];
        const c = caseById.get(r.caseId)!;
        engine.picker.markSeen(play.game, r.caseId);
        recordItem(play, {
          seat: r.seat,
          itemId: r.caseId,
          answerKey: c.canonical_id,
          outcome: r.outcome,
          answersGiven: r.wrong.map((id) => guessById.get(id)?.label ?? id),
          timeMs: r.timeMs,
          hintsUsed: 0,
          revealsUsed: r.reveals,
          points: r.points,
          feedsLearn: r.seat === 0 && r.outcome !== 'right',
          gameData: { cluesShown: r.cluesShown, cluePoints: r.cluePoints, speedBonus: r.speedBonus, difficulty: c.difficulty, round: r.round },
        });
      }
      if (next.phase === 'done' && prev.phase !== 'done') {
        const rows = offlineRows(next, names);
        const extra = new Map(rows.map((x) => [x.seat, x]));
        const standings = rank(
          rows.map(({ seat, name, score, timeMs }) => ({ seat, name, score, timeMs })),
          (a, b) => dpTieBreak(extra.get(a.seat)!, extra.get(b.seat)!),
        );
        onFinish(owner, standings);
      }
    },
    [play, onFinish, names],
  );

  // Clock tick while a turn runs; the turn ends at 90 s (DPO3).
  useEffect(() => {
    if (run?.phase !== 'playing') return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      dispatch({ type: 'TICK', now: t });
    }, 250);
    return () => clearInterval(id);
  }, [run?.phase, dispatch]);

  // Rule 4: leaving the app pauses and hides the case.
  usePauseHide(() => dispatch({ type: 'PAUSE', now: Date.now() }));

  if (!run || run.phase === 'done') return <GameScreen scroll={false}>{null}</GameScreen>;

  const seat = currentSeat(run);
  const who = seatOf.get(seat);
  const c = caseById.get(currentCase(run))!;
  const paused = run.phase === 'paused';
  const over = run.phase === 'turnOver' || (paused && run.before === 'turnOver');
  const r = over ? run.results[run.results.length - 1] : null;
  const rows = offlineRows(run, names);
  const board = rows.map((x) => ({ seat: x.seat, name: x.name, score: x.score, color: seatOf.get(x.seat)?.color })).sort((a, b) => b.score - a.score);
  const active = run.order.filter((x) => !run.removed.includes(x));
  const lastTurn = run.round + 1 >= run.rounds && active[active.length - 1] === seat;
  const roundText = `Round ${run.round + 1} of ${run.rounds}`;
  const left = timeLeft(run, now);

  return (
    <CaseBoard
      turnKey={`${run.round}:${seat}`}
      c={c}
      attempt={run.attempt}
      phase={paused ? 'paused' : over ? 'over' : 'playing'}
      title={who?.name ?? `Player ${seat + 1}`}
      titleColor={who?.color}
      sub={roundText}
      slim={`${who?.name ?? ''} · ${roundText}`}
      clock={{ label: 'Time left', ms: over ? Math.max(0, 90_000 - (r?.timeMs ?? 0)) : left, warn: !over && left <= 15_000 }}
      wrongSeq={run.wrongSeq}
      clueSeq={run.clueSeq}
      result={
        r
          ? {
              outcome: r.outcome,
              points: r.points,
              line: pointsLine(r, r.outcome === 'timed_out' ? 'Time ran out. No points this turn.' : 'No points this turn.'),
              nextLabel: lastTurn ? 'See results' : 'Pass the phone',
              onNext: () => dispatch({ type: 'NEXT', now: Date.now() }),
            }
          : null
      }
      pausedNote="The clock is stopped. Resume to see the case again."
      onPause={() => dispatch({ type: 'PAUSE', now: Date.now() })}
      onGuess={(g) => dispatch({ type: 'GUESS', answerId: g.id, accepted: g.id === c.answer_id, now: Date.now() })}
      onSkip={() => dispatch({ type: 'SKIP', now: Date.now() })}
      onReveal={() => dispatch({ type: 'REVEAL' })}>
      {run.phase === 'handoff' ? (
        <Curtain name={who?.name ?? `Player ${seat + 1}`} color={who?.color} sub={`${roundText} · 90 seconds`} board={board} onReady={() => dispatch({ type: 'READY', now: Date.now() })} />
      ) : null}
      <PauseMenu
        open={paused}
        mode="offline"
        seats={play.seats.map((x) => ({ ...x, removed: x.removed || run.removed.includes(x.seat) }))}
        keep={[0]}
        onResume={() => dispatch({ type: 'RESUME', now: Date.now() })}
        onQuit={onQuit}
        onRemove={(s) => {
          engine.recorder.removeSeat(play.id, s);
          dispatch({ type: 'REMOVE', seat: s, now: Date.now() });
        }}
      />
    </CaseBoard>
  );
}
