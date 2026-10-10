import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { u } from '@/theme/scale';

import { engine } from '../engine';
import { usePauseHide } from '../engine/usePauseHide';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import type { PlayProps } from '../shell/types';
import type { BoardHandle } from './Board';
import { FIELDS, RECENT_KEY, WORDS, wordById } from './data';
import { ChalkBtn, ChalkChip, ChalkTimer, ChalkTitle, Kicker, Ledge, Note, PauseBtn, Panel, SL, SlateScreen, TopRow, useSlateRoom, useSlateFonts } from './slate';
import { soloLeft, startSolo, stepSolo, type SoloEvent, type SoloRun } from './solo';
import { FitBoard } from './Stage';
import { useTicker } from '../engine/useTicker';

/** Saved for resume: a drawing turn is saved paused (rule 10). The board itself starts clean again. */
const snapshot = (r: SoloRun, now: number) => (r.phase === 'drawing' ? stepSolo(r, { type: 'PAUSE', now }, WORDS) : r);

/** Solo practice (SA2): pick fields, draw against 60 s, then Next, Retry or Finish. Nothing asked, nothing gained. */
export function SoloPlay({ play, onFinish, onQuit }: PlayProps) {
  const fonts = useSlateFonts();
  const R = useSlateRoom();
  const [run, setRun] = useState<SoloRun | null>((play.resume as SoloRun | null) ?? null);
  const ref = useRef<SoloRun | null>(run);
  const [fields, setFields] = useState<string[]>([]);
  const board = useRef<BoardHandle>(null);
  const [ink, setInk] = useState(0);
  const [size, setSize] = useState(0);
  const [erase, setErase] = useState(false);

  const set = useCallback(
    (next: SoloRun) => {
      ref.current = next;
      setRun(next);
      engine.recorder.bookmark(play.id, snapshot(next, Date.now()), next.done.length);
      engine.kv.set(RECENT_KEY, next.recent);
    },
    [play.id],
  );

  const begin = useCallback(async () => {
    const recent = (await engine.kv.get<string[]>(RECENT_KEY)) ?? [];
    set(startSolo(WORDS, { seed: play.id, fields, recent, now: Date.now() }));
  }, [play.id, fields, set]);

  const dispatch = useCallback(
    (e: SoloEvent) => {
      const prev = ref.current;
      if (!prev) return;
      const next = stepSolo(prev, e, WORDS);
      if (next === prev) return;
      // A disease is recorded once the player moves on from its reveal (Retry draws it again instead).
      if (prev.phase === 'reveal' && (e.type === 'NEXT' || e.type === 'FINISH')) {
        const d = prev.done[prev.done.length - 1];
        const w = wordById.get(d.wordId);
        recordItem(play, {
          seat: 0,
          itemId: d.wordId,
          answerKey: w?.dossier ?? null,
          outcome: 'skipped',
          answersGiven: [],
          timeMs: d.timeMs,
          hintsUsed: 0,
          revealsUsed: 0,
          points: 0,
          feedsLearn: false, // SA1
          gameData: { field: w?.field },
        });
      }
      set(next);
      if (next.phase === 'done') onFinish(next.done.length);
    },
    [play, set, onFinish],
  );

  const now = useTicker(run?.phase === 'drawing', 200, (n) => dispatch({ type: 'TICK', now: n }));

  usePauseHide(() => dispatch({ type: 'PAUSE', now: Date.now() }));

  if (!fonts) return <SlateScreen>{null}</SlateScreen>;

  if (!run)
    return (
      <SlateScreen>
        <Kicker>Practice sketch</Kicker>
        <ChalkTitle size={22}>What do you want to draw?</ChalkTitle>
        <Note style={{ fontSize: u(12.5), lineHeight: u(16) }}>Pick one field or several, or keep all fields.</Note>
        <View style={s.chips}>
          <ChalkChip small label="All fields" on={!fields.length} onPress={() => setFields([])} />
          {FIELDS.map((f) => (
            <ChalkChip small key={f} label={f} on={fields.includes(f)} onPress={() => setFields(fields.includes(f) ? fields.filter((x) => x !== f) : [...fields, f])} />
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <ChalkBtn label="Start drawing" onPress={begin} />
      </SlateScreen>
    );

  if (run.phase === 'done') return <SlateScreen>{null}</SlateScreen>;

  const paused = run.phase === 'paused';
  const phase = paused ? run.before : run.phase;
  const w = wordById.get(run.wordId)!;
  const left = phase === 'drawing' ? soloLeft(run, now) : 0;
  const last = run.done[run.done.length - 1];
  const pause = () => dispatch({ type: 'PAUSE', now: Date.now() });

  return (
    <SlateScreen>
      <TopRow
        kicker={`Practice · disease ${run.used.length}`}
        title={phase === 'reveal' ? (last && last.timeMs >= run.turnMs ? "Time's up" : 'Done') : 'Draw this'}
        right={
          <>
            {phase === 'drawing' ? <ChalkTimer leftMs={left} totalMs={run.turnMs} /> : null}
            <PauseBtn onPress={pause} />
          </>
        }
      />
      <Panel style={s.word}>
        <Text style={[s.wordT, { color: R.mark }]} numberOfLines={2} adjustsFontSizeToFit>
          {paused ? '· · ·' : w.name}
        </Text>
        <Text style={[s.field, { color: R.soft }]} numberOfLines={1}>{paused ? ' ' : [w.aliases.length ? w.aliases.join(', ') : null, w.field].filter(Boolean).join(' · ')}</Text>
      </Panel>
      <FitBoard boardKey={run.board} boardRef={board} ink={ink} size={size} erase={erase} enabled={phase === 'drawing'} paused={paused} />
      {phase === 'drawing' ? (
        <>
          <Ledge ink={ink} size={size} erase={erase} onInk={(i) => (setInk(i), setErase(false))} onSize={() => setSize(size ? 0 : 1)} onErase={() => setErase(!erase)} onUndo={() => board.current?.undo()} onClear={() => board.current?.clear()} />
          <View style={s.row}>
            <ChalkBtn ghost label="Finish" onPress={() => dispatch({ type: 'FINISH' })} style={{ flex: 1 }} />
            <ChalkBtn label="I'm done" onPress={() => dispatch({ type: 'REVEAL', now: Date.now() })} style={{ flex: 2 }} />
          </View>
        </>
      ) : (
        <View style={s.row}>
          <ChalkBtn ghost label="Retry" onPress={() => dispatch({ type: 'RETRY', now: Date.now() })} style={{ flex: 1 }} />
          <ChalkBtn ghost label="Finish" onPress={() => dispatch({ type: 'FINISH' })} style={{ flex: 1 }} />
          <ChalkBtn label="Next" onPress={() => dispatch({ type: 'NEXT', now: Date.now() })} style={{ flex: 1.3 }} />
        </View>
      )}
      <PauseMenu open={paused} mode="solo" onResume={() => dispatch({ type: 'RESUME', now: Date.now() })} onQuit={onQuit} />
    </SlateScreen>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(5) },
  word: { alignItems: 'center', paddingVertical: u(8) },
  wordT: { fontFamily: SL.head, fontSize: u(21), lineHeight: u(25), textAlign: 'center' },
  field: { fontFamily: SL.body, fontSize: u(13) },
  row: { flexDirection: 'row', gap: u(8), flexWrap: 'wrap' },
});
