import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from '@/components/AppText';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { engine, rank } from '../engine';
import { usePauseHide } from '../engine/usePauseHide';
import { Curtain } from '../shell/Curtain';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import { teamLap, teamsOf } from '../shell/teams';
import type { PlayProps } from '../shell/types';
import { GameScreen, Kick } from '../shell/ui';
import { mixQueue, startRound, streakTieBreak, timeLeft, type Style } from './core';
import { answerOf, idsOf, poolFor, questionById } from './data';
import { HeatBoard } from './HeatBoard';
import {
  POOL_SIZE, currentSeat, offlineRecap, offlineRows, snapshotOffline, startOffline, stepOffline,
  type OfflineEvent, type OfflineRun,
} from './offline';
import { OverCard } from './SoloPlay';
import { shuffle } from '../engine/random';
import { useTicker } from '../engine/useTicker';

/** Offline (SM5, SM13): each player's own timed round in turn, no helpers, no EXP; the owner's misses go to Learn. */
export function OfflinePlay({ play, onFinish, onQuit }: PlayProps) {
  const t = useTheme();
  const style = (play.settings.style as Style) ?? 'mixed';
  const lengthSec = Number(play.settings.length) || 60;
  const [run, setRun] = useState<OfflineRun | null>(null);
  const ref = useRef<OfflineRun | null>(null);
  const seatOf = useMemo(() => new Map(play.seats.map((x) => [x.seat, x])), [play.seats]);
  const names = useMemo(() => Object.fromEntries(play.seats.map((x) => [x.seat, x.name])), [play.seats]);

  // Start: one shared pool (as coded), turn order shuffled once, or teams alternate (TM5).
  useEffect(() => {
    let live = true;
    (async () => {
      let r = play.resume as OfflineRun | null;
      if (r && ![...r.pool, ...(r.round?.queue ?? [])].every((id) => questionById.has(id))) r = null; // a question left the bank since: start fresh
      if (!r) {
        const seats = play.seats.filter((x) => !x.removed);
        const teams = teamsOf(play);
        const order = teams ? teamLap(seats, teams) : shuffle(seats.map((x) => x.seat));
        const pool =
          style === 'mixed'
            ? mixQueue(await engine.picker.pick(play.game, idsOf('clinical'), POOL_SIZE / 2), await engine.picker.pick(play.game, idsOf('basic'), POOL_SIZE / 2))
            : await engine.picker.pick(play.game, poolFor(style), POOL_SIZE);
        r = startOffline(order, pool, lengthSec);
        engine.recorder.bookmark(play.id, r, 0);
      }
      if (live) {
        ref.current = r;
        setRun(r);
      }
    })();
    return () => {
      live = false;
    };
  }, [play, style, lengthSec]);

  const dispatch = useCallback(
    (e: OfflineEvent) => {
      const prev = ref.current;
      if (!prev) return;
      const next = stepOffline(prev, e, answerOf);
      if (next === prev) return;
      ref.current = next;
      setRun(next);
      const owner = next.results.find((x) => x.seat === 0)?.score ?? 0;
      engine.recorder.bookmark(play.id, snapshotOffline(next, Date.now()), owner);
      // Each answer is one item under the player's seat; only the phone owner's misses go to Learn (SM13).
      const before = prev.round && next.round && prev.turn === next.turn ? prev.round.answers.length : 0;
      if (next.round && (prev.round !== next.round)) {
        const seat = currentSeat(next);
        for (const a of next.round.answers.slice(before)) {
          const q = questionById.get(a.qId)!;
          if (seat === 0) engine.picker.markSeen(play.game, a.qId);
          recordItem(play, {
            seat,
            itemId: a.qId,
            answerKey: q.dossier,
            outcome: a.outcome,
            answersGiven: a.outcome === 'wrong' && a.picked != null ? [q.choices[a.picked]] : [],
            timeMs: a.timeMs,
            hintsUsed: 0,
            revealsUsed: 0,
            points: a.points,
            feedsLearn: seat === 0 && a.outcome === 'wrong',
            gameData: { style, field: q.field, kind: q.kind, streak: a.streak },
          });
        }
      }
      if (next.phase === 'done' && prev.phase !== 'done') {
        const rows = offlineRows(next, names);
        const extra = new Map(rows.map((x) => [x.seat, x]));
        onFinish(owner, rank(rows.map(({ seat, name, score, timeMs }) => ({ seat, name, score, timeMs })), (a, b) => streakTieBreak(extra.get(a.seat)!, extra.get(b.seat)!)));
      }
    },
    [play, style, onFinish, names],
  );

  // The clock: ticks through the hand-off countdown, a question, or a result showing.
  const now = useTicker(run?.phase === 'countdown' || run?.phase === 'playing' || run?.round?.phase === 'feedback', 150, (n) => dispatch({ type: 'TICK', now: n }), { fine: true });

  usePauseHide(() => dispatch({ type: 'PAUSE', now: Date.now() }));

  if (!run || run.phase === 'done') return <GameScreen scroll={false}>{null}</GameScreen>;

  const seat = currentSeat(run);
  const who = seatOf.get(seat);
  const paused = run.phase === 'paused';
  const rows = offlineRows(run, names);
  const board = rows.map((x) => ({ seat: x.seat, name: x.name, score: x.score, color: seatOf.get(x.seat)?.color })).sort((a, b) => b.score - a.score);
  const left = run.order.slice(run.turn + 1).filter((x) => !run.removed.includes(x));
  // Before a round starts there is no question yet: show the pool's first one under the curtain (never readable).
  const round = run.round ?? startRound(run.pool, run.lengthSec, now);
  const q = questionById.get(round.queue[Math.min(round.index, round.queue.length - 1)])!;
  const turnOver = run.phase === 'turnOver' || (paused && run.before === 'turnOver');
  const turnNo = run.order.slice(0, run.turn + 1).filter((x) => !run.removed.includes(x)).length;

  return (
    <HeatBoard
      q={q}
      round={round}
      leftMs={run.round ? timeLeft(run.round, now) : run.lengthSec * 1000}
      totalMs={run.lengthSec * 1000}
      who={{ name: who?.name ?? `Player ${seat + 1}`, color: who?.color }}
      onAnswer={(choice) => dispatch({ type: 'ROUND', e: { type: 'ANSWER', choice, now: Date.now() } })}
      onPause={() => dispatch({ type: 'PAUSE', now: Date.now() })}
      hidden={paused || run.phase === 'handoff' || run.phase === 'countdown'}
      dock={
        turnOver && run.round ? (
          <OverCard round={run.round} title={`${who?.name ?? ''} scored ${run.round.score}`} next={left.length ? 'Pass the phone' : 'See results'} onNext={() => dispatch({ type: 'NEXT' })} />
        ) : undefined
      }>
      {run.phase === 'handoff' ? (
        <Curtain name={who?.name ?? `Player ${seat + 1}`} color={who?.color} sub={`Turn ${turnNo} of ${run.order.length - run.removed.length} · ${run.lengthSec} s round`} board={board} recap={offlineRecap(run, seat, play)} onReady={() => dispatch({ type: 'READY', now: Date.now() })} />
      ) : null}
      {run.phase === 'countdown' && run.countdownUntil != null ? (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(160)} style={[StyleSheet.absoluteFill, s.cd, { backgroundColor: t.sky }]}>
          <Kick>Get ready</Kick>
          <Text style={[s.cdN, { color: who?.color ?? t.accent }]}>{Math.max(1, Math.ceil((run.countdownUntil - now) / 1000))}</Text>
          <Text style={[s.cdS, { color: t.mute }]}>{`${who?.name ?? ''}, your round starts`}</Text>
        </Animated.View>
      ) : null}
      <PauseMenu
        open={paused}
        mode="offline"
        seats={play.seats.map((x) => ({ ...x, removed: x.removed || run.removed.includes(x.seat) }))}
        keep={[0]}
        onResume={() => dispatch({ type: 'RESUME', now: Date.now() })}
        onQuit={onQuit}
        onRemove={(x) => {
          engine.recorder.removeSeat(play.id, x);
          dispatch({ type: 'REMOVE', seat: x });
        }}
      />
    </HeatBoard>
  );
}

const s = StyleSheet.create({
  cd: { zIndex: 30, alignItems: 'center', justifyContent: 'center', gap: u(10) },
  cdN: { fontFamily: F.display, fontSize: u(64), lineHeight: u(70) },
  cdS: { fontFamily: F.body, fontSize: u(11.5) },
});

