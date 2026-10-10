import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { engine } from '../engine';
import { usePauseHide } from '../engine/usePauseHide';
import { recordItem } from '../shell/flow';
import { PauseMenu } from '../shell/PauseMenu';
import type { PlayProps } from '../shell/types';
import { Btn, GameScreen, Ghost } from '../shell/ui';
import {
  bumpStreak, dailyWord, dayNumber, HINT_COSTS, lengthCheck, liveStreak, MAX_ROWS, pickHint, score, shareText,
  type Streak, type Style,
} from './core';
import { isWord, poolFor, wordById } from './data';
import { SlideStack, SlideTable } from './Slides';
import { showDefinition, snapshotSolo, startSolo, stepSolo, type SoloEvent, type SoloRun } from './solo';

const streakKey = (style: Style) => `medicordle:streak:${style}`;
const dailyKey = (style: Style, day: number) => `medicordle:daily:${style}:${day}`;
const STYLE_NAME: Record<Style, string> = { classic: 'Classic', custom: 'Custom' };

/** What a finished daily word keeps, so the day can't be replayed and the share card still works. */
type DailyDone = { wordId: string; guesses: string[]; solved: boolean };

/** Solo: today's word or an endless queue, on the Specimen slides board. */
export function SoloPlay({ play, onFinish, onQuit }: PlayProps) {
  const t = useTheme();
  const style = (play.settings.style as Style) ?? 'classic';
  const kind = play.settings.word === 'endless' ? 'endless' : 'daily';
  const [run, setRun] = useState<SoloRun | null>(null);
  const runRef = useRef<SoloRun | null>(null);
  const [done, setDone] = useState<DailyDone | null>(null);
  const [streak, setStreak] = useState<Streak>({ current: 0, best: 0, lastDay: null });
  const [notice, setNotice] = useState<string | null>(null);
  const today = dayNumber(new Date());

  // Start: resume the bookmark, or today's word, or an endless queue (unseen first, rule 15).
  useEffect(() => {
    let live = true;
    (async () => {
      const st = (await engine.kv.get<Streak>(streakKey(style))) ?? { current: 0, best: 0, lastDay: null };
      let r = play.resume as SoloRun | null;
      if (!r && kind === 'daily') {
        const prev = await engine.kv.get<DailyDone>(dailyKey(style, today));
        if (prev) {
          // NM6: one daily word per style; today's is already played.
          await engine.recorder.discard(play.id);
          if (live) (setStreak(st), setDone(prev));
          return;
        }
        r = startSolo('daily', style, [dailyWord(poolFor(style), style, today).id], today, Date.now());
      }
      if (!r) {
        const pool = poolFor(style).map((w) => w.id);
        r = startSolo('endless', style, await engine.picker.pick(play.game, pool, pool.length), null, Date.now());
      }
      if (live) {
        runRef.current = r;
        setStreak(st);
        setRun(r);
      }
    })();
    return () => {
      live = false;
    };
  }, [play, style, kind, today]);

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
        engine.picker.markSeen(play.game, r.wordId);
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
          gameData: { style, kind, guesses: r.guesses.length, exp: r.exp, day: next.day },
        });
        if (next.kind === 'daily' && next.day != null) {
          const day = next.day;
          engine.kv.set(dailyKey(style, day), { wordId: r.wordId, guesses: r.guesses, solved: r.solved } satisfies DailyDone);
          engine.kv.get<Streak>(streakKey(style)).then((old) => {
            const s = bumpStreak(old ?? { current: 0, best: 0, lastDay: null }, day, r.solved);
            engine.kv.set(streakKey(style), s);
            setStreak(s);
          });
        }
      }
      if (next.phase === 'done' && prev.phase !== 'done') onFinish(next.score);
    },
    [play, style, onFinish],
  );

  usePauseHide(() => dispatch({ type: 'PAUSE', now: Date.now() }));

  /** NM23: up to two hints per Custom word, 1 then 2 tokens; refunded if the word ended first (rule 18). */
  const hint = useCallback(async () => {
    const r = runRef.current;
    if (!r || r.style !== 'custom' || r.phase !== 'playing' || r.hints >= HINT_COSTS.length) return;
    const answer = wordById.get(r.wordIds[r.index])!.word;
    const pick = pickHint(answer, r.guesses, r.revealed);
    if (!pick) return setNotice('Every letter is already showing.');
    const cost = HINT_COSTS[r.hints];
    const index = r.index;
    const receipt = await engine.wallet.spend(cost, 'medicordle_hint', play.id);
    if (!receipt) return setNotice(`You need ${cost} token${cost > 1 ? 's' : ''}. 200 EXP makes 1 token.`);
    const cur = runRef.current;
    if (!cur || cur.index !== index || cur.phase !== 'playing') {
      await engine.wallet.refund(receipt);
      return setNotice('Hint refunded.');
    }
    dispatch({ type: 'HINT_GRANTED', columns: pick.columns });
    setNotice(`Letter ${pick.letter} revealed.`);
  }, [dispatch, play.id]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2200);
    return () => clearTimeout(id);
  }, [notice]);

  const share = async (title: string, guesses: string[], answer: string, solved: boolean) => {
    const text = shareText(title, guesses.map((g) => score(g, answer)), solved);
    try {
      if (Platform.OS === 'web') {
        const nav = (globalThis as { navigator?: Navigator }).navigator;
        if (nav?.share) await nav.share({ text });
        else {
          await nav?.clipboard?.writeText(text);
          setNotice('Result copied.');
        }
      } else await Share.share({ message: text });
    } catch {
      setNotice('Sharing is not available here.');
    }
  };

  const no = (day: number | null) => (day != null ? `NO. ${day + 1}` : 'ENDLESS');
  const titleFor = (day: number) => `Nova Medicordle No. ${day + 1} · ${STYLE_NAME[style]}`;

  // Today's word is already done: show it with the share card.
  if (done) {
    const w = wordById.get(done.wordId)!;
    return (
      <SlideTable
        label={{ no: no(today), title: 'Medicordle', sub: `Daily ${STYLE_NAME[style]} · played today`, right: <SlideStack n={liveStreak(streak, today)} /> }}
        answer={w.word}
        played={done.guesses.map((word) => ({ word }))}
        rows={MAX_ROWS}
        rowSeq={0}
        definition={w.definition}
        live={false}
        onSubmit={() => null}
        maxLen={w.word.length}
        minLen={w.word.length}
        onPause={onQuit}
        notice={notice}
        dock={
          <DoneCard
            line={done.solved ? `Solved on guess ${done.guesses.length}` : `The word was ${w.word}`}
            sub="A new daily word comes tomorrow."
            primary={{ label: 'Share', onPress: () => share(titleFor(today), done.guesses, w.word, done.solved) }}
            secondary={{ label: 'Back', onPress: onQuit }}
          />
        }
      />
    );
  }
  if (!run) return <GameScreen scroll={false}>{null}</GameScreen>;

  const w = wordById.get(run.wordIds[run.index])!;
  const paused = run.phase === 'paused';
  const over = run.phase === 'wordOver' || (paused && run.before === 'wordOver');
  const r = over ? run.results[run.results.length - 1] : null;
  const custom = style === 'custom';
  const sub = run.kind === 'daily' ? `Daily ${STYLE_NAME[style]} · ${w.word.length} letters` : `${STYLE_NAME[style]} · word ${run.index + 1} · ${w.word.length} letters`;

  const submit = (g: string) => {
    const bad = lengthCheck(g, style, w.word.length);
    if (bad === 'short') return custom ? 'At least 7 letters' : 'Not enough letters';
    if (bad === 'long') return 'Too many letters';
    if (!isWord(g)) return 'Not in word list';
    dispatch({ type: 'GUESS', word: g, answer: w.word, now: Date.now() });
    return null;
  };

  return (
    <SlideTable
      label={{ no: no(run.day), title: 'Medicordle', sub, right: run.kind === 'daily' ? <SlideStack n={liveStreak(streak, today)} /> : <Text style={[s.score, { color: t.accent }]}>{`${run.score} EXP`}</Text> }}
      answer={w.word}
      played={run.guesses.map((word) => ({ word }))}
      rows={MAX_ROWS}
      revealed={run.revealed}
      rowSeq={run.rowSeq}
      definition={showDefinition(run) ? w.definition : null}
      live={run.phase === 'playing'}
      onSubmit={submit}
      maxLen={w.word.length}
      minLen={custom ? 7 : 6}
      hint={
        custom && !over && run.hints < HINT_COSTS.length
          ? { label: `Letter hint · ${HINT_COSTS[run.hints]} token${HINT_COSTS[run.hints] > 1 ? 's' : ''}`, onPress: hint, disabled: paused }
          : undefined
      }
      onPause={() => dispatch({ type: 'PAUSE', now: Date.now() })}
      notice={notice}
      hidden={paused && run.before === 'playing'}
      dock={
        r ? (
          <DoneCard
            line={r.solved ? `Solved on guess ${r.guesses.length}` : `The word was ${w.word}`}
            sub={r.exp ? `+${r.exp} EXP${run.kind === 'daily' ? ' · daily words earn double' : ''}` : 'No EXP this time.'}
            primary={
              run.kind === 'daily'
                ? { label: 'See results', onPress: () => dispatch({ type: 'NEXT', now: Date.now() }) }
                : { label: run.index + 1 >= run.wordIds.length ? 'See results' : 'Next word', onPress: () => dispatch({ type: 'NEXT', now: Date.now() }) }
            }
            secondary={
              run.kind === 'daily'
                ? { label: 'Share', onPress: () => share(titleFor(run.day ?? today), r.guesses, w.word, r.solved) }
                : { label: 'Finish', onPress: () => dispatch({ type: 'FINISH' }) }
            }
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
