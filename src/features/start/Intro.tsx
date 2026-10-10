import { Image } from 'expo-image';
import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { ECG, STAR } from '@/components/PulseStar';
import { u } from '@/theme/scale';

import { NAVY } from './Sky';
import { Wordmark } from './Wordmark';

/*
 * The MedNova intro, the approved prototype's story played in about 3 s (Yazan, 2026-10-10):
 *   0s     star pops in, heartbeat cut + spark run through it, it beats (0.85s)
 *   0.75s  the lockup slides so star + wordmark sit centred
 *   0.8s   the Lottie wordmark writes itself in (2.4x speed)
 *   2.1s   handover: wordmark fades, star glides to the centre, drops 10% and bursts into light
 *   3.0s   done, the page below is revealed
 * Every frame runs on the UI thread (Reanimated), and the star's soft glow is a ready-made
 * image, so the phone never re-renders React or re-blurs anything while it plays.
 */
export const T_LOTTIE = 0.8;
export const T_DONE = 3.0;
const LOTTIE_SPEED = 2.4;

const POP = Easing.bezierFn(0.2, 0.9, 0.3, 1.25);
const CUT = Easing.bezierFn(0.6, 0, 0.3, 1);
const SPARK2 = Easing.bezierFn(0.5, 0, 0.4, 1);
const SLIDE = Easing.bezierFn(0.65, 0, 0.25, 1);
const EASE = Easing.bezierFn(0.25, 0.1, 0.25, 1);
const EASE_OUT = Easing.bezierFn(0, 0, 0.58, 1);
const EASE_IN_OUT = Easing.bezierFn(0.42, 0, 0.58, 1);

// The heartbeat path is drawn with pathLength=1000 in the prototype. react-native-svg has no
// pathLength, so dash values are scaled by the real length of the path.
const ECG_LEN = 1375.87;
const k = ECG_LEN / 1000;

const SYM = 58;
const WM_W = 143;
const WM_H = 36;
const GAP = 6;
const SHIFT = (WM_W + GAP) / 2;

// The star's viewBox (120 100 784 824) fitted into the SYM square, and the glow image's box in it.
const VB = { x: 120, y: 100, w: 784, h: 824 };
const GLOW = { x: -180, y: -200, w: 1384, h: 1424 }; // assets/images/intro/star-glow.png, blur 38 baked in

function prog(t: number, delay: number, dur: number) {
  'worklet';
  return Math.min(1, Math.max(0, (t - delay) / dur));
}

/** A CSS keyframe track: [progress, value] stops, the easing applied per segment. */
function track(p: number, stops: number[][], ease: (x: number) => number) {
  'worklet';
  if (p <= stops[0][0]) return stops[0][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i][0];
    const b = stops[i + 1][0];
    if (p < b) return stops[i][1] + (stops[i + 1][1] - stops[i][1]) * ease((p - a) / (b - a));
  }
  return stops[stops.length - 1][1];
}

function glowAt(t: number) {
  'worklet';
  if (t >= 1.5) return track(((t - 1.5) % 1.6) / 1.6, [[0, 0.55], [0.5, 0.8], [1, 0.55]], EASE_IN_OUT);
  if (t >= 0.85) return track(prog(t, 0.85, 0.45), [[0, 0.55], [0.2, 1], [1, 0.55]], EASE_OUT);
  return track(prog(t, 0, 0.35), [[0, 0], [1, 0.55]], EASE_OUT);
}

const APath = Animated.createAnimatedComponent(Path);

/** The static parts of the star; only the heartbeat cut and the spark move. */
const Star = memo(function Star({ t }: { t: ReturnType<typeof useSharedValue<number>> }) {
  const cut = useAnimatedProps(() => ({ strokeDashoffset: 1000 * (1 - CUT(prog(t.value, 0.3, 0.55))) * k }));
  const spark = useAnimatedProps(() => {
    const v = t.value;
    let off: number;
    let op: number;
    if (v < 1.6) {
      const q = prog(v, 0.3, 0.55);
      off = 70 - 1070 * CUT(q);
      op = track(q, [[0, 1], [0.9, 1], [1, 0]], CUT);
    } else {
      const q = prog(v, 1.6, 0.6);
      off = 70 - 1070 * SPARK2(q);
      op = track(q, [[0, 0.9], [0.85, 0.9], [1, 0]], SPARK2);
    }
    return { strokeDashoffset: off * k, opacity: op };
  });
  return (
    <Svg width={u(SYM)} height={u(SYM)} viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} style={{ overflow: 'visible' }}>
      <Defs>
        <LinearGradient id="inF" x1="0.15" y1="0.1" x2="0.85" y2="0.95">
          <Stop offset="0" stopColor="#d8f6ff" />
          <Stop offset="0.42" stopColor="#6fd6ff" />
          <Stop offset="1" stopColor="#3aa6dc" />
        </LinearGradient>
        <RadialGradient id="inH" cx="0.3" cy="0.25" r="0.55">
          <Stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#fff" stopOpacity="0" />
        </RadialGradient>
        <ClipPath id="inC">
          <Path d={STAR} />
        </ClipPath>
      </Defs>
      <Path d={STAR} fill="url(#inF)" />
      <Path d={STAR} fill="url(#inH)" />
      <Path d="M160 503 L405 405 L512 138 L619 405" fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={5} strokeLinejoin="round" clipPath="url(#inC)" />
      <G clipPath="url(#inC)">
        <APath d={ECG} fill="none" stroke={NAVY} strokeWidth={17} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[1000 * k, 1000 * k]} animatedProps={cut} />
        {/* the spark: a soft wide stroke under a bright core stands in for the old live blur */}
        <G>
          <APath d={ECG} fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[70 * k, 1100 * k]} animatedProps={spark} />
          <APath d={ECG} fill="none" stroke="#fff" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[70 * k, 1100 * k]} animatedProps={spark} />
        </G>
      </G>
    </Svg>
  );
});

/** Background of the logo stage. */
function Backdrop({ w, h }: { w: number; h: number }) {
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="inBg" gradientUnits="userSpaceOnUse" cx={0} cy={0} r={1} gradientTransform={`translate(${w / 2} ${h / 2}) scale(${0.7 * w} ${0.5 * h})`}>
          <Stop offset={0} stopColor="#0f1840" />
          <Stop offset={0.7} stopColor={NAVY} />
          <Stop offset={1} stopColor={NAVY} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill="url(#inBg)" />
    </Svg>
  );
}

/** The light burst of the handover. */
function Burst({ w, h }: { w: number; h: number }) {
  // radial-gradient(circle at 50% 60%, ...) : a circle out to the farthest corner
  const r = Math.hypot(w / 2, h * 0.6);
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="inFx" gradientUnits="userSpaceOnUse" cx={w / 2} cy={h * 0.6} r={r} fx={w / 2} fy={h * 0.6}>
          <Stop offset={0} stopColor="rgb(190,240,255)" stopOpacity={0.95} />
          <Stop offset={0.18} stopColor="rgb(111,214,255)" stopOpacity={0.5} />
          <Stop offset={0.45} stopColor="rgb(111,214,255)" stopOpacity={0} />
          <Stop offset={1} stopColor="rgb(111,214,255)" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill="url(#inFx)" />
    </Svg>
  );
}

/** Full-screen intro overlay. Calls onDone once the handover has revealed the page below. */
export function Intro({ w, h, onDone }: { w: number; h: number; onDone: () => void }) {
  const t = useSharedValue(0);
  const [play, setPlay] = useState(false);
  useEffect(() => {
    t.value = withTiming(T_DONE, { duration: T_DONE * 1000, easing: Easing.linear }, (fin) => {
      if (fin) scheduleOnRN(onDone);
    });
    const id = setTimeout(() => setPlay(true), T_LOTTIE * 1000);
    return () => clearTimeout(id);
    // onDone is read once; the intro runs a single time per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  const dx = u(SHIFT);
  const dy = h * 0.1;
  const sym = u(SYM);
  // glow image placement inside the star box (viewBox fitted with "meet")
  const kk = sym / VB.h;
  const offX = (sym - VB.w * kk) / 2;
  const glowBox = { left: offX + (GLOW.x - VB.x) * kk, top: (GLOW.y - VB.y) * kk, width: GLOW.w * kk, height: GLOW.h * kk };

  const stage = useAnimatedStyle(() => ({ opacity: 1 - EASE(prog(t.value, 2.45, 0.3)) }));
  const lockup = useAnimatedStyle(() => ({ transform: [{ translateX: dx * (1 - SLIDE(prog(t.value, 0.75, 0.45))) }] }));
  const hand = useAnimatedStyle(() => {
    const v = t.value;
    const s1 = EASE(prog(v, 2.3, 0.2));
    const s2 = EASE(prog(v, 2.5, 0.2));
    return {
      opacity: 1 - s2,
      transform: [{ translateX: dx * EASE(prog(v, 2.1, 0.2)) }, { translateY: dy * s1 }, { scale: v < 2.5 ? 1 + 0.3 * s1 : 1.3 + 1.7 * s2 }],
    };
  });
  const pop = useAnimatedStyle(() => {
    const v = t.value;
    const pp = prog(v, 0, 0.35);
    const s = v >= 0.85 ? track(prog(v, 0.85, 0.45), [[0, 1], [0.18, 1.09], [0.36, 0.98], [0.54, 1.04], [1, 1]], EASE_IN_OUT) : track(pp, [[0, 0], [0.6, 1.14], [1, 1]], POP);
    return {
      opacity: Math.min(1, Math.max(0, track(pp, [[0, 0], [0.6, 1]], POP))),
      transform: [{ scale: s }, { rotate: `${track(pp, [[0, -35], [0.6, 4], [1, 0]], POP)}deg` }],
    };
  });
  const glow = useAnimatedStyle(() => ({ opacity: glowAt(t.value) }));
  const wm = useAnimatedStyle(() => ({ opacity: 1 - EASE(prog(t.value, 2.1, 0.18)) }));
  const fx = useAnimatedStyle(() => {
    const v = t.value;
    const a = EASE(prog(v, 2.45, 0.2));
    const b = EASE(prog(v, 2.65, 0.3));
    return { opacity: v < 2.65 ? a : 1 - b, transform: [{ scale: v < 2.65 ? 0.3 + 0.9 * a : 1.2 + 0.6 * b }] };
  });

  const backdrop = useMemo(() => <Backdrop w={w} h={h} />, [w, h]);
  const burst = useMemo(() => <Burst w={w} h={h} />, [w, h]);
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 60 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, stage]}>
        {backdrop}
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: u(GAP) }, lockup]}>
            <Animated.View style={[{ width: sym, height: sym }, hand]}>
              <Animated.View style={[{ flex: 1 }, pop]}>
                <Animated.View style={[{ position: 'absolute', ...glowBox }, glow]} pointerEvents="none">
                  <Image source={require('@/assets/images/intro/star-glow.png')} style={{ width: '100%', height: '100%' }} contentFit="fill" transition={0} />
                </Animated.View>
                <Star t={t} />
              </Animated.View>
            </Animated.View>
            <Animated.View style={wm}>
              <Wordmark width={u(WM_W)} height={u(WM_H)} play={play} speed={LOTTIE_SPEED} />
            </Animated.View>
          </Animated.View>
        </View>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fx]}>
        {burst}
      </Animated.View>
    </View>
  );
}
