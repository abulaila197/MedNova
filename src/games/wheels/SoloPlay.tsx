import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { u } from '@/theme/scale';

import { engine } from '../engine';
import { usePauseHide } from '../engine/usePauseHide';
import { recordItem } from '../shell/flow';
import type { PlayProps } from '../shell/types';
import { startSolo, stepSolo, STYLES, fieldName, type Mix, type QResult, type SoloEvent, type SoloRun, type Target } from './core';
import { BANK } from './data';
import { WheelsPause } from './screens';
import { TurnBoard } from './TurnBoard';
import { Btn, CB, CD, Kicker, Panel, Rule, T, VelvetScreen, VV } from './velvet';
import { useTicker } from '../engine/useTicker';

/** The saved run has its clock stopped, so resuming later picks up with the same time left (rules 7, 10). */
const snapshot = (r: SoloRun, now: number): SoloRun => (r.turn && r.turn.pausedAt == null ? { ...r, turn: { ...r.turn, pausedAt: now } } : r);

/** Solo (WC1, WC11): spin and answer, turn after turn, until the target. No cards, Boss Round or Redemption. */
export function SoloPlay({ play, onFinish, onQuit }: PlayProps) {
  const target = (Number(play.settings.target) || 50) as Target;
  const mix = (play.settings.mix as Mix) ?? 'mixed';
  const [run, setRun] = useState<SoloRun | null>(null);
  const ref = useRef<SoloRun | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let r = (play.resume as { run?: SoloRun } | null)?.run ?? null;
    if (r?.turn?.pausedAt != null) r = stepSolo(r, { type: 'RESUME', now: Date.now() }, BANK, Math.random);
    if (!r) {
      r = startSolo(BANK, target, [], Math.random, mix);
      engine.recorder.bookmark(play.id, { run: snapshot(r, Date.now()) }, 0);
    }
    ref.current = r;
    setRun(r);
  }, [play, target, mix]);

  const record = useCallback(
    (rs: QResult[]) => {
      for (const r of rs)
        recordItem(play, {
          seat: 0, itemId: r.id, answerKey: null, outcome: r.right ? 'right' : r.answer == null ? 'timed_out' : 'wrong', answersGiven: [], timeMs: 0,
          hintsUsed: 0, revealsUsed: 0, points: r.points, feedsLearn: false, // WC7: nothing goes to Learn
          gameData: { style: r.style, field: r.field },
        });
    },
    [play],
  );

  const dispatch = useCallback(
    (e: SoloEvent) => {
      const prev = ref.current;
      if (!prev) return;
      const next = stepSolo(prev, e, BANK, Math.random);
      if (next === prev) return;
      ref.current = next;
      setRun(next);
      engine.recorder.bookmark(play.id, { run: snapshot(next, Date.now()) }, next.score);
      const before = prev.turnNo === next.turnNo ? (prev.turn?.results.length ?? 0) : 0;
      record(next.turn?.results.slice(before) ?? []);
      if (next.phase === 'done' && prev.phase !== 'done') onFinish(next.score);
    },
    [play, record, onFinish],
  );

  // The clock: ticks while a timer runs (Star window, question, the right/wrong moment).
  const timed = run?.phase === 'turn' && run.turn?.until != null && !paused;
  const now = useTicker(timed, 150, (n) => dispatch({ type: 'TICK', now: n }));

  const pause = () => {
    setPaused(true);
    dispatch({ type: 'PAUSE', now: Date.now() });
  };
  usePauseHide(pause);

  if (!run) return <VelvetScreen>{null}</VelvetScreen>;
  const resume = () => {
    setPaused(false);
    dispatch({ type: 'RESUME', now: Date.now() });
  };

  return (
    <>
      <VelvetScreen>
        {run.phase === 'turn' && run.turn ? (
          <TurnBoard
            turn={run.turn}
            now={now}
            kicker={`Solo · Turn ${run.turnNo}`}
            title={`${run.score} of ${target}`}
            strip={[{ seat: 0, name: 'You', score: run.score, me: true }]}
            onEvent={(e) => dispatch(e)}
            onPause={pause}
            hidden={paused}
          />
        ) : run.turn ? (
          <TurnOver run={run} onNext={() => dispatch({ type: 'NEXT' })} onEnd={() => dispatch({ type: 'END' })} />
        ) : null}
      </VelvetScreen>
      <WheelsPause open={paused} mode="solo" onResume={resume} onQuit={onQuit} />
    </>
  );
}

/** Between turns: what this turn earned and how far the target is. */
function TurnOver({ run, onNext, onEnd }: { run: SoloRun; onNext: () => void; onEnd: () => void }) {
  const t = run.turn!;
  const pts = t.results.reduce((a, r) => a + r.points, 0);
  return (
    <View style={{ flex: 1, gap: u(12) }}>
      <View style={{ gap: u(2) }}>
        <Kicker>{`Solo · Turn ${run.turnNo}`}</Kicker>
        <T f={CD} size={26}>{pts ? `+${pts} points` : 'No points this turn'}</T>
      </View>
      <Panel>
        {t.results.map((r, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: u(9) }}>
            <T f={CB} size={13} color={r.right ? VV.right : VV.wrong} style={{ width: u(16) }}>{r.right ? '✓' : '✕'}</T>
            <T size={13} style={{ flex: 1 }}>{`${STYLES[r.style].name} · ${fieldName(r.field)}`}</T>
            <T f={CB} size={13} color={VV.soft}>{String(r.points)}</T>
          </View>
        ))}
        <Rule />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <T f={CB} size={12} color={VV.dim} style={{ letterSpacing: u(1.2) }}>SCORE</T>
          <T f={CD} size={22} color={VV.gold}>{`${run.score} / ${run.target}`}</T>
        </View>
        <View style={{ height: u(6), borderRadius: u(3), backgroundColor: 'rgba(216,178,106,0.2)', overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(100, (run.score / run.target) * 100)}%`, height: '100%', backgroundColor: VV.brass }} />
        </View>
      </Panel>
      <View style={{ flex: 1 }} />
      <Btn label="Spin again" onPress={onNext} />
      <Btn label="Finish here" ghost onPress={onEnd} />
    </View>
  );
}
