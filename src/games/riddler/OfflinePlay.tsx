import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

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
import { Btn, GameScreen, Kick } from '../shell/ui';
import { clock } from '@/games/engine/clock';
import { shuffle } from '../engine/random';
import { RIDDLES, answerLabel, feedsLearn, riddleById, riddleName } from './data';
import {
  currentPhoto, currentSeat, lockLeft, offlineRecap, offlineRows, riddlerTieBreak, snapshotOffline, startOffline, stepOffline, turnLeft,
  type OfflineEvent, type OfflineRun,
} from './offline';
import { RiddleBoard } from './RiddleBoard';
import { useTicker } from '../engine/useTicker';

/** Offline (RD5, RD6, RD12, TMG-RD): the same picture for everyone in turn, then a reveal; no hint, no EXP. */
export function OfflinePlay({ play, onFinish, onQuit }: PlayProps) {
  const photos = Number(play.settings.photos) || 5;
  const turnMs = (Number(play.settings.turn) || 90) * 1000;
  const [run, setRun] = useState<OfflineRun | null>(null);
  const ref = useRef<OfflineRun | null>(null);
  const seatOf = useMemo(() => new Map(play.seats.map((x) => [x.seat, x])), [play.seats]);
  const names = useMemo(() => Object.fromEntries(play.seats.map((x) => [x.seat, x.name])), [play.seats]);

  // Start: pictures unseen first (rule 15), order shuffled once per match, or teams alternate (TM5).
  useEffect(() => {
    let live = true;
    (async () => {
      let r = play.resume as OfflineRun | null;
      if (!r) {
        const seats = play.seats.filter((x) => !x.removed);
        const teams = teamsOf(play);
        const order = teams ? teamLap(seats, teams) : shuffle(seats.map((x) => x.seat));
        const ids = await engine.picker.pick(play.game, RIDDLES.map((x) => x.id), photos);
        r = startOffline(order, ids, turnMs);
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
  }, [play, photos, turnMs]);

  const dispatch = useCallback(
    (e: OfflineEvent) => {
      const prev = ref.current;
      if (!prev) return;
      const next = stepOffline(prev, e);
      if (next === prev) return;
      ref.current = next;
      setRun(next);
      const rows = offlineRows(next, names);
      const owner = rows.find((x) => x.seat === 0)?.score ?? 0;
      engine.recorder.bookmark(play.id, snapshotOffline(next, Date.now()), owner);
      // Each picture is one item per player once it is scored. Only the phone owner's unsolved condition pictures go to Learn (RD5).
      if (next.results.length > prev.results.length) {
        const res = next.results[next.results.length - 1];
        const r = riddleById.get(res.riddleId)!;
        const turns = next.turns;
        for (const sc of res.scores) {
          if (sc.seat === 0) engine.picker.markSeen(play.game, r.id);
          recordItem(play, {
            seat: sc.seat,
            itemId: r.id,
            answerKey: r.dossier,
            outcome: sc.solved ? 'right' : 'timed_out',
            answersGiven: (turns.find((x) => x.seat === sc.seat)?.wrong ?? []).map(answerLabel),
            timeMs: sc.timeMs,
            hintsUsed: 0,
            revealsUsed: 0,
            points: sc.points,
            feedsLearn: sc.seat === 0 && !sc.solved && feedsLearn(r),
            gameData: { rank: sc.rank, rankPoints: sc.rankPoints, timeBonus: sc.timeBonus, wrong: sc.wrong, kind: r.kind },
          });
        }
      }
      if (next.phase === 'done' && prev.phase !== 'done') {
        const extra = new Map(rows.map((x) => [x.seat, x]));
        onFinish(owner, rank(rows.map(({ seat, name, score, timeMs }) => ({ seat, name, score, timeMs })), (a, b) => riddlerTieBreak(extra.get(a.seat)!, extra.get(b.seat)!)));
      }
    },
    [play, onFinish, names],
  );

  const now = useTicker(run?.phase === 'playing', 200, (n) => dispatch({ type: 'TICK', now: n }));

  usePauseHide(() => dispatch({ type: 'PAUSE', now: Date.now() }));

  if (!run || run.phase === 'done') return <GameScreen scroll={false}>{null}</GameScreen>;

  const seat = currentSeat(run);
  const who = seatOf.get(seat);
  const paused = run.phase === 'paused';
  const over = run.phase === 'photoOver' || (paused && run.before === 'photoOver');
  const rows = offlineRows(run, names);
  const board = rows.map((x) => ({ seat: x.seat, name: x.name, score: x.score, color: seatOf.get(x.seat)?.color })).sort((a, b) => b.score - a.score);
  const r = riddleById.get(currentPhoto(run))!;
  const turnNo = run.order.slice(0, run.turn + 1).filter((x) => !run.removed.includes(x)).length;
  const players = run.order.length - run.removed.length;
  const playing = run.phase === 'playing' || (paused && run.before === 'playing');

  return (
    <RiddleBoard
      riddle={r}
      turnKey={`${run.index}:${run.turn}`}
      kicker={over ? `Picture ${run.index + 1} of ${run.photos.length}` : `Picture ${run.index + 1} of ${run.photos.length} · turn ${turnNo} of ${players}`}
      title={over ? { text: 'Everyone has played' } : { text: who?.name ?? `Player ${seat + 1}`, color: who?.color }}
      clockMs={playing ? turnLeft(run, now) : run.turnMs}
      countdown
      lives={null}
      lockMs={run.phase === 'playing' ? lockLeft(run, now) : 0}
      wrong={playing ? run.wrong : []}
      wrongSeq={run.wrongSeq}
      onGuess={(answerId) => dispatch({ type: 'GUESS', answerId, now: Date.now() })}
      onPause={() => dispatch({ type: 'PAUSE', now: Date.now() })}
      hidden={paused || run.phase === 'handoff'}
      dock={over ? <Reveal run={run} names={names} colors={seatOf} onNext={() => dispatch({ type: 'NEXT' })} /> : undefined}>
      {run.phase === 'handoff' ? (
        <Curtain
          name={who?.name ?? `Player ${seat + 1}`}
          color={who?.color}
          sub={`Picture ${run.index + 1} of ${run.photos.length} · ${run.turnMs / 1000} s turn`}
          board={board}
          recap={offlineRecap(run, seat, play, clock)}
          onReady={() => dispatch({ type: 'READY', now: Date.now() })}
        />
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
    </RiddleBoard>
  );
}

/** After everyone has played a picture: the answer and each player's result, then the next picture. */
function Reveal({ run, names, colors, onNext }: { run: OfflineRun; names: Record<number, string>; colors: Map<number, { color?: string }>; onNext: () => void }) {
  const t = useTheme();
  const res = run.results[run.results.length - 1];
  const r = riddleById.get(res.riddleId)!;
  const last = run.index + 1 >= run.photos.length;
  const rows = [...res.scores].sort((a, b) => b.points - a.points);
  return (
    <View style={[s.card, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
      <Kick color={t.accent}>The answer</Kick>
      <Text style={[s.ans, { color: t.white }]}>{riddleName(r)}</Text>
      <View style={{ gap: u(4) }}>
        {rows.map((x) => (
          <View key={x.seat} style={s.row}>
            <View style={[s.dot, { backgroundColor: colors.get(x.seat)?.color ?? t.accent }]} />
            <Text style={[s.who, { color: t.fg }]} numberOfLines={1}>{names[x.seat] ?? `Player ${x.seat + 1}`}</Text>
            <Text style={[s.how, { color: t.mute }]}>{x.solved ? clock(x.timeMs) : 'time up'}</Text>
            <Text style={[s.pts, { color: x.points ? t.white : t.dim }]}>{x.points ? `+${x.points}` : '0'}</Text>
          </View>
        ))}
      </View>
      <Btn label={last ? 'See results' : 'Next picture'} onPress={onNext} style={{ marginTop: u(4) }} />
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: u(16), padding: u(13), gap: u(6) },
  ans: { fontFamily: F.display, fontSize: u(21), lineHeight: u(25) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  dot: { width: u(8), height: u(8), borderRadius: u(4) },
  who: { flex: 1, fontFamily: F.bodySemi, fontSize: u(12) },
  how: { fontFamily: F.mono, fontSize: u(10.5) },
  pts: { fontFamily: F.mono, fontSize: u(11.5), minWidth: u(36), textAlign: 'right' },
});
