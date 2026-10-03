import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F, type Theme } from '@/theme/tokens';

import { PauseMenu } from '../shell/PauseMenu';
import type { PlayProps } from '../shell/types';
import { Btn, GameScreen, Kick, RoundBtn } from '../shell/ui';
import { DP, cluePoints, search, type DPCase, type GuessEntry } from './core';
import { INDEX, guessById } from './data';
import { elapsed, type CaseResult, type SoloRun } from './solo';
import { useSoloRun } from './useSoloRun';

// Case screen v2 (DP10-DP13): old clue-card style in MedNova colours, Focus mode while typing.

/** Clue edge colours in order, as in the old screen: blue, amber, purple, cyan, pink, green. */
const CLUE = ['#007AFF', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#10b981'];
const CLUE_NUM_DARK = ['#3b9bff', '#f59e0b', '#b77cf8', '#22d3ee', '#f472b6', '#34d399'];
const CLUE_NUM_LIGHT = ['#0062cc', '#b45309', '#7c3aed', '#0e7490', '#be185d', '#047857'];
const DIFF_COLOR: Record<string, [string, string]> = {
  Easy: ['#34d399', '#047857'],
  Medium: ['#f59e0b', '#b45309'],
  Hard: ['#fb7185', '#be123c'],
  Extreme: ['#c084fc', '#7e22ce'],
};

const clock = (ms: number) => {
  const sec = Math.floor(ms / 1000);
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
};
const amber = (t: Theme) => (t.mode === 'light' ? '#b45309' : '#f59e0b');
const alpha = (hex: string, a: number) => hex + Math.round(a * 255).toString(16).padStart(2, '0');

export function SoloPlay({ play, onFinish, onQuit }: PlayProps) {
  const t = useTheme();
  const { run, current, dispatch, hint, notice, clearNotice } = useSoloRun({ play, onFinish });
  const [now, setNow] = useState(Date.now());
  const [focus, setFocus] = useState(false);
  const scroller = useRef<ScrollView>(null);

  // Clock tick while a case is running.
  useEffect(() => {
    if (run?.phase !== 'playing') return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [run?.phase]);

  // Focus mode ends when the keyboard closes (DP13).
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidHide', () => setFocus(false));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(clearNotice, 3200);
    return () => clearTimeout(id);
  }, [notice, clearNotice]);

  // Keep the newest clue or the result card in view.
  const closed = run?.results.length ?? 0;
  useEffect(() => {
    const id = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [run?.clueSeq, closed, run?.index]);

  if (!run || !current) return <GameScreen scroll={false}>{null}</GameScreen>;

  const ms = elapsed(run, now);
  const paused = run.phase === 'paused';
  const over = run.phase === 'caseOver' || (paused && run.before === 'caseOver');
  const result = over ? run.results[run.results.length - 1] : null;
  const focused = focus && run.phase === 'playing';
  const shown = current.clues.slice(0, run.attempt.cluesShown);

  return (
    <GameScreen scroll={false}>
      <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        {focused ? (
          <SlimBar run={run} ms={ms} />
        ) : (
          <TopBar run={run} c={current} ms={ms} over={over} onPause={() => dispatch({ type: 'PAUSE', now: Date.now() })} />
        )}

        {paused ? (
          <View style={[s.hidden, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
            <Kick>Case hidden</Kick>
            <Text style={[s.hiddenT, { color: t.mute }]}>The clock is stopped. Resume to see the case again.</Text>
          </View>
        ) : focused ? (
          <View style={s.pinned}>
            <Kick color={t.accent}>Newest clue</Kick>
            <Clue i={shown.length - 1} text={shown[shown.length - 1]} />
          </View>
        ) : (
          <ScrollView ref={scroller} style={s.fill} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {run.hint ? <FieldHint c={current} /> : null}
            <View style={s.clues}>
              {shown.map((txt, i) => (
                <Animated.View key={`${run.index}-${i}`} entering={i === 0 ? FadeIn.duration(200) : FadeInDown.duration(260)}>
                  <Clue i={i} text={txt} />
                </Animated.View>
              ))}
            </View>
            {run.attempt.wrong.length ? <Differential wrong={run.attempt.wrong} /> : null}
            {result ? <ResultCard r={result} c={current} last={run.index + 1 >= run.caseIds.length} onNext={() => dispatch({ type: 'NEXT', now: Date.now() })} /> : null}
          </ScrollView>
        )}

        {notice ? (
          <Animated.Text entering={FadeIn} style={[s.notice, { color: t.soft, backgroundColor: t.panel, borderColor: t.panelLine }]}>
            {notice}
          </Animated.Text>
        ) : null}

        {run.phase === 'playing' ? (
          <View style={[s.bottom, focused && s.bottomFocus]}>
            {focused ? null : (
              <Actions
                canReveal={run.attempt.cluesShown < DP.clueCount}
                hintUsed={run.hint}
                onSkip={() => dispatch({ type: 'SKIP', now: Date.now() })}
                onReveal={() => dispatch({ type: 'REVEAL' })}
                onHint={hint}
              />
            )}
            <AnswerBox
              key={run.index}
              c={current}
              wrong={run.attempt.wrong}
              wrongSeq={run.wrongSeq}
              focused={focused}
              onFocus={() => setFocus(true)}
              onBlur={() => Platform.OS === 'web' && setFocus(false)}
              onGuess={(g) => dispatch({ type: 'GUESS', answerId: g.id, accepted: g.id === current.answer_id, now: Date.now() })}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <PauseMenu open={paused} mode="solo" onResume={() => dispatch({ type: 'RESUME', now: Date.now() })} onQuit={onQuit} />
    </GameScreen>
  );
}

function TopBar({ run, c, ms, over, onPause }: { run: SoloRun; c: DPCase; ms: number; over: boolean; onPause: () => void }) {
  const t = useTheme();
  const lt = t.mode === 'light';
  const dc = DIFF_COLOR[c.difficulty] ?? DIFF_COLOR.Medium;
  const col = lt ? dc[1] : dc[0];
  const worth = over ? run.results[run.results.length - 1]?.points ?? 0 : cluePoints(run.attempt.cluesShown);
  return (
    <View style={s.top}>
      <View style={s.caseRow}>
        <Text style={[s.ct, { color: t.white }]}>
          Case {run.index + 1} <Text style={[s.of, { color: t.mute }]}>of {run.caseIds.length}</Text>
        </Text>
        <Text style={[s.diff, { color: col, borderColor: alpha(dc[0], 0.55), backgroundColor: alpha(dc[0], 0.12) }]}>{c.difficulty}</Text>
        <RoundBtn label="Pause" glyph="❚❚" onPress={onPause} />
      </View>
      <View style={[s.stats, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
        <Stat label="Clock" value={clock(ms)} color={amber(t)} />
        <Stat label={over ? 'Scored' : 'Worth now'} value={String(worth)} />
        <Stat label="Clues" value={`${run.attempt.cluesShown} / ${DP.clueCount}`} />
      </View>
      <View style={[s.prog, { backgroundColor: t.chipLine }]}>
        <LinearGradient
          colors={['#10b981', '#06b6d4', '#007AFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ height: '100%', width: `${(run.attempt.cluesShown / DP.clueCount) * 100}%` }}
        />
      </View>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  const t = useTheme();
  return (
    <View style={s.st}>
      <Text style={[s.sl, { color: t.mute }]}>{label}</Text>
      <Text style={[s.sv, { color: color ?? t.accent }]}>{value}</Text>
    </View>
  );
}

/** Focus mode top: one slim line (DP13). */
function SlimBar({ run, ms }: { run: SoloRun; ms: number }) {
  const t = useTheme();
  const dot = <Text style={{ color: t.dim }}> · </Text>;
  return (
    <View style={[s.slim, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
      <Text style={[s.slimT, { color: t.soft }]}>
        Case {run.index + 1} of {run.caseIds.length}
        {dot}
        <Text style={{ color: amber(t) }}>{clock(ms)}</Text>
        {dot}
        {cluePoints(run.attempt.cluesShown)} pts{dot}
        {run.attempt.cluesShown} / {DP.clueCount}
      </Text>
    </View>
  );
}

/** A numbered clue card with a coloured left edge (DP10: number only). */
function Clue({ i, text }: { i: number; text: string }) {
  const t = useTheme();
  const nums = t.mode === 'light' ? CLUE_NUM_LIGHT : CLUE_NUM_DARK;
  return (
    <View style={[s.cl, { borderLeftColor: CLUE[i], backgroundColor: alpha(CLUE[i], t.mode === 'light' ? 0.09 : 0.12) }]}>
      <Text style={[s.cn, { color: nums[i] }]}>{i + 1}</Text>
      <Text style={[s.clT, { color: t.fg }]}>{text}</Text>
    </View>
  );
}

/** Paid hint: every listed medical field (DP7). */
function FieldHint({ c }: { c: DPCase }) {
  const t = useTheme();
  const purple = t.mode === 'light' ? '#7c3aed' : '#d8b4fe';
  return (
    <Animated.View entering={FadeIn} style={[s.hint, { borderColor: alpha('#a78bfa', 0.4), backgroundColor: alpha('#6d28d9', t.mode === 'light' ? 0.08 : 0.16) }]}>
      <Text style={[s.hintK, { color: purple }]}>💡 Hint · Medical field</Text>
      <Text style={[s.hintT, { color: t.fg }]}>{c.fields.join(' · ')}</Text>
    </Animated.View>
  );
}

/** Wrong guesses as a crossed-out differential (DP12). */
function Differential({ wrong }: { wrong: string[] }) {
  const t = useTheme();
  return (
    <View style={s.ddx}>
      <Kick>
        Differential · {wrong.length} of {DP.maxGuesses} used
      </Kick>
      <View style={s.chips}>
        {wrong.map((id) => (
          <Text key={id} style={[s.chip, { color: t.mute, borderColor: t.chipLine }]}>
            {guessById.get(id)?.label ?? id}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Skip, Reveal a Clue and Hint in one row, old-screen colours. */
function Actions({ canReveal, hintUsed, onSkip, onReveal, onHint }: { canReveal: boolean; hintUsed: boolean; onSkip: () => void; onReveal: () => void; onHint: () => void }) {
  const t = useTheme();
  const lt = t.mode === 'light';
  const B = ({ label, flex, bg, line, fg, onPress, disabled }: { label: string; flex: number; bg: string; line: string; fg: string; onPress: () => void; disabled?: boolean }) => (
    <Pressable onPress={onPress} disabled={disabled} style={[s.b3, { flex, backgroundColor: bg, borderColor: line, opacity: disabled ? 0.45 : 1 }]} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[s.b3T, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View style={s.row3}>
      <B label="⏭ Skip" flex={0.8} onPress={onSkip} bg={lt ? 'rgba(239,68,68,0.1)' : 'rgba(127,29,29,0.24)'} line="rgba(248,113,113,0.42)" fg={lt ? '#c2364a' : '#fda4af'} />
      <B label="🔍 Reveal a Clue" flex={1.3} onPress={onReveal} disabled={!canReveal} bg={lt ? 'rgba(6,182,212,0.1)' : 'rgba(14,116,144,0.15)'} line="rgba(34,211,238,0.35)" fg={lt ? '#0e7490' : '#67e8f9'} />
      <B label={hintUsed ? '💡 Hint used' : '💡 Hint'} flex={1} onPress={onHint} disabled={hintUsed} bg={lt ? 'rgba(168,85,247,0.1)' : 'rgba(109,40,217,0.16)'} line="rgba(167,139,250,0.34)" fg={lt ? '#7c3aed' : '#d8b4fe'} />
    </View>
  );
}

/** Type-ahead answer box: 2+ letters, up to 5 suggestions above the field, Submit takes a picked suggestion. */
function AnswerBox({ c, wrong, wrongSeq, focused, onFocus, onBlur, onGuess }: { c: DPCase; wrong: string[]; wrongSeq: number; focused: boolean; onFocus: () => void; onBlur: () => void; onGuess: (g: GuessEntry) => void }) {
  const t = useTheme();
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<GuessEntry | null>(null);
  const sugs = useMemo(() => (picked ? [] : search(INDEX, text).filter((g) => !wrong.includes(g.id))), [text, picked, wrong]);
  const exact = sugs.find((g) => g.label.toLowerCase() === text.trim().toLowerCase()) ?? null;
  const choice = picked ?? exact;

  // Shake and clear on a wrong guess.
  const x = useSharedValue(0);
  const seen = useRef(wrongSeq);
  useEffect(() => {
    if (wrongSeq === seen.current) return;
    seen.current = wrongSeq;
    x.value = withSequence(withTiming(-7, { duration: 50 }), withTiming(7, { duration: 70 }), withTiming(-4, { duration: 60 }), withTiming(0, { duration: 50 }));
    setText('');
    setPicked(null);
  }, [wrongSeq, x]);
  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const submit = () => {
    if (!choice) return;
    onGuess(choice);
  };
  const q = text.trim().toLowerCase();

  return (
    <View>
      {sugs.length ? (
        <View style={[s.sugs, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
          {sugs.map((g, i) => {
            const hit = g.label.toLowerCase().startsWith(q) ? text.trim().length : 0;
            return (
              <Pressable
                key={g.id}
                onPress={() => {
                  setPicked(g);
                  setText(g.label);
                }}
                style={[s.sg, i === 0 && { backgroundColor: t.tabOn }]}
                accessibilityRole="button"
                accessibilityLabel={g.label}>
                <Text style={[s.sgT, { color: t.soft }]} numberOfLines={1}>
                  <Text style={{ color: t.white, fontFamily: F.bodyBold }}>{g.label.slice(0, hit)}</Text>
                  {g.label.slice(hit)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <Animated.View
        style={[
          s.in2,
          { backgroundColor: t.panel, borderColor: focused ? t.accent : t.panelLine },
          sugs.length ? s.in2Open : null,
          shake,
        ]}>
        <Text style={[s.ic, { color: t.mute }]}>⌕</Text>
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            setPicked(null);
          }}
          onFocus={onFocus}
          onBlur={onBlur}
          onSubmitEditing={submit}
          placeholder="Type a diagnosis…"
          placeholderTextColor={t.dim}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="done"
          style={[s.input, { color: t.fg }]}
          accessibilityLabel="Your diagnosis"
        />
        <Pressable onPress={submit} disabled={!choice} style={{ opacity: choice ? 1 : 0.5 }} accessibilityRole="button" accessibilityLabel="Submit">
          <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.sub}>
            <Text style={[s.subT, { color: t.onGrad }]}>Submit</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** Shown when a case closes: answer, fields, how the points were made, then Next case. */
function ResultCard({ r, c, last, onNext }: { r: CaseResult; c: DPCase; last: boolean; onNext: () => void }) {
  const t = useTheme();
  const lt = t.mode === 'light';
  const tone = r.outcome === 'right' ? (lt ? '#047857' : '#34d399') : r.outcome === 'wrong' ? t.rose : amber(t);
  const word = r.outcome === 'right' ? 'Solved' : r.outcome === 'wrong' ? 'Missed' : 'Skipped';
  const line =
    r.outcome === 'right'
      ? `${r.points} points: ${r.cluePoints} for ${r.cluesShown} ${r.cluesShown === 1 ? 'clue' : 'clues'} + ${r.speedBonus} speed, in ${clock(r.timeMs)}`
      : 'No points this time. This case goes to your Learn review.';
  return (
    <Animated.View entering={FadeInDown.duration(280)} style={[s.res, { backgroundColor: t.panel, borderColor: alpha(tone, 0.6) }]}>
      <Kick color={tone}>{word}</Kick>
      <Text style={[s.resD, { color: t.white }]}>{c.disease}</Text>
      <Text style={[s.resF, { color: t.mute }]}>{c.fields.join(' · ')}</Text>
      <Text style={[s.resL, { color: t.soft }]}>{line}</Text>
      <Btn label={last ? 'See results' : 'Next case'} onPress={onNext} style={{ marginTop: u(4) }} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  top: { gap: u(9), marginBottom: u(9) },
  caseRow: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  ct: { fontFamily: F.display, fontSize: u(21), lineHeight: u(24) },
  of: { fontFamily: F.bodyMedium, fontSize: u(12) },
  diff: { marginLeft: 'auto', fontFamily: F.bodyBold, fontSize: u(8.5), letterSpacing: u(0.8), textTransform: 'uppercase', borderWidth: 1, borderRadius: u(6), paddingVertical: u(4), paddingHorizontal: u(7), overflow: 'hidden' },
  stats: { flexDirection: 'row', borderWidth: 1, borderRadius: u(12), paddingVertical: u(9), paddingHorizontal: u(11), gap: u(8) },
  st: { flex: 1, gap: u(2) },
  sl: { fontFamily: F.bodyBold, fontSize: u(7.5), lineHeight: u(10), letterSpacing: u(0.6), textTransform: 'uppercase' },
  sv: { fontFamily: F.bodyBold, fontSize: u(15), lineHeight: u(18), fontVariant: ['tabular-nums'] },
  prog: { height: u(4), borderRadius: u(4), overflow: 'hidden' },
  scroll: { gap: u(9), paddingBottom: u(10) },
  clues: { gap: u(7) },
  cl: { flexDirection: 'row', gap: u(9), paddingVertical: u(8), paddingLeft: u(10), paddingRight: u(11), borderLeftWidth: u(3), borderRadius: u(7) },
  cn: { fontFamily: F.bodyBold, fontSize: u(9), lineHeight: u(16), minWidth: u(8) },
  clT: { flex: 1, fontFamily: F.body, fontSize: u(11), lineHeight: u(16) },
  hint: { borderWidth: 1, borderRadius: u(10), paddingVertical: u(7), paddingHorizontal: u(10), gap: u(2) },
  hintK: { fontFamily: F.bodyBold, fontSize: u(8.5), letterSpacing: u(0.5), textTransform: 'uppercase' },
  hintT: { fontFamily: F.bodySemi, fontSize: u(11.5) },
  ddx: { gap: u(6) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: u(5) },
  chip: { fontFamily: F.bodyMedium, fontSize: u(10), borderWidth: 1, borderStyle: 'dashed', borderRadius: u(8), paddingVertical: u(4), paddingHorizontal: u(8), textDecorationLine: 'line-through' },
  bottom: { gap: u(9), paddingTop: u(6) },
  bottomFocus: { marginTop: 'auto' },
  row3: { flexDirection: 'row', gap: u(5) },
  b3: { borderWidth: 1, borderRadius: u(10), paddingVertical: u(9), paddingHorizontal: u(3), alignItems: 'center' },
  b3T: { fontFamily: F.bodyBold, fontSize: u(9.5), lineHeight: u(12) },
  sugs: { borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: u(12), borderTopRightRadius: u(12), padding: u(4) },
  sg: { borderRadius: u(8), paddingVertical: u(8), paddingHorizontal: u(9) },
  sgT: { fontFamily: F.body, fontSize: u(11.5) },
  in2: { flexDirection: 'row', alignItems: 'center', gap: u(7), borderWidth: 1, borderRadius: u(12), paddingVertical: u(5), paddingRight: u(5), paddingLeft: u(10) },
  in2Open: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  ic: { fontFamily: F.bodyBold, fontSize: u(13) },
  input: { flex: 1, minWidth: 0, fontFamily: F.body, fontSize: u(12), paddingVertical: u(6), ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
  sub: { borderRadius: u(9), paddingVertical: u(9), paddingHorizontal: u(13) },
  subT: { fontFamily: F.bodyBold, fontSize: u(11) },
  slim: { borderWidth: 1, borderRadius: u(10), paddingVertical: u(7), paddingHorizontal: u(10), marginBottom: u(9) },
  slimT: { fontFamily: F.bodyBold, fontSize: u(9.5), fontVariant: ['tabular-nums'] },
  pinned: { gap: u(5) },
  hidden: { flex: 1, borderWidth: 1, borderRadius: u(14), alignItems: 'center', justifyContent: 'center', gap: u(6), padding: u(20) },
  hiddenT: { fontFamily: F.body, fontSize: u(11.5), textAlign: 'center' },
  notice: { fontFamily: F.bodyMedium, fontSize: u(10.5), lineHeight: u(15), borderWidth: 1, borderRadius: u(10), paddingVertical: u(7), paddingHorizontal: u(10), marginTop: u(6), overflow: 'hidden' },
  res: { borderWidth: 1, borderRadius: u(14), padding: u(13), gap: u(4) },
  resD: { fontFamily: F.display, fontSize: u(20), lineHeight: u(23) },
  resF: { fontFamily: F.bodyMedium, fontSize: u(10.5) },
  resL: { fontFamily: F.body, fontSize: u(11.5), lineHeight: u(16), marginTop: u(2) },
});
