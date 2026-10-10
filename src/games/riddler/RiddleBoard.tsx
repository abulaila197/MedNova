import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Text, TextInput } from '@/components/AppText';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { KeyboardLift } from '../shell/KeyboardLift';
import { GameScreen, Kick, RoundBtn } from '../shell/ui';
import { clock } from '@/games/engine/clock';
import { RD, search, type Riddle } from './core';
import { fullName } from '../shell/names';
import { ANSWERS, answerLabel, imageOf } from './data';

// The Riddler's own design language (RD14): "Pinboard".
// The rebus picture is a taped, slightly tilted instant print on a soft board, sized to the picture's own
// shape so nothing is ever cropped. Under it sit the lives lamps and a mono stopwatch (from the Lightbox
// look). Each wrong guess is pinned below as a crossed-out sticky note. Tapping a suggestion answers.

export const PRINT = { pad: u(8), capH: u(26), boardPadX: u(12), boardPadY: u(14) };
const STICKY = { bg: '#fff3b8', fg: '#5b4a12', cross: '#d04a4a' };

/** A steady small tilt per picture, between -2.4 and 2.4 degrees. */
export function tiltOf(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997;
  return ((h % 49) - 24) / 10;
}

/** Fits a w x h picture inside a box without cropping. */
export function fitPicture(w: number, h: number, maxW: number, maxH: number) {
  const k = Math.max(0, Math.min(maxW / w, maxH / h));
  return { width: Math.floor(w * k), height: Math.floor(h * k) };
}

export type BoardProps = {
  riddle: Riddle;
  /** A new value empties the answer box (a new player's turn or a new picture). */
  turnKey?: string;
  /** Small line above the title: "Level 13 of 86", "Picture 2 of 5". */
  kicker: string;
  title: { text: string; color?: string };
  clockMs: number;
  /** Turn clocks count down and warn under 10 s; the Solo stopwatch counts up. */
  countdown?: boolean;
  /** Solo: lives left of 3. Offline has no lives (unlimited guesses), so null. */
  lives: number | null;
  /** Offline: ms of the 5 s lock left after a wrong guess. */
  lockMs?: number;
  wrong: string[];
  wrongSeq: number;
  onGuess: (answerId: string) => void;
  onPause: () => void;
  /** Solo only: the paid hint shows the definition. */
  hint?: { used: boolean; onHint: () => void };
  hidden?: boolean;
  notice?: string | null;
  /** Replaces the answer box: result card, turn over. */
  dock?: ReactNode;
  children?: ReactNode;
};

export function RiddleBoard(p: BoardProps) {
  const t = useTheme();
  const lt = t.mode === 'light';
  const bad = lt ? '#d4504c' : '#ff5c6c';
  const [stage, setStage] = useState<{ w: number; h: number } | null>(null);
  const onStage = (e: LayoutChangeEvent) => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const barH = u(26);
  const pic = stage
    ? fitPicture(p.riddle.w, p.riddle.h, stage.w - 2 * PRINT.boardPadX - 2 * PRINT.pad - u(8), stage.h - barH - u(10) - 2 * PRINT.boardPadY - PRINT.pad - PRINT.capH - u(8))
    : null;
  const tilt = tiltOf(p.riddle.id);
  const prompt = `Identify the medical ${p.riddle.kind}`;
  const warn = p.countdown && p.clockMs <= 10_000;

  return (
    <GameScreen scroll={false}>
      <KeyboardLift style={s.fill}>
        <View style={s.top}>
          <View style={{ flex: 1 }}>
            <Kick>{p.kicker}</Kick>
            <Text style={[s.title, { color: p.title.color ?? t.white }]} numberOfLines={1}>{p.title.text}</Text>
          </View>
          <RoundBtn label="Pause" glyph="❚❚" onPress={p.onPause} />
        </View>

        <View style={s.stage} onLayout={onStage}>
          {pic ? (
            <View style={[s.board, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
              <View style={[s.print, { transform: [{ rotate: `${tilt}deg` }] }]}>
                <View style={s.tape} />
                {p.hidden ? (
                  <View style={[pic, s.cover]}>
                    <Text style={s.coverT}>Paused</Text>
                  </View>
                ) : (
                  <Image source={imageOf(p.riddle.id)} style={pic} contentFit="contain" accessibilityLabel={`Rebus picture, level ${p.riddle.id.slice(2)}`} />
                )}
                <Text style={s.cap} numberOfLines={1}>{prompt}</Text>
              </View>
            </View>
          ) : null}
          <View style={[s.bar, { height: barH }]}>
            {p.lives != null ? (
              <View style={s.lamps} accessibilityLabel={`${p.lives} of ${RD.lives} lives left`}>
                <Text style={[s.barK, { color: t.dim }]}>LIVES</Text>
                {Array.from({ length: RD.lives }, (_, i) => (
                  <View key={i} style={[s.lamp, i < p.lives! ? { backgroundColor: t.accent, shadowColor: t.accent } : { backgroundColor: lt ? '#d3ccbf' : '#2a3050', shadowOpacity: 0 }]} />
                ))}
              </View>
            ) : (
              <Text style={[s.barK, { color: p.lockMs ? bad : t.dim }]}>{p.lockMs ? `LOCKED ${Math.ceil(p.lockMs / 1000)} S` : 'UNLIMITED GUESSES'}</Text>
            )}
            <Text style={[s.clock, { color: warn ? bad : t.white }]} accessibilityLabel={p.countdown ? `${Math.ceil(p.clockMs / 1000)} seconds left` : `Time ${clock(p.clockMs)}`}>
              {clock(p.clockMs, { down: p.countdown })}
            </Text>
          </View>
        </View>

        {p.wrong.length ? (
          <View style={s.notes}>
            {p.wrong.map((id, i) => (
              <Animated.View key={id} entering={FadeIn.duration(200)} style={[s.sticky, { transform: [{ rotate: `${i % 2 ? -2 : 1.6}deg` }] }]}>
                <Text style={s.stickyT}>{answerLabel(id)}</Text>
              </Animated.View>
            ))}
          </View>
        ) : null}

        {p.hint && !p.dock ? (
          p.hint.used ? (
            <Animated.View entering={FadeInDown.duration(220)} style={[s.def, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
              <Kick color={t.accent}>Definition</Kick>
              <Text style={[s.defT, { color: t.soft }]}>{p.riddle.definition}</Text>
            </Animated.View>
          ) : (
            <Pressable onPress={p.hint.onHint} style={[s.hintB, { borderColor: t.chipLine, backgroundColor: t.chip }]} accessibilityRole="button" accessibilityLabel={`Show definition for ${RD.hintPrice} token`}>
              <Text style={[s.hintT, { color: t.fg }]}>
                Show definition <Text style={{ color: t.accent, fontFamily: F.bodyBold }}>{`${RD.hintPrice} token`}</Text>
              </Text>
            </Pressable>
          )
        ) : null}

        {p.notice ? <Text style={[s.notice, { color: t.mute }]}>{p.notice}</Text> : null}

        {p.dock ? (
          <Animated.View entering={FadeInDown.duration(260)}>{p.dock}</Animated.View>
        ) : (
          <AnswerBox key={`${p.riddle.id}:${p.turnKey ?? ''}`} wrong={p.wrong} wrongSeq={p.wrongSeq} locked={!!p.lockMs} disabled={!!p.hidden} onGuess={p.onGuess} />
        )}
      </KeyboardLift>
      {p.children}
    </GameScreen>
  );
}

/** As coded: 2+ letters, up to 5 suggestions above the field; tapping one answers. */
function AnswerBox({ wrong, wrongSeq, locked, disabled, onGuess }: { wrong: string[]; wrongSeq: number; locked: boolean; disabled: boolean; onGuess: (id: string) => void }) {
  const t = useTheme();
  const [text, setText] = useState('');
  const sugs = useMemo(() => search(ANSWERS, text, wrong), [text, wrong]);
  const q = text.trim().toLowerCase();

  const x = useSharedValue(0);
  const seen = useRef(wrongSeq);
  useEffect(() => {
    if (wrongSeq === seen.current) return;
    seen.current = wrongSeq;
    x.value = withSequence(withTiming(-7, { duration: 50 }), withTiming(7, { duration: 70 }), withTiming(-4, { duration: 60 }), withTiming(0, { duration: 50 }));
    setText('');
  }, [wrongSeq, x]);
  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const pick = (id: string) => {
    if (locked || disabled) return;
    onGuess(id);
  };
  const exact = sugs.find((a) => a.label.toLowerCase() === q);

  return (
    <View>
      {sugs.length && !locked ? (
        <View style={[s.sugs, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
          {sugs.map((a, i) => {
            const name = fullName(a);
            const hit = name.toLowerCase().startsWith(q) ? text.trim().length : 0;
            return (
              <Pressable key={a.id} onPress={() => pick(a.id)} style={[s.sg, i > 0 && { borderTopWidth: 1, borderTopColor: t.panelLine }]} accessibilityRole="button" accessibilityLabel={`Answer ${name}`}>
                <Text style={[s.sgT, { color: t.fg }]} numberOfLines={2}>
                  <Text style={{ color: t.accent, fontFamily: F.bodyBold }}>{name.slice(0, hit)}</Text>
                  {name.slice(hit)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <Animated.View style={[s.box, { backgroundColor: t.panel2, borderColor: locked ? t.panelLine : t.accent, opacity: locked ? 0.6 : 1 }, shake]}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => exact && pick(exact.id)}
          editable={!locked && !disabled}
          placeholder={locked ? 'Wait for the lock…' : 'Type 2+ letters, then tap your answer'}
          placeholderTextColor={t.dim}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="done"
          style={[s.input, { color: t.fg }]}
          accessibilityLabel="Your answer"
        />
        {text.trim().length >= RD.minQuery && !sugs.length ? <Text style={[s.ph, { color: t.dim }]}>No match</Text> : null}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, gap: u(9) },
  top: { flexDirection: 'row', alignItems: 'center', gap: u(10) },
  title: { fontFamily: F.display, fontSize: u(19), lineHeight: u(23) },
  stage: { flex: 1, minHeight: u(150), justifyContent: 'center', gap: u(10) },
  board: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderRadius: u(14), borderWidth: 1, paddingHorizontal: PRINT.boardPadX, paddingVertical: PRINT.boardPadY },
  print: {
    backgroundColor: '#fbfaf6', padding: PRINT.pad, paddingBottom: PRINT.capH, borderRadius: u(3),
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: u(11), shadowOffset: { width: 0, height: u(8) }, elevation: 6,
  },
  tape: { position: 'absolute', top: -u(9), alignSelf: 'center', width: u(62), height: u(18), backgroundColor: 'rgba(255,236,190,0.78)', transform: [{ rotate: '3deg' }], zIndex: 2 },
  cap: { position: 'absolute', left: u(11), right: u(11), bottom: u(6), fontFamily: F.displayItalic, fontSize: u(11.5), color: '#3a3f55' },
  cover: { backgroundColor: '#ece9e1', alignItems: 'center', justifyContent: 'center' },
  coverT: { fontFamily: F.displayItalic, fontSize: u(14), color: '#6b6a66' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: u(4) },
  lamps: { flexDirection: 'row', alignItems: 'center', gap: u(7) },
  barK: { fontFamily: F.bodyBold, fontSize: u(8), letterSpacing: u(1.3), marginRight: u(2) },
  lamp: { width: u(11), height: u(11), borderRadius: u(6), shadowOpacity: 0.9, shadowRadius: u(5), shadowOffset: { width: 0, height: 0 } },
  clock: { fontFamily: F.mono, fontSize: u(15), letterSpacing: u(0.6), fontVariant: ['tabular-nums'] },
  notes: { flexDirection: 'row', flexWrap: 'wrap', gap: u(7) },
  sticky: { backgroundColor: STICKY.bg, paddingVertical: u(5), paddingHorizontal: u(9), shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: u(4), shadowOffset: { width: 0, height: u(3) }, elevation: 3 },
  stickyT: { fontFamily: F.displayItalic, fontSize: u(11.5), color: STICKY.fg, textDecorationLine: 'line-through', textDecorationColor: STICKY.cross },
  hintB: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: u(999), paddingVertical: u(6), paddingHorizontal: u(11) },
  hintT: { fontFamily: F.bodySemi, fontSize: u(11) },
  def: { borderWidth: 1, borderRadius: u(12), padding: u(10), gap: u(3) },
  defT: { fontFamily: F.body, fontSize: u(11.5), lineHeight: u(16) },
  notice: { fontFamily: F.body, fontSize: u(11), textAlign: 'center' },
  sugs: { borderWidth: 1, borderRadius: u(12), overflow: 'hidden', marginBottom: u(6) },
  sg: { paddingVertical: u(10), paddingHorizontal: u(12) },
  sgT: { fontFamily: F.body, fontSize: u(12.5) },
  box: { flexDirection: 'row', alignItems: 'center', gap: u(8), borderWidth: 1.5, borderRadius: u(14), paddingHorizontal: u(12) },
  input: { flex: 1, fontFamily: F.body, fontSize: u(14), paddingVertical: u(11), ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
  ph: { fontFamily: F.body, fontSize: u(10) },
});
