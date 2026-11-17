import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { u } from '@/theme/scale';

import { engine } from '../engine';
import { usePauseHide } from '../engine/usePauseHide';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import type { PlayProps } from '../shell/types';
import type { BoardHandle, Stroke } from './Board';
import { isBasic, PICKABLE, RECENT_KEY, WORDS, wordById } from './data';
import { FieldPicker } from '../shell/FieldPicker';
import { type FieldMenu, fieldsValue, groupsOf, inFields } from '../shell/fields';
import { ChalkBtn, ChalkChoice, ChalkSelect, ChalkTitle, ClockChalkTimer, Kicker, Ledge, Note, PauseBtn, Panel, SL, SlateScreen, TopRow, useSlateRoom, useSlateFonts } from './slate';
import { SA } from './core';
import { soloLeft, startSolo, stepSolo, type SoloEvent, type SoloRun } from './solo';
import { FitBoard } from './Stage';
import { useTickerClock } from '../engine/useTicker';
import { tr } from '@/i18n';
import { priced } from '@/components/CoinLabel';
import { sparksCost } from '@/features/sparks/costs';
import { chargeUnit, needSparks, shownCost } from '@/features/sparks/sparks';

/** The practice field list: clinical fields largest first, then the basic sciences, each with its word count. */
const FIELD_MENU: FieldMenu = {
  groups: groupsOf(PICKABLE, (w) => w.field, (w) => (isBasic(w) ? tr('Basic science') : tr('Clinical')), (f) => f, [tr('Clinical'), tr('Basic science')]),
  total: (t) => inFields(PICKABLE, (w) => w.field, t).length,
  min: 1,
  unit: 'words',
};

/** The lines on the board, saved with the bookmark so an app kill mid-drawing comes back to the same drawing. */
type Sketch = { board: number; strokes: Stroke[] };
type Saved = SoloRun & { sketch?: Sketch };

/** Saved for resume: a drawing turn is saved paused (rule 10), with the drawing so far. */
const snapshot = (r: SoloRun, now: number, sketch: Sketch | null): Saved => {
  const run = r.phase === 'drawing' ? stepSolo(r, { type: 'PAUSE', now }, WORDS) : r;
  return sketch && sketch.board === r.board ? { ...run, sketch } : run;
};

/** Solo practice (SA2): pick fields, draw against 60 s, then Next, Retry or Finish. Nothing asked, nothing gained. */
export function SoloPlay({ play, onFinish, onQuit }: PlayProps) {
  const fonts = useSlateFonts();
  const R = useSlateRoom();
  // A bookmark whose word has left the list since starts fresh.
  const [resumed] = useState(() => {
    const saved = play.resume as Saved | null;
    if (!saved || !wordById.has(saved.wordId)) return null;
    const { sketch = null, ...r } = saved;
    return { run: r as SoloRun, sketch };
  });
  const [run, setRun] = useState<SoloRun | null>(resumed?.run ?? null);
  const ref = useRef<SoloRun | null>(run);
  const sketch = useRef<Sketch | null>(resumed?.sketch ?? null);
  // null = every field; [] = none ticked (Start waits for one).
  const [fields, setFields] = useState<string[] | null>(null);
  const [menuTop, setMenuTop] = useState<number | null>(null);
  // Yazan 2026-11-12: Practice may have No clock, chosen on this game's own start page.
  const [noClock, setNoClock] = useState(false);
  const board = useRef<BoardHandle>(null);
  const [ink, setInk] = useState(0);
  const [size, setSize] = useState(0);
  const [erase, setErase] = useState(false);
  // A word of my own (My diseases): only that word, no field picker.
  const custom = typeof play.settings.custom === 'string' ? wordById.get(play.settings.custom) : undefined;
  const [pool] = useState(() => (custom ? [custom] : PICKABLE));
  // Each practice drawing pays the setup price (Yazan 2026-11-13), so Next and Retry cost Sparks like a new game.
  // Drawing n is paid under its own number, so a resumed play never pays twice. A word of your own stays free.
  const cost = custom ? 0 : sparksCost(play.game, 'solo', play.settings);
  const paid = useCallback(
    async (n: number) => {
      if (!cost) return true;
      if (!(await needSparks(cost))) return false; // offline too: the phone keeps its own bar
      void chargeUnit(play, `${play.id}:D${n}`, cost);
      return true;
    },
    [cost, play],
  );

  const set = useCallback(
    (next: SoloRun) => {
      ref.current = next;
      setRun(next);
      engine.recorder.bookmark(play.id, snapshot(next, Date.now(), sketch.current), next.done.length);
      if (!custom) engine.kv.set(RECENT_KEY, next.recent);
    },
    [play.id, custom],
  );

  const begin = useCallback(async () => {
    if (!(await paid(1))) return;
    const recent = (await engine.kv.get<string[]>(RECENT_KEY)) ?? [];
    set(startSolo(pool, { seed: play.id, fields: custom ? [] : (fields ?? []), recent: custom ? [] : recent, now: Date.now(), noClock: !custom && noClock }));
  }, [play.id, fields, set, pool, custom, noClock, paid]);

  useEffect(() => {
    if (custom && !ref.current) void begin();
  }, [custom, begin]);

  const dispatch = useCallback(
    (e: SoloEvent) => {
      const prev = ref.current;
      if (!prev) return;
      const next = stepSolo(prev, e, pool);
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
    [play, set, onFinish, pool],
  );

  /** Next or Retry: the new drawing is paid first. */
  const again = useCallback(
    async (type: 'NEXT' | 'RETRY') => {
      const n = (ref.current?.done.length ?? 0) + 1;
      if (await paid(n)) dispatch({ type, now: Date.now() });
    },
    [paid, dispatch],
  );
  // Each finished line, Undo or Clear updates the bookmark's drawing.
  const onStrokes = useCallback(
    (strokes: Stroke[]) => {
      const r = ref.current;
      if (!r) return;
      sketch.current = { board: r.board, strokes };
      engine.recorder.bookmark(play.id, snapshot(r, Date.now(), sketch.current));
    },
    [play.id],
  );

  // The screen shows no time of its own: only the chalk ring follows the clock (on every tick, by itself).
  const [, clock] = useTickerClock(run?.phase === 'drawing', 200, (n) => dispatch({ type: 'TICK', now: n }), { shown: () => 0 });

  usePauseHide(() => dispatch({ type: 'PAUSE', now: Date.now() }));

  if (!fonts) return <SlateScreen>{null}</SlateScreen>;

  if (!run && custom) return <SlateScreen>{null}</SlateScreen>;
  if (!run)
    // Yazan 2026-11-17: the fields sit in one dropdown (the same list as other games' setups) instead of 39 chips,
    // and the page scrolls with Start kept on screen under it.
    return (
      <SlateScreen scroll bottom={<ChalkBtn label={tr('Start drawing')} onPress={begin} disabled={fields?.length === 0} />}>
        <Kicker>{tr('Practice sketch')}</Kicker>
        <ChalkTitle size={22}>{tr('What do you want to draw?')}</ChalkTitle>
        <Note style={{ fontSize: u(12.5), lineHeight: u(16) }}>{tr('Pick one field or several, or keep all fields.')}</Note>
        <ChalkSelect label={tr('Fields')} value={fields == null ? tr('All') : fields.length === 1 ? fields[0] : tr('{n} picked', { n: fields.length })} onOpen={setMenuTop} />
        <Note style={{ fontSize: u(12.5), lineHeight: u(16), marginTop: u(6) }}>{tr('Clock')}</Note>
        <ChalkChoice value={noClock ? 'off' : 'on'} onChange={(k) => setNoClock(k === 'off')} options={[{ key: 'on', label: tr('{n} s a drawing', { n: SA.soloMs / 1000 }) }, { key: 'off', label: tr('No clock') }]} />
        {menuTop != null ? <FieldPicker menu={FIELD_MENU} ticked={fields} top={menuTop} onChange={(t) => setFields(fieldsValue(FIELD_MENU, t) == null ? null : t)} onClose={() => setMenuTop(null)} /> : null}
      </SlateScreen>
    );

  if (run.phase === 'done') return <SlateScreen>{null}</SlateScreen>;

  const paused = run.phase === 'paused';
  const phase = paused ? run.before : run.phase;
  const w = wordById.get(run.wordId)!;
  const last = run.done[run.done.length - 1];
  const pause = () => dispatch({ type: 'PAUSE', now: Date.now() });

  return (
    <SlateScreen>
      <TopRow
        kicker={tr('Practice · word {n}', { n: run.used.length })}
        title={phase === 'reveal' ? (last && last.timeMs >= run.turnMs ? tr('Time\'s up') : tr('Done')) : tr('Draw this')}
        right={
          <>
            {phase === 'drawing' && !run.noClock ? <ClockChalkTimer clock={clock} leftAt={(n) => soloLeft(run, n)} totalMs={run.turnMs} /> : null}
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
      <FitBoard boardKey={run.board} boardRef={board} ink={ink} size={size} erase={erase} enabled={phase === 'drawing'} paused={paused} initial={resumed?.sketch?.board === run.board ? resumed.sketch.strokes : undefined} onStrokes={onStrokes} />
      {phase === 'drawing' ? (
        <>
          <Ledge ink={ink} size={size} erase={erase} onInk={(i) => (setInk(i), setErase(false))} onSize={() => setSize(size ? 0 : 1)} onErase={() => setErase(!erase)} onUndo={() => board.current?.undo()} onClear={() => board.current?.clear()} />
          <View style={s.row}>
            <ChalkBtn ghost label={tr('Finish')} onPress={() => dispatch({ type: 'FINISH' })} style={{ flex: 1 }} />
            <ChalkBtn label={tr('I\'m done')} onPress={() => dispatch({ type: 'REVEAL', now: Date.now() })} style={{ flex: 2 }} />
          </View>
        </>
      ) : (
        <View style={s.row}>
          <ChalkBtn ghost label={priced(tr('Retry'), custom ? 0 : shownCost(play.game, 'solo', play.settings))} onPress={() => void again('RETRY')} small style={{ flex: 1.2, paddingHorizontal: u(8) }} />
          <ChalkBtn ghost label={tr('Finish')} onPress={() => dispatch({ type: 'FINISH' })} small style={{ flex: 0.9, paddingHorizontal: u(6) }} />
          <ChalkBtn label={priced(tr('Next'), custom ? 0 : shownCost(play.game, 'solo', play.settings))} onPress={() => void again('NEXT')} small style={{ flex: 1.2, paddingHorizontal: u(8) }} />
        </View>
      )}
      <PauseMenu open={paused} mode="solo" onResume={() => dispatch({ type: 'RESUME', now: Date.now() })} onQuit={onQuit} />
    </SlateScreen>
  );
}

const s = StyleSheet.create({
  word: { alignItems: 'center', paddingVertical: u(8) },
  wordT: { fontFamily: SL.head, fontSize: u(21), lineHeight: u(25), textAlign: 'center' },
  field: { fontFamily: SL.body, fontSize: u(13) },
  row: { flexDirection: 'row', gap: u(8), flexWrap: 'wrap' },
});
