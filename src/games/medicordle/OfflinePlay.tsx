import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { engine, rank } from '../engine';
import { usePauseHide } from '../engine/usePauseHide';
import { Curtain, Recap } from '../shell/Curtain';
import type { RecapLine } from '../shell/recap';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import { teamLap, teamsOf } from '../shell/teams';
import type { PlayProps } from '../shell/types';
import { Btn, GameScreen } from '../shell/ui';
import { lengthCheck, type Style } from './core';
import { isWord, poolFor, wordById } from './data';
import {
  currentSeat, offlineRecap, offlineStandings, showDefinition, snapshotOffline, startOffline, stepOffline, turnLeft,
  type OfflineEvent, type OfflineRun,
} from './offline';
import { DoneCard } from './SoloPlay';
import { SlideTable, TurnClock } from './Slides';

const STYLE_NAME: Record<Style, string> = { classic: 'Classic', custom: 'Custom' };

/** Offline Multiplayer: one shared board per word, turns in random full laps, a timer per guess, no hint, no EXP. */
export function OfflinePlay({ play, onFinish, onQuit }: PlayProps) {
  const t = useTheme();
  const style = (play.settings.style as Style) ?? 'classic';
  const [run, setRun] = useState<OfflineRun | null>(null);
  const runRef = useRef<OfflineRun | null>(null);
  const [now, setNow] = useState(Date.now());
  const seatOf = useMemo(() => new Map(play.seats.map((x) => [x.seat, x])), [play.seats]);
  const names = useMemo(() => Object.fromEntries(play.seats.map((x) => [x.seat, x.name])), [play.seats]);

  useEffect(() => {
    let live = true;
    (async () => {
      let r = play.resume as OfflineRun | null;
      if (!r) {
        const live = play.seats.filter((x) => !x.removed);
        const seats = live.map((x) => x.seat);
        const words = Number(play.settings.words) || 3;
        const ids = await engine.picker.pick(play.game, poolFor(style).map((w) => w.id), words);
        const teams = teamsOf(play);
        r = startOffline(style, seats, ids, (Number(play.settings.turn) || 20) * 1000, Math.random, teams ? teamLap(live, teams) : null);
      }
      if (live) {
        runRef.current = r;
        setRun(r);
      }
    })();
    return () => {
      live = false;
    };
  }, [play, style]);

  const dispatch = useCallback(
    (e: OfflineEvent) => {
      const prev = runRef.current;
      if (!prev) return;
      const next = stepOffline(prev, e);
      if (next === prev) return;
      runRef.current = next;
      setRun(next);
      const owner = next.results.filter((x) => x.winner === 0).length;
      engine.recorder.bookmark(play.id, snapshotOffline(next, Date.now()), owner);
      if (next.results.length > prev.results.length) {
        const res = next.results[next.results.length - 1];
        const w = wordById.get(res.wordId)!;
        engine.picker.markSeen(play.game, res.wordId);
        recordItem(play, {
          seat: res.winner ?? -1, // -1 = nobody guessed it
          itemId: res.wordId,
          answerKey: w.dossier,
          outcome: res.winner != null ? 'right' : 'wrong',
          answersGiven: res.turns.filter((x) => x.word && x.word !== w.word).map((x) => x.word as string),
          timeMs: res.turns.reduce((a, x) => a + x.timeMs, 0),
          hintsUsed: 0,
          revealsUsed: 0,
          points: res.winner != null ? 1 : 0,
          feedsLearn: false, // NM1
          gameData: { style, exp: 0, turns: res.turns.map((x) => ({ seat: x.seat, word: x.word })) }, // NM25: no EXP offline
        });
      }
      if (next.phase === 'done' && prev.phase !== 'done') onFinish(owner, rank(offlineStandings(next, names)));
    },
    [play, style, onFinish, names],
  );

  // The turn clock (NM9): time out passes the turn.
  useEffect(() => {
    if (run?.phase !== 'playing') return;
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      dispatch({ type: 'TICK', now: n });
    }, 200);
    return () => clearInterval(id);
  }, [run?.phase, dispatch]);

  usePauseHide(() => dispatch({ type: 'PAUSE', now: Date.now() }));

  if (!run || run.phase === 'done') return <GameScreen scroll={false}>{null}</GameScreen>;

  const w = wordById.get(run.wordIds[run.index])!;
  const seat = currentSeat(run);
  const who = seatOf.get(seat);
  const paused = run.phase === 'paused';
  const phase = paused ? run.before : run.phase;
  const res = phase === 'wordOver' ? run.results[run.results.length - 1] : null;
  const board = rank(offlineStandings(run, names)).map((x) => ({ seat: x.seat, name: x.name, score: x.score, color: seatOf.get(x.seat)?.color }));
  const lastWord = run.index + 1 >= run.wordIds.length;
  const left = turnLeft(run, now);
  const secs = run.turnMs / 1000;
  // OF1: the hand-off shows what happened since this player last guessed (no letters).
  const recap = phase === 'ready' ? offlineRecap(run, seat, play, (id) => wordById.get(id)!.word) : [];

  const submit = (g: string) => {
    const bad = lengthCheck(g, style, w.word.length);
    if (bad === 'short') return style === 'custom' ? 'At least 7 letters' : 'Not enough letters';
    if (bad === 'long') return 'Too many letters';
    if (!isWord(g)) return 'Not in word list';
    dispatch({ type: 'GUESS', word: g, answer: w.word, now: Date.now() });
    return null;
  };

  const winner = res?.winner != null ? seatOf.get(res.winner) : null;
  return (
    <SlideTable
      label={{
        no: `WORD ${run.index + 1} OF ${run.wordIds.length}`,
        title: 'Medicordle',
        sub: phase === 'wordOver' ? `${STYLE_NAME[style]} · ${w.word.length} letters · ${run.rows} rows` : `${who?.name ?? ''}'s turn · ${STYLE_NAME[style]} · ${w.word.length} letters`,
        right: phase === 'playing' ? <TurnClock ms={left} warn={left <= 5_000} /> : undefined,
      }}
      answer={w.word}
      played={run.turns.map((x) => ({ word: x.word, color: seatOf.get(x.seat)?.color }))}
      rows={run.rows}
      activeColor={phase === 'wordOver' ? undefined : who?.color}
      rowSeq={run.rowSeq}
      definition={showDefinition(run) ? w.definition : null}
      live={run.phase === 'playing'}
      onSubmit={submit}
      maxLen={w.word.length}
      minLen={style === 'custom' ? 7 : 6}
      onPause={() => dispatch({ type: 'PAUSE', now: Date.now() })}
      hidden={paused && run.before === 'playing'}
      dock={
        res ? (
          <DoneCard
            line={winner ? `${winner.name} wins the word` : `The word was ${w.word}`}
            sub={winner ? `${w.word} on row ${res.turns.length}` : 'Nobody got it this time.'}
            primary={{ label: lastWord ? 'See results' : 'Next word', onPress: () => dispatch({ type: 'NEXT' }) }}
          />
        ) : phase === 'ready' && run.turns.length > 0 ? (
          <TurnCard name={who?.name ?? ''} color={who?.color ?? t.accent} secs={secs} recap={recap} onReady={() => dispatch({ type: 'READY', now: Date.now() })} />
        ) : undefined
      }>
      {run.phase === 'ready' && run.turns.length === 0 ? (
        // Rule 16 at each new word: full curtain with the scoreboard. Between guesses the board is shared, so a turn card is enough.
        <Curtain
          name={who?.name ?? ''}
          color={who?.color}
          sub={`Word ${run.index + 1} of ${run.wordIds.length} · ${secs} s per guess`}
          board={board}
          recap={recap}
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
    </SlideTable>
  );
}

/** Between guesses: whose turn, in their colour, and "I'm ready" to start their clock. */
function TurnCard({ name, color, secs, recap, onReady }: { name: string; color: string; secs: number; recap: RecapLine[]; onReady: () => void }) {
  const t = useTheme();
  return (
    <View style={s.card}>
      <Text style={[s.k, { color: t.dim }]}>PASS THE PHONE TO</Text>
      <Text style={[s.name, { color }]}>{name}</Text>
      <Text style={[s.sub, { color: t.mute }]}>{`${secs} seconds for this guess`}</Text>
      {recap.length ? <View style={s.recap}><Recap lines={recap} /></View> : null}
      <Btn label="I'm ready" onPress={onReady} style={{ alignSelf: 'stretch', marginTop: u(6) }} />
    </View>
  );
}

const s = StyleSheet.create({
  card: { alignItems: 'center', gap: u(3), paddingTop: u(2) },
  recap: { alignSelf: 'stretch', marginTop: u(6) },
  k: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(1.4) },
  name: { fontFamily: F.display, fontSize: u(24), lineHeight: u(27) },
  sub: { fontFamily: F.body, fontSize: u(10.5) },
});
