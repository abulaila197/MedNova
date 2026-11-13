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
import { lengthCheck, minLen, type Style } from './core';
import { isWord, poolFor, wordById } from './data';
import {
  currentSeat, offlineRecap, offlineStandings, showDefinition, snapshotOffline, startOffline, stepOffline, turnLeft,
  type OfflineEvent, type OfflineRun,
} from './offline';
import { DoneCard } from './SoloPlay';
import { HURRY_MS, SlideTable, TurnClock } from './Slides';
import { second, useTicker } from '../engine/useTicker';
import { TurnName } from '@/games/shell/TurnName';
import { tr } from '@/i18n';

/** Read outside render (React Compiler lint): only called from the submit handler. */
const clockNow = () => Date.now();

const STYLE_NAME: Record<Style, string> = { classic: tr('Classic'), five: tr('Classic'), custom: tr('Custom') };

/** Offline Multiplayer: one shared board per word, turns in random full laps, a timer per guess, no hint, no EXP. */
export function OfflinePlay({ play, onFinish, onQuit }: PlayProps) {
  const t = useTheme();
  const style = (play.settings.style as Style) ?? 'classic';
  const [run, setRun] = useState<OfflineRun | null>(null);
  const runRef = useRef<OfflineRun | null>(null);
  const seatOf = useMemo(() => new Map(play.seats.map((x) => [x.seat, x])), [play.seats]);
  const names = useMemo(() => Object.fromEntries(play.seats.map((x) => [x.seat, x.name])), [play.seats]);

  useEffect(() => {
    let live = true;
    (async () => {
      let r = play.resume as OfflineRun | null;
      if (r && !r.wordIds.every((id) => wordById.has(id))) r = null; // a word left the list since: start fresh
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
  const now = useTicker(run?.phase === 'playing', 200, (n) => dispatch({ type: 'TICK', now: n }), { shown: (n) => run && second(turnLeft(run, n)) });

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
    if (bad === 'short') return style === 'custom' ? tr('At least 7 letters') : tr('Not enough letters');
    if (bad === 'long') return tr('Too many letters');
    if (!isWord(g)) return tr('Not in word list');
    dispatch({ type: 'GUESS', word: g, answer: w.word, now: clockNow() });
    return null;
  };

  const winner = res?.winner != null ? seatOf.get(res.winner) : null;
  return (
    <SlideTable
      label={{
        no: tr('WORD {n} OF {n2}', { n: run.index + 1, n2: run.wordIds.length }),
        title: tr('Six Word Tries'),
        sub: phase === 'wordOver' ? tr('{n} · {n2} letters · {rows} rows', { n: STYLE_NAME[style], n2: w.word.length, rows: run.rows }) : <TurnName name={who?.name ?? ''} color={who?.color} after={tr('’s turn · {n} · {n2} letters', { n: STYLE_NAME[style], n2: w.word.length })} />,
        right: phase === 'playing' ? <TurnClock ms={left} warn={left <= HURRY_MS} /> : undefined,
      }}
      answer={w.word}
      played={run.turns.map((x) => ({ word: x.word, color: seatOf.get(x.seat)?.color }))}
      rows={run.rows}
      activeColor={phase === 'wordOver' ? undefined : who?.color}
      rowSeq={run.rowSeq}
      definition={showDefinition(run) ? w.definition : null}
      noteHot={run.phase === 'playing' || (run.phase === 'paused' && run.before === 'playing')}
      live={run.phase === 'playing'}
      onSubmit={submit}
      maxLen={w.word.length}
      minLen={minLen(style)}
      onPause={() => dispatch({ type: 'PAUSE', now: Date.now() })}
      hidden={paused && run.before === 'playing'}
      dock={
        res ? (
          <DoneCard
            line={winner ? tr('{name} wins the word', { name: winner.name }) : tr('The word was {word}', { word: w.word })}
            sub={winner ? tr('{word} on row {n}', { word: w.word, n: res.turns.length }) : tr('Nobody got it this time.')}
            primary={{ label: lastWord ? tr('See results') : tr('Next word'), onPress: () => dispatch({ type: 'NEXT' }) }}
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
          sub={tr('Word {n} of {n2} · {secs} s per guess', { n: run.index + 1, n2: run.wordIds.length, secs })}
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
      <Text style={[s.k, { color: t.dim }]}>{tr('PASS THE PHONE TO')}</Text>
      <Text style={[s.name, { color }]}>{name}</Text>
      <Text style={[s.sub, { color: t.mute }]}>{tr('{secs} seconds for this guess', { secs })}</Text>
      {recap.length ? <View style={s.recap}><Recap lines={recap} /></View> : null}
      <Btn label={tr('I\'m ready')} onPress={onReady} style={{ alignSelf: 'stretch', marginTop: u(6) }} />
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
