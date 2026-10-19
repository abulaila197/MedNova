import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MAX_FONT_SCALE, Text } from '@/components/AppText';
import Animated, {
  FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { Face } from '../shell/Face';
import { GameScreen, RoundBtn } from '../shell/ui';
import { HELPER_PRICE, type HelperKind, type Question, type Round } from './core';
import { clock } from '@/games/engine/clock';
import { useClock, type Clock } from '@/games/engine/useTicker';

// The Streak Master's own design language (SM10): "Heat column".
// The streak fills a heat tube on the left, segment by segment; the round clock is a burning fuse with
// a spark plus the written time next to pause; the six options sit in a 2 by 3 grid. A right answer
// glows green; a wrong pick turns red and shakes, then the right answer glows green.

const SEGMENTS = 10;

export function heatColors() {
  return { good: '#3fc58a', bad: '#ff5c6c', hot: '#a48bff', segOff: '#10132a' };
}

export type BoardProps = {
  q: Question;
  round: Round;
  /**
   * The clock the round runs on, the time left at a given time on it, and the whole round length (with +10 s
   * helpers), for the clock text and the fuse. Only those two follow the clock; the board does not redraw with it.
   */
  ticks: Clock;
  leftAt: (now: number) => number;
  totalMs: number;
  /** A line above the field, e.g. the player's name in Offline. */
  who?: { name: string; color?: string };
  onAnswer: (choice: number) => void;
  onPause: () => void;
  /** Solo only (SM4, SM11). */
  helpers?: { onHelper: (kind: HelperKind) => void; usable: (kind: HelperKind) => boolean };
  /** Covers the question while paused (rule 4). */
  hidden?: boolean;
  notice?: string | null;
  /** A paid offer under the board (Solo's second chance). */
  offer?: { label: string; onPress: () => void } | null;
  /** Replaces the options: time up, turn over. */
  dock?: ReactNode;
  /** Online: your pick, locked in until the question ends (no right or wrong yet). */
  locked?: number | null;
  /** Online, once the question ends: who picked each choice (character slugs by choice index). */
  faces?: Record<number, string[]>;
  children?: ReactNode;
};

export function HeatBoard(p: BoardProps) {
  const t = useTheme();
  const hc = heatColors();
  const fb = p.round.feedback;
  const showing = p.round.phase === 'feedback' || (p.round.phase === 'paused' && p.round.before === 'feedback');
  const lit = Math.min(p.round.streak, SEGMENTS);
  const over = p.round.phase === 'over';

  return (
    <GameScreen scroll={false}>
      <View style={s.body}>
        {/* The heat tube: one segment per answer in the current streak. */}
        <View style={s.col}>
          <Text style={[s.streakN, { color: t.white }]}>{p.round.streak}</Text>
          <Text style={[s.colK, { color: t.dim }]}>STREAK</Text>
          <View style={[s.tube, { borderColor: t.panelLine, backgroundColor: t.panel }]} accessibilityLabel={`Streak ${p.round.streak}`}>
            {Array.from({ length: SEGMENTS }, (_, i) => (i < lit ? <Seg key={i} on hot={hc.hot} cool={t.accent} fresh={i === lit - 1 && showing && !!fb?.right} /> : <View key={i} style={[s.seg, { backgroundColor: hc.segOff }]} />))}
          </View>
          <Text style={[s.colK, { color: t.dim }]}>{`${p.round.score}\nPTS`}</Text>
        </View>

        <View style={s.main}>
          {p.who ? <Text style={[s.who, { color: p.who.color ?? t.accent }]} numberOfLines={1}>{p.who.name}</Text> : null}
          <View style={s.top}>
            <Text style={[s.field, { color: t.accent }]} numberOfLines={1}>{p.hidden ? '' : p.q.field.toUpperCase()}</Text>
            <View style={s.right}>
              <ClockText ticks={p.ticks} leftAt={p.leftAt} over={over} bad={hc.bad} white={t.white} />
              <RoundBtn label="Pause" glyph="❚❚" onPress={p.onPause} />
            </View>
          </View>
          <LiveFuse ticks={p.ticks} leftAt={p.leftAt} totalMs={p.totalMs} cool={t.accent} hot={hc.hot} track={t.line} burning={p.round.phase === 'playing'} />

          {p.hidden ? (
            <View style={[s.hide, { borderColor: t.panelLine, backgroundColor: t.panel }]}>
              <Text style={[s.hideT, { color: t.mute }]}>Paused. The clock is stopped.</Text>
            </View>
          ) : p.dock ? null : (
            <Animated.View key={p.q.id} entering={FadeIn.duration(180)} style={{ gap: u(10) }}>
              <Text style={[s.q, { color: t.fg }]}>{p.q.stem}</Text>
              {(
                <View style={s.grid}>
                  {p.round.order.map((ci) => {
                    const gone = p.round.removed.includes(ci);
                    const state = showing && fb ? (ci === p.q.answer ? 'good' : ci === fb.picked ? 'bad' : 'idle') : p.locked === ci ? 'locked' : 'idle';
                    return (
                      <Option
                        key={`${p.q.id}:${ci}`}
                        label={p.q.choices[ci]}
                        state={state}
                        late={state === 'good' && !fb?.right}
                        gone={gone}
                        faces={p.faces?.[ci]}
                        live={p.round.phase === 'playing' && !gone && p.locked == null}
                        onPress={() => p.onAnswer(ci)}
                        hc={hc}
                      />
                    );
                  })}
                </View>
              )}
              {showing && fb && !fb.right && p.q.explanation ? (
                <Animated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} entering={FadeIn.delay(350)} style={[s.expl, { color: t.mute }]}>{p.q.explanation}</Animated.Text>
              ) : null}
            </Animated.View>
          )}

          <View style={{ flex: 1 }} />
          {p.offer && !p.dock ? (
            <Animated.View entering={FadeIn}>
              <Pressable onPress={p.offer.onPress} style={[s.offer, { borderColor: t.accent }]} accessibilityRole="button">
                <Text style={[s.offerT, { color: t.accent }]}>{p.offer.label}</Text>
              </Pressable>
            </Animated.View>
          ) : null}
          {p.notice ? (
            <Animated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} entering={FadeIn} style={[s.notice, { color: t.soft }]}>{p.notice}</Animated.Text>
          ) : null}
          {p.dock ? (
            // Time up and turn over sit in the middle of the screen (Yazan, 2026-10-04).
            <>
              <Animated.View entering={FadeInDown.duration(260)}>{p.dock}</Animated.View>
              <View style={{ flex: 1.15 }} />
            </>
          ) : p.helpers ? (
            <Helpers {...p.helpers} disabled={p.round.phase !== 'playing'} />
          ) : null}
        </View>
      </View>
      {p.children}
    </GameScreen>
  );
}

/** One lit segment of the tube; the newest one flares when it lights. */
function Seg({ hot, cool, fresh }: { on: true; hot: string; cool: string; fresh: boolean }) {
  const k = useSharedValue(fresh ? 1.6 : 1);
  useEffect(() => {
    if (fresh) k.value = withSequence(withTiming(1.6, { duration: 1 }), withTiming(1, { duration: 420 }));
  }, [fresh, k]);
  const st = useAnimatedStyle(() => ({ transform: [{ scaleX: k.value }] }));
  return (
    <Animated.View style={[s.seg, st, { shadowColor: hot, shadowOpacity: 0.55, shadowRadius: u(5), shadowOffset: { width: 0, height: 0 } }]}>
      <LinearGradient colors={[hot, cool]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

/** The round clock's text, following the clock by itself (red in the last 10 s). */
function ClockText({ ticks, leftAt, over, bad, white }: { ticks: Clock; leftAt: (now: number) => number; over: boolean; bad: string; white: string }) {
  const leftMs = leftAt(useClock(ticks));
  const warn = leftMs <= 10_000 && !over;
  return (
    <Text style={[s.clock, { color: warn ? bad : white }]} accessibilityLabel={`${Math.ceil(leftMs / 1000)} seconds left`}>
      {clock(leftMs, { down: true })}
    </Text>
  );
}

/** The fuse, redrawn on every tick of the clock by itself, so the board around it doesn't redraw with it. */
function LiveFuse({ ticks, leftAt, totalMs, ...rest }: { ticks: Clock; leftAt: (now: number) => number; totalMs: number; cool: string; hot: string; track: string; burning: boolean }) {
  const leftMs = leftAt(useClock(ticks));
  return <Fuse frac={totalMs ? leftMs / totalMs : 0} {...rest} />;
}

/** The burning fuse: how much of the round is left, with a spark at the end. */
function Fuse({ frac, cool, hot, track, burning }: { frac: number; cool: string; hot: string; track: string; burning: boolean }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = burning ? withRepeat(withTiming(1.35, { duration: 480 }), -1, true) : withTiming(1);
  }, [burning, pulse]);
  const spark = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const pct = `${Math.max(0, Math.min(1, frac)) * 100}%` as const;
  return (
    <View style={[s.fuse, { backgroundColor: track }]}>
      <LinearGradient colors={[cool, hot]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.fuseFill, { width: pct }]} />
      <Animated.View style={[s.spark, spark, { left: pct, shadowColor: hot }]} />
    </View>
  );
}

function Option({ label, state, late, gone, live, faces, onPress, hc }: { label: string; state: 'idle' | 'good' | 'bad' | 'locked'; late: boolean; gone: boolean; live: boolean; faces?: string[]; onPress: () => void; hc: ReturnType<typeof heatColors> }) {
  const t = useTheme();
  const x = useSharedValue(0);
  const glow = useSharedValue(0);
  useEffect(() => {
    if (state === 'bad') x.value = withSequence(withTiming(-5, { duration: 50 }), withTiming(5, { duration: 70 }), withTiming(-3, { duration: 60 }), withTiming(0, { duration: 50 }));
    // The right answer glows green; after a miss it lights a moment later, once the red has shown.
    glow.value = state === 'good' ? withSequence(withTiming(0, { duration: late ? 350 : 1 }), withTiming(1, { duration: 260 }), withTiming(0.7, { duration: 500 })) : 0;
  }, [state, late, x, glow]);
  const tint = state === 'good' ? hc.good : state === 'bad' ? hc.bad : null;
  const move = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const halo = useAnimatedStyle(() => ({ opacity: glow.value }));
  return (
    <Animated.View style={[s.optWrap, move]}>
      {state === 'good' ? <Animated.View pointerEvents="none" style={[s.halo, halo, { backgroundColor: hc.good, shadowColor: hc.good }]} /> : null}
      <Pressable
        onPress={onPress}
        disabled={!live}
        style={[
          s.opt,
          { backgroundColor: t.panel, borderColor: t.panelLine, opacity: gone ? 0.28 : 1 },
          tint ? { borderColor: tint, borderWidth: 1.5, backgroundColor: mix(tint, '#151933', 0.2) } : null,
          state === 'locked' ? { borderColor: t.accent, borderWidth: 1.5 } : null,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !live }}
        accessibilityLabel={gone ? `${label}, removed` : label}>
        <Text style={[s.optT, { color: t.fg, fontFamily: tint || state === 'locked' ? F.bodyBold : F.body, textDecorationLine: gone ? 'line-through' : 'none' }]}>{label}</Text>
      </Pressable>
      {faces?.length ? (
        // Online: the faces of everyone who picked this answer, on its top corner.
        <Animated.View entering={FadeIn.duration(220)} style={s.faces} pointerEvents="none">
          {faces.slice(0, 6).map((f, i) => (
            <View key={i} style={[s.faceRing, { borderColor: t.panel, marginLeft: i ? -u(5) : 0 }]}>
              <Face slug={f} size={u(17)} />
            </View>
          ))}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** Solid blend of two hex colours (a tinted tile must stay opaque so the halo doesn't show through). */
function mix(a: string, b: string, k: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v * k + y[i] * (1 - k))).join(',')})`;
}

/** One helper button with its price under it. */
function HelperBtn({ kind, label, bg, line, fg, off, onPress }: { kind: HelperKind; label: string; bg: string; line: string; fg: string; off: boolean; onPress: () => void }) {
  const price = HELPER_PRICE[kind];
  return (
    <Pressable onPress={onPress} disabled={off} style={[s.hb, { backgroundColor: bg, borderColor: line }]} accessibilityRole="button" accessibilityLabel={`${label}, ${price} token${price > 1 ? 's' : ''}`}>
      <Text style={[s.hbT, { color: fg, opacity: off ? 0.45 : 1 }]} numberOfLines={1}>{label}</Text>
      <Text style={[s.hbP, { color: fg, opacity: off ? 0.34 : 0.75 }]}>{`${price} token${price > 1 ? 's' : ''}`}</Text>
    </Pressable>
  );
}

/** Solo helpers in the Diagnostic Pursuit button style (Yazan, 2026-10-04): bigger, coloured, price under each. */
function Helpers({ onHelper, usable, disabled }: { onHelper: (k: HelperKind) => void; usable: (k: HelperKind) => boolean; disabled: boolean }) {
  return (
    <View style={s.hrow}>
      <HelperBtn kind="remove" off={disabled || !usable('remove')} onPress={() => onHelper('remove')} label="✂ Remove 2" bg="#142741" line="#19637e" fg="#67e8f9" />
      <HelperBtn kind="skip" off={disabled || !usable('skip')} onPress={() => onHelper('skip')} label="⏭ Skip" bg="#2e1a2e" line="#833f4a" fg="#fda4af" />
      <HelperBtn kind="time" off={disabled || !usable('time')} onPress={() => onHelper('time')} label="⏱ +10 s" bg="#231b4e" line="#504188" fg="#d8b4fe" />
    </View>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, flexDirection: 'row', gap: u(10) },
  col: { width: u(30), alignItems: 'center', gap: u(5) },
  streakN: { fontFamily: F.display, fontSize: u(22), lineHeight: u(25) },
  colK: { fontFamily: F.bodyBold, fontSize: u(6.5), letterSpacing: u(1), textAlign: 'center', lineHeight: u(9) },
  tube: { flex: 1, width: u(13), borderRadius: u(999), borderWidth: 1, padding: u(2.5), gap: u(2.5), flexDirection: 'column-reverse' },
  seg: { flex: 1, borderRadius: u(4), overflow: 'hidden' },
  main: { flex: 1, minWidth: 0, gap: u(9) },
  who: { fontFamily: F.display, fontSize: u(15), lineHeight: u(18) },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: u(8) },
  field: { flex: 1, fontFamily: F.bodyBold, fontSize: u(8), letterSpacing: u(1.4) },
  right: { flexDirection: 'row', alignItems: 'center', gap: u(7) },
  clock: { fontFamily: F.mono, fontSize: u(13), letterSpacing: u(0.4) },
  fuse: { height: u(3.5), borderRadius: u(2), justifyContent: 'center' },
  fuseFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: u(2) },
  spark: { position: 'absolute', width: u(8), height: u(8), marginLeft: -u(4), borderRadius: u(4), backgroundColor: '#fff', shadowOpacity: 1, shadowRadius: u(6), shadowOffset: { width: 0, height: 0 } },
  q: { fontFamily: F.body, fontSize: u(12), lineHeight: u(17) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: u(6) },
  optWrap: { width: '48.5%', borderRadius: u(11) },
  halo: { position: 'absolute', left: -u(2), right: -u(2), top: -u(2), bottom: -u(2), borderRadius: u(13), shadowOpacity: 0.9, shadowRadius: u(10), shadowOffset: { width: 0, height: 0 } },
  opt: { minHeight: u(42), borderRadius: u(11), borderWidth: 1, paddingHorizontal: u(8), paddingVertical: u(8), justifyContent: 'center' },
  optT: { fontSize: u(10.5), lineHeight: u(13.5) },
  faces: { position: 'absolute', top: -u(8), right: u(4), flexDirection: 'row' },
  faceRing: { borderWidth: 1.5, borderRadius: u(10) },
  expl: { fontFamily: F.body, fontSize: u(10), lineHeight: u(14) },
  hide: { borderRadius: u(14), borderWidth: 1, padding: u(18), alignItems: 'center' },
  hideT: { fontFamily: F.body, fontSize: u(11) },
  notice: { fontFamily: F.bodySemi, fontSize: u(10.5), textAlign: 'center' },
  offer: { alignSelf: 'center', borderWidth: 1, borderRadius: 999, paddingHorizontal: u(14), height: u(30), justifyContent: 'center' },
  offerT: { fontFamily: F.bodyBold, fontSize: u(11) },
  hrow: { flexDirection: 'row', gap: u(5) },
  hb: { flex: 1, borderWidth: 1, borderRadius: u(10), paddingVertical: u(10), paddingHorizontal: u(3), alignItems: 'center', gap: u(1) },
  hbT: { fontFamily: F.bodyBold, fontSize: u(10.5), lineHeight: u(13) },
  hbP: { fontFamily: F.bodySemi, fontSize: u(8), lineHeight: u(10), opacity: 0.75 },
});
