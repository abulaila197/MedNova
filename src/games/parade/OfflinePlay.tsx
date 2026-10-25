import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Backdrop } from '@/components/Backdrop';
import { Text } from '@/components/AppText';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { engine, rank } from '../engine';
import { shuffle } from '../engine/random';
import { usePauseHide } from '../engine/usePauseHide';
import { useTickerClock } from '../engine/useTicker';
import { Curtain } from '../shell/Curtain';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import { teamLap, teamsOf } from '../shell/teams';
import type { PlayProps } from '../shell/types';
import { GameScreen, Kick } from '../shell/ui';
import { mixQueue, startRound, timeLeft, type Answer, type Style } from './core';
import { bank, idsOf, poolFor, questionById } from './data';
import {
  currentSeat, offlineRecap, offlineRows, paradeTieBreak, settleClosest, snapshotOffline, startOffline, stepOffline,
  type OfflineEvent, type OfflineRun,
} from './offline';
import { ParadeBoard } from './ParadeBoard';
import { OverCard } from './SoloPlay';

/** Pass the phone (QP10): each player answers the same questions in their own order, one whole turn each. */
export function OfflinePlay({ play, onFinish, onQuit }: PlayProps) {
  const t = useTheme();
  const style = (play.settings.style as Style) ?? 'mixed';
  const count = Number(play.settings.questions) || 10;
  const [run, setRun] = useState<OfflineRun | null>(null);
  const ref = useRef<OfflineRun | null>(null);
  const seatOf = useMemo(() => new Map(play.seats.map((x) => [x.seat, x])), [play.seats]);
  const names = useMemo(() => Object.fromEntries(play.seats.map((x) => [x.seat, x.name])), [play.seats]);

  // Start: one set of questions for everyone (unseen by the phone owner first); turn order shuffled once, or teams alternate (TM5).
  useEffect(() => {
    let live = true;
    (async () => {
      let r = play.resume as OfflineRun | null;
      if (r && !(r.queues ?? [[' ']]).flat().every((id) => questionById.has(id))) r = null;
      if (!r) {
        const seats = play.seats.filter((x) => !x.removed);
        const teams = teamsOf(play);
        const order = teams ? teamLap(seats, teams) : shuffle(seats.map((x) => x.seat));
        const pick = (ids: string[]) => engine.picker.pick(play.game, ids, ids.length);
        const questions = style === 'mixed' ? mixQueue(await pick(idsOf('clinical')), await pick(idsOf('basic')), count) : (await pick(poolFor(style))).slice(0, count);
        r = startOffline(order, questions);
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
  }, [play, style, count]);

  const record = useCallback(
    (seat: number, a: Answer) => {
      const q = questionById.get(a.qId)!;
      if (seat === 0) engine.picker.markSeen(play.game, a.qId);
      recordItem(play, {
        seat,
        itemId: a.qId,
        answerKey: null,
        outcome: a.outcome,
        answersGiven: [],
        timeMs: a.timeMs,
        hintsUsed: 0,
        revealsUsed: 0,
        points: a.points,
        // QP5: the phone owner's misses go to Today's review.
        feedsLearn: seat === 0 && a.outcome === 'wrong',
        gameData: { style, field: q.field, kind: q.kind, type: q.style },
      });
    },
    [play, style],
  );

  const dispatch = useCallback(
    (e: OfflineEvent) => {
      const prev = ref.current;
      if (!prev) return;
      const next = stepOffline(prev, e, bank);
      if (next === prev) return;
      ref.current = next;
      setRun(next);
      const owner = next.results.find((x) => x.seat === 0)?.score ?? 0;
      engine.recorder.bookmark(play.id, snapshotOffline(next, Date.now(), bank), owner);
      // Each answer is one item under the player's seat. Closest number guesses wait for the end (QP6).
      const before = prev.round && next.round && prev.turn === next.turn ? prev.round.answers.length : 0;
      if (next.round && prev.round !== next.round) {
        for (const a of next.round.answers.slice(before)) if (!a.held) record(currentSeat(next), a);
      }
      if (next.phase === 'done' && prev.phase !== 'done') {
        for (const x of settleClosest(next.results, bank)) for (const a of x.answers) if (a.held) record(x.seat, a);
        const rows = offlineRows(next, names, bank);
        const extra = new Map(rows.map((x) => [x.seat, x]));
        const mine = rows.find((x) => x.seat === 0)?.score ?? 0;
        onFinish(mine, rank(rows.map(({ seat, name, score, timeMs }) => ({ seat, name, score, timeMs })), (a, b) => paradeTieBreak(extra.get(a.seat)!, extra.get(b.seat)!)));
      }
    },
    [play, onFinish, names, record],
  );

  const [now, ticks] = useTickerClock(run?.phase === 'countdown' || run?.phase === 'playing', 150, (n) => dispatch({ type: 'TICK', now: n }), {
    shown: (n) => {
      const r = ref.current;
      return r?.phase === 'countdown' && r.countdownUntil != null ? Math.max(1, Math.ceil((r.countdownUntil - n) / 1000)) : 0;
    },
  });

  usePauseHide(() => dispatch({ type: 'PAUSE', now: Date.now() }));

  if (!run || run.phase === 'done') return <GameScreen scroll={false}>{null}</GameScreen>;

  const seat = currentSeat(run);
  const who = seatOf.get(seat);
  const paused = run.phase === 'paused';
  const board = offlineRows(run, names, bank)
    .map((x) => ({ seat: x.seat, name: x.name, score: x.score, color: seatOf.get(x.seat)?.color }))
    .sort((a, b) => b.score - a.score);
  const left = run.order.slice(run.turn + 1).filter((x) => !run.removed.includes(x));
  // Before a turn starts there is no question yet: show the turn's first one under the curtain (never readable).
  const round = run.round ?? startRound(run.queues[Math.min(run.turn, run.queues.length - 1)], now, bank);
  const q = questionById.get(round.queue[Math.min(round.index, round.queue.length - 1)])!;
  const turnOver = run.phase === 'turnOver' || (paused && run.before === 'turnOver');
  const turnNo = run.order.slice(0, run.turn + 1).filter((x) => !run.removed.includes(x)).length;
  const name = who?.name ?? `Player ${seat + 1}`;

  return (
    <ParadeBoard
      q={q}
      round={round}
      ticks={ticks}
      leftAt={(n) => (run.round ? timeLeft(run.round, n) : round.limitMs)}
      who={{ name, color: who?.color }}
      onAnswer={(response) => dispatch({ type: 'ROUND', e: { type: 'ANSWER', response, now: Date.now() } })}
      onPause={() => dispatch({ type: 'PAUSE', now: Date.now() })}
      hidden={paused || run.phase === 'handoff' || run.phase === 'countdown'}
      dock={
        turnOver && run.round ? (
          <OverCard
            round={run.round}
            title={`${name} scored ${run.round.score}`}
            note={run.round.answers.some((a) => a.held) ? 'Closest number is scored at the end.' : undefined}
            next={left.length ? 'Pass the phone' : 'See results'}
            onNext={() => dispatch({ type: 'NEXT' })}
          />
        ) : undefined
      }>
      {run.phase === 'handoff' ? (
        <Curtain
          name={name}
          color={who?.color}
          sub={`Turn ${turnNo} of ${run.order.length - run.removed.length} · ${round.queue.length} questions`}
          board={board}
          recap={offlineRecap(run, seat, play)}
          onReady={() => dispatch({ type: 'READY', now: Date.now() })}
        />
      ) : null}
      {run.phase === 'countdown' && run.countdownUntil != null ? (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(160)} style={[StyleSheet.absoluteFill, s.cd, { backgroundColor: t.sky, overflow: 'hidden' }]}>
          <Backdrop anchor="bottom" />
          <Kick>Get ready</Kick>
          <Text style={[s.cdN, { color: who?.color ?? t.accent }]}>{Math.max(1, Math.ceil((run.countdownUntil - now) / 1000))}</Text>
          <Text style={[s.cdS, { color: t.mute }]}>{`${name}, your turn starts`}</Text>
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
    </ParadeBoard>
  );
}

const s = StyleSheet.create({
  cd: { zIndex: 30, alignItems: 'center', justifyContent: 'center', gap: u(10) },
  cdN: { fontFamily: F.display, fontSize: u(64), lineHeight: u(70) },
  cdS: { fontFamily: F.body, fontSize: u(11.5) },
});
