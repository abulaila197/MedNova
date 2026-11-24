import { priced } from '@/components/CoinLabel';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { sparksCost } from '@/features/sparks/costs';
import { chargeUnit, needSparks, shownCost } from '@/features/sparks/sparks';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { engine } from '../engine';
import { pickFor } from '../shell/deal';
import { usePauseHide } from '../engine/usePauseHide';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import type { PlayProps } from '../shell/types';
import { Btn, GameScreen, Ghost } from '../shell/ui';
import { lengthCheck, minLen, MAX_ROWS, NO_HELP, wayOf, type Grant, type Style, type Way } from './core';
import { isWord, knowOf, poolFor, wordById } from './data';
import { SlideTable } from './Slides';
import { useHelpers } from './helpers';
import { definitionDue, showDefinition, snapshotSolo, startSolo, stepSolo, upgradeRun, type SoloEvent, type SoloRun } from './solo';
import { tr } from '@/i18n';

/** Read outside render (React Compiler lint): only called from the submit handler. */
const clockNow = () => Date.now();

const PAID_KEY = 'medicordle:endless:paid'; // NM30: Endless words that already paid EXP
const STYLE_NAME: Record<Style, string> = { classic: tr('Classic'), five: tr('Classic 5'), custom: tr('Custom') };

/** Solo: an endless queue of words, on the Specimen slides board (the Daily word was removed, Yazan 2026-11-24). */
export function SoloPlay({ play, onFinish, onQuit }: PlayProps) {
  const t = useTheme();
  const style: Style = (play.settings.style as Style) ?? 'classic';
  const way: Way = wayOf(play.settings);
  const styleName = way === 'surgeon' ? tr('Word Surgeon') : STYLE_NAME[style];
  const [run, setRun] = useState<SoloRun | null>(null);
  const runRef = useRef<SoloRun | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Start: resume the bookmark, or an endless queue (unseen first, rule 15).
  useEffect(() => {
    let live = true;
    (async () => {
      let r = play.resume ? upgradeRun(play.resume as SoloRun) : null;
      if (r && !r.wordIds.every((id) => wordById.has(id))) r = null; // a word left the list since: start fresh
      // A word of my own (My diseases): just that word, practice only, no EXP.
      const custom = typeof play.settings.custom === 'string' && wordById.has(play.settings.custom) ? play.settings.custom : null;
      if (!r && custom) r = startSolo(style, [custom], Date.now(), [custom]);
      if (!r) {
        const pool = poolFor(style, knowOf(play.settings)).map((w) => w.id);
        r = startSolo(style, await pickFor(play, pool, pool.length), Date.now(), (await engine.kv.get<string[]>(PAID_KEY)) ?? []);
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
    (e: SoloEvent) => {
      const prev = runRef.current;
      if (!prev) return;
      const next = stepSolo(prev, e);
      if (next === prev) return;
      runRef.current = next;
      setRun(next);
      engine.recorder.bookmark(play.id, snapshotSolo(next, Date.now()), next.score);
      if (next.results.length > prev.results.length) {
        const r = next.results[next.results.length - 1];
        const w = wordById.get(r.wordId)!;
        if (!play.settings.custom) engine.picker.markSeen(play.game, r.wordId);
        if (r.exp > 0) {
          engine.kv.get<string[]>(PAID_KEY).then((old) => engine.kv.set(PAID_KEY, [...new Set([...(old ?? []), r.wordId])]));
        }
        recordItem(play, {
          seat: 0,
          itemId: r.wordId,
          answerKey: w.dossier, // results link only (RS1); Medicordle never feeds Learn (NM1)
          outcome: r.solved ? 'right' : 'wrong',
          answersGiven: r.guesses.filter((g) => g !== w.word),
          timeMs: r.timeMs,
          hintsUsed: r.hints,
          revealsUsed: 0,
          points: r.exp,
          feedsLearn: false,
          gameData: { style, kind: 'endless', guesses: r.guesses.length, exp: r.exp },
        });
        // Each word costs 10 Sparks (#69), paid as it ends.
        void chargeUnit(play, `${play.id}:${r.wordId}`, sparksCost(play.game, 'solo', play.settings));
      }
      if (next.phase === 'done' && prev.phase !== 'done') onFinish(next.score);
    },
    [play, style, onFinish],
  );

  usePauseHide(() => dispatch({ type: 'PAUSE', now: Date.now() }));

  /** The next Endless word costs 10 Sparks: an empty bar opens Recharge first (#69). */
  const nextWord = useCallback(async () => {
    const r = runRef.current;
    const more = r && r.index + 1 < r.wordIds.length;
    if (more && !(await needSparks(sparksCost(play.game, 'solo', play.settings)))) return;
    dispatch({ type: 'NEXT', now: Date.now() });
  }, [dispatch, play]);

  // Paid helpers (Yazan 2026-11-17).
  const cur = run ? wordById.get(run.wordIds[run.index]) : undefined;
  const helpers = useHelpers({
    playId: play.id,
    answer: cur?.word ?? '',
    guesses: run?.guesses ?? [],
    help: run?.help ?? NO_HELP,
    defShown: !!run && definitionDue(run),
    open: run?.phase === 'playing',
    // Still the word it was bought on: same word, still being played, no guess played meanwhile.
    same: useCallback(() => {
      const r = runRef.current;
      return !!r && !!run && r.index === run.index && r.phase === 'playing' && r.guesses.length === run.guesses.length;
    }, [run]),
    grant: useCallback((g: Grant) => dispatch({ type: 'HELP', grant: g }), [dispatch]),
    surgeon: way === 'surgeon',
    notice: setNotice,
  });

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2200);
    return () => clearTimeout(id);
  }, [notice]);

  if (!run) return <GameScreen scroll={false}>{null}</GameScreen>;

  const w = wordById.get(run.wordIds[run.index])!;
  const paused = run.phase === 'paused';
  const over = run.phase === 'wordOver' || (paused && run.before === 'wordOver');
  const r = over ? run.results[run.results.length - 1] : null;
  const custom = style === 'custom';
  const sub = tr('{n} · word {n2} · {n3} letters', { n: styleName, n2: run.index + 1, n3: w.word.length });

  const submit = (g: string) => {
    // A Surgeon try is the word's own letters, always the full length: no list or length check.
    if (way === 'surgeon') {
      dispatch({ type: 'GUESS', word: g, answer: w.word, now: clockNow() });
      return null;
    }
    const bad = lengthCheck(g, style, w.word.length);
    if (bad === 'short') return custom ? tr('At least 7 letters') : tr('Not enough letters');
    if (bad === 'long') return tr('Too many letters');
    if (g !== w.word && !isWord(g)) return tr('Not in word list');
    dispatch({ type: 'GUESS', word: g, answer: w.word, now: clockNow() });
    return null;
  };

  return (
    <SlideTable
      label={{ no: 'ENDLESS', title: tr('Word Lab'), sub, right: <Text style={[s.score, { color: t.accent }]}>{tr('{score} EXP', { score: run.score })}</Text> }}
      answer={w.word}
      played={run.guesses.map((word) => ({ word }))}
      rows={MAX_ROWS}
      revealed={run.help.revealed}
      cleared={run.help.cleared}
      way={way}
      rowSeq={run.rowSeq}
      definition={showDefinition(run) ? w.definition : null}
      noteHot={run.phase === 'playing' || (run.phase === 'paused' && run.before === 'playing')}
      live={run.phase === 'playing'}
      onSubmit={submit}
      maxLen={w.word.length}
      minLen={minLen(style)}
      helpers={!over ? helpers : undefined}
      onPause={() => dispatch({ type: 'PAUSE', now: Date.now() })}
      notice={notice}
      hidden={paused && run.before === 'playing'}
      dock={
        r ? (
          <DoneCard
            line={r.solved ? tr('Solved on guess {n}', { n: r.guesses.length }) : tr('The word was {word}', { word: w.word })}
            sub={r.exp ? tr('+{exp} EXP', { exp: r.exp }) : r.solved ? tr('No EXP: this word already paid before.') : tr('No EXP this time.')}
            primary={{ label: run.index + 1 >= run.wordIds.length ? tr('See results') : priced(tr('Next word'), shownCost(play.game, 'solo', play.settings)), onPress: () => void nextWord() }}
            secondary={{ label: tr('Finish'), onPress: () => dispatch({ type: 'FINISH' }) }}
          />
        ) : undefined
      }>
      <PauseMenu open={paused} mode="solo" onResume={() => dispatch({ type: 'RESUME', now: Date.now() })} onQuit={onQuit} />
    </SlideTable>
  );
}

/** The word's end, docked where the keyboard was. */
export function DoneCard({ line, sub, primary, secondary }: { line: string; sub: string; primary: { label: string; onPress: () => void }; secondary?: { label: string; onPress: () => void } }) {
  const t = useTheme();
  return (
    <View style={s.card}>
      <Text style={[s.line, { color: t.white }]}>{line}</Text>
      <Text style={[s.sub, { color: t.mute }]}>{sub}</Text>
      <View style={s.btns}>
        {secondary ? <Ghost label={secondary.label} onPress={secondary.onPress} style={{ flex: 1 }} /> : null}
        <Btn label={primary.label} onPress={primary.onPress} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  score: { fontFamily: F.bodyBold, fontSize: u(10.5) },
  card: { gap: u(4), paddingTop: u(2) },
  line: { fontFamily: F.display, fontSize: u(18), lineHeight: u(22), textAlign: 'center' },
  sub: { fontFamily: F.body, fontSize: u(10.5), textAlign: 'center' },
  btns: { flexDirection: 'row', gap: u(8), marginTop: u(6) },
});
