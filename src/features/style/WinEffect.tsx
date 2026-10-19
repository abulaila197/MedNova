import { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Text } from '@/components/AppText';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import type { EffectKey } from './catalog';
import { Trophy } from './Trophy';
import { useLook, wantLooks } from './useStyle';
import { knock, thump } from './WinShake';

/*
 * Win effects (Yazan 2026-10-18): Confetti, Pulse Wave, two plain celebrations (Trophy, Medal) and four taunts that
 * play to the other players (Too Easy, Mic Drop, Flatline, Spotlight). GPU rule: transforms, opacity and SVG strokes
 * only, no blur, no loops, every effect over by 2.7 s. Drawn on a 322-wide design and scaled to the screen.
 */
const DUR = 2700;
const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);
const AEllipse = Animated.createAnimatedComponent(Ellipse);
const AG = Animated.createAnimatedComponent(G);

const CYAN = '#6fd6ff';
const VIOLET = '#a48bff';
const RED = '#ff5468';

/**
 * A bought win effect (Yazan 2026-10-13): plays once over the results page when its owner wins online, and every
 * player in the room sees it. Pass `kind` to play one directly (the Style shop's "Try it").
 */
export function WinEffect({ userId, kind, onDone }: { userId?: string; kind?: EffectKey; onDone?: () => void }) {
  useEffect(() => {
    if (userId) wantLooks([userId]);
  }, [userId]);
  const look = useLook(userId);
  const k = kind ?? look.effect;
  const [on, setOn] = useState(true);
  useEffect(() => {
    if (!k) return;
    const id = setTimeout(() => {
      setOn(false);
      onDone?.();
    }, DUR + 100);
    return () => clearTimeout(id);
  }, [k, onDone]);
  if (!k || !on) return null;
  const Fx = PLAY[k];
  if (!Fx) return null;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => setOn(false)}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Fx />
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------- timing helpers

/** Milliseconds since the effect started, 0 -> DUR (Reduce Motion: parked mid-way, then gone). */
function useClock() {
  const reduce = useReducedMotion();
  const T = useSharedValue(reduce ? 1300 : 0);
  useEffect(() => {
    if (!reduce) T.value = withTiming(DUR, { duration: DUR, easing: Easing.linear });
  }, [T, reduce]);
  return T;
}

type Ease = 'in' | 'out' | 'inOut' | 'lin';

/** 0 -> 1 over [at, at + len], eased. */
function seg(T: number, at: number, len: number, e: Ease = 'lin') {
  'worklet';
  const q = Math.max(0, Math.min(1, (T - at) / len));
  return e === 'in' ? q * q * q : e === 'out' ? 1 - (1 - q) ** 3 : e === 'inOut' ? (q < 0.5 ? 4 * q * q * q : 1 - (-2 * q + 2) ** 3 / 2) : q;
}

/** Keyframes [time, value, ease into it]. */
function track(T: number, ks: [number, number, Ease?][]) {
  'worklet';
  if (T <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    const [t1, v1, e] = ks[i];
    const [t0, v0] = ks[i - 1];
    if (T <= t1) return v0 + (v1 - v0) * seg(T, t0, t1 - t0, e ?? 'lin');
  }
  return ks[ks.length - 1][1];
}

/** The whole effect fades in fast and out at the end. */
function useLayer(T: SharedValue<number>, out = DUR - 450) {
  return useAnimatedStyle(() => ({
    opacity: track(T.value, [
      [0, 0],
      [120, 1],
      [out, 1],
      [DUR, 0],
    ]),
  }));
}

/** Dims the page behind an effect so it reads. */
function Scrim({ T }: { T: SharedValue<number> }) {
  const st = useAnimatedStyle(() => ({
    opacity: track(T.value, [
      [0, 0],
      [200, 1],
      [DUR - 400, 1],
      [DUR, 0],
    ]),
  }));
  return <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(9,15,38,0.62)' }, st]} />;
}

function useK() {
  const { width, height } = useWindowDimensions();
  return { width, height, k: width / 322 };
}

/** An expanding ring. */
function Ring({
  T,
  at,
  cx,
  cy,
  from,
  to,
  w,
  color,
  len = 900,
}: {
  T: SharedValue<number>;
  at: number;
  cx: number;
  cy: number;
  from: number;
  to: number;
  w: number;
  color: string;
  len?: number;
}) {
  const ap = useAnimatedProps(() => {
    const q = seg(T.value, at, len, 'out');
    const live = T.value >= at;
    return {
      r: from + (to - from) * q,
      strokeWidth: w + (1 - w) * q,
      strokeOpacity: live ? 0.95 * (1 - q) : 0,
    };
  });
  return <ACircle cx={cx} cy={cy} fill="none" stroke={color} animatedProps={ap} />;
}

/** A line of points as a path, with its length (for drawing it on). */
function line(pts: [number, number][]) {
  let len = 0;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    cum.push(len);
  }
  return {
    d: pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
    len,
    cum,
  };
}

// ---------------------------------------------------------------- Confetti (kept as it was)

const PAPER = ['#f2cc68', '#4fc8ff', '#c73646', '#9be3b0', '#e5833a', '#c9b8ff', '#fff6d6'];

function Confetti() {
  const { width, height } = useWindowDimensions();
  const T = useClock();
  const bits = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        x: ((i * 37) % 100) / 100,
        drift: (((i * 53) % 21) - 10) / 100,
        delay: ((i * 29) % 30) / 100,
        spin: 2 + ((i * 17) % 5),
        w: 5 + ((i * 7) % 5),
        c: PAPER[i % PAPER.length],
      })),
    [],
  );
  const layer = useLayer(T);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, layer]}>
      {bits.map((b, i) => (
        <Bit key={i} b={b} T={T} width={width} height={height} />
      ))}
    </Animated.View>
  );
}

function Bit({
  b,
  T,
  width,
  height,
}: {
  b: {
    x: number;
    drift: number;
    delay: number;
    spin: number;
    w: number;
    c: string;
  };
  T: SharedValue<number>;
  width: number;
  height: number;
}) {
  const st = useAnimatedStyle(() => {
    const p = Math.min(1, T.value / (DUR - 200));
    const q = Math.max(0, Math.min(1, (p - b.delay) / (1 - b.delay)));
    return {
      transform: [
        { translateX: (b.x + b.drift * q) * width },
        { translateY: -30 + q * (height + 60) },
        { rotate: `${q * 360 * b.spin}deg` },
        { scaleX: Math.cos(q * Math.PI * b.spin) },
      ],
    };
  });
  return <Animated.View style={[s.bit, { width: u(b.w), height: u(b.w * 1.7), backgroundColor: b.c }, st]} />;
}

// ---------------------------------------------------------------- Pulse Wave (redone, bold)

const PULSE: [number, number][] = [
  [-10, 0],
  [70, 0],
  [84, -14],
  [98, 0],
  [118, 0],
  [132, 22],
  [150, -150],
  [170, 92],
  [186, 0],
  [214, 0],
  [232, -26],
  [252, 0],
  [340, 0],
];

function PulseWave() {
  const { width, height, k } = useK();
  const T = useClock();
  const layer = useLayer(T);
  const cy = height * 0.48;
  const { d, len, cum } = useMemo(() => line(PULSE.map(([x, y]) => [x * k, cy + y * k])), [k, cy]);
  const pts = useMemo(() => PULSE.map(([x, y]) => [x * k, cy + y * k]), [k, cy]);
  useEffect(() => {
    thump(330, 1.035);
    thump(1250, 1.02);
  }, []);
  const draw = useAnimatedProps(() => ({
    strokeDashoffset: len * (1 - seg(T.value, 0, 760, 'inOut')),
  }));
  const bold = useAnimatedProps(() => ({
    strokeDashoffset: len * (1 - seg(T.value, 0, 760, 'inOut')),
    strokeWidth:
      6 *
      k *
      track(T.value, [
        [1250, 1],
        [1400, 1.6],
        [1550, 1],
      ]),
  }));
  const spark = useAnimatedProps(() => {
    const at = len * seg(T.value, 0, 760, 'inOut');
    let i = 1;
    while (i < cum.length - 1 && cum[i] < at) i++;
    const q = (at - cum[i - 1]) / Math.max(0.001, cum[i] - cum[i - 1]);
    return {
      cx: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * q,
      cy: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * q,
      opacity: T.value < 760 ? 1 : 0,
    };
  });
  const edge = useAnimatedStyle(() => ({
    opacity: track(T.value, [
      [330, 0],
      [580, 0.9],
      [830, 0],
    ]),
  }));
  const ring = { cx: 150 * k, cy: cy - 30 * k, from: 8 * k };
  return (
    <Animated.View style={[StyleSheet.absoluteFill, layer]}>
      <Svg width={width} height={height}>
        {[0, 1, 2].map((i) => (
          <Ring key={`a${i}`} T={T} at={330 + i * 90} {...ring} to={300 * k} w={12 * k} color={i % 2 ? VIOLET : CYAN} />
        ))}
        {[0, 1].map((i) => (
          <Ring key={`b${i}`} T={T} at={1250 + i * 90} {...ring} to={220 * k} w={10 * k} color={i % 2 ? VIOLET : CYAN} />
        ))}
        <APath
          d={d}
          fill="none"
          stroke={CYAN}
          strokeOpacity={0.18}
          strokeWidth={16 * k}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={len}
          animatedProps={draw}
        />
        <APath d={d} fill="none" stroke={CYAN} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={len} animatedProps={bold} />
        <APath
          d={d}
          fill="none"
          stroke="#ffffff"
          strokeWidth={1.8 * k}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={len}
          animatedProps={draw}
        />
        <ACircle r={16 * k} fill={CYAN} fillOpacity={0.3} animatedProps={spark} />
        <ACircle r={7 * k} fill="#ffffff" animatedProps={spark} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, s.edge, { borderColor: CYAN }, edge]} />
    </Animated.View>
  );
}

// ---------------------------------------------------------------- Too Easy (taunt, replaces Discharged)

function TooEasy() {
  const { height, k } = useK();
  const T = useClock();
  const layer = useLayer(T);
  useEffect(() => knock(230, 10), []);
  const stamp = useAnimatedStyle(() => ({
    opacity: seg(T.value, 0, 224),
    transform: [
      { rotate: '-11deg' },
      {
        scale: track(T.value, [
          [0, 3.2],
          [224, 0.9, 'in'],
          [320, 1, 'out'],
        ]),
      },
    ],
  }));
  const dots = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        a: (i / 12) * Math.PI * 2 + 0.3,
        sz: (4 + ((i * 7) % 7)) * k,
      })),
    [k],
  );
  return (
    <Animated.View style={[StyleSheet.absoluteFill, layer]}>
      <Scrim T={T} />
      <View style={[s.at, { top: height * 0.44 }]}>
        {dots.map((d, i) => (
          <Ink key={i} T={T} a={d.a} sz={d.sz} k={k} />
        ))}
      </View>
      {/* The stamp sits in a real box centred on the same line: inside the 0-high anchor its words didn't draw on
          Android, so only the red frame showed (2026-10-19). */}
      <View style={[s.box, { top: height * 0.44 - 150 * k, height: 300 * k }]} pointerEvents="none">
        <Animated.View
          style={[
            s.stamp,
            {
              borderWidth: 5 * k,
              borderRadius: 14 * k,
              paddingHorizontal: 20 * k,
              paddingVertical: 8 * k,
            },
            stamp,
          ]}
        >
          <Text style={[s.stampT, { fontSize: 46 * k }]} numberOfLines={1}>
            TOO EASY
          </Text>
          <Text style={[s.stampS, { fontSize: 11 * k }]}>BETTER LUCK NEXT TIME</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function Ink({ T, a, sz, k }: { T: SharedValue<number>; a: number; sz: number; k: number }) {
  const dx = Math.cos(a);
  const dy = Math.sin(a) * 0.55;
  const st = useAnimatedStyle(() => {
    const tt = T.value;
    const fly = track(tt, [
      [230, 0],
      [950, 34 * k, 'out'],
      [1430, 40 * k],
    ]);
    return {
      opacity: track(tt, [
        [230, 0],
        [410, 1],
        [950, 0.9],
        [1430, 0],
      ]),
      transform: [
        { translateX: dx * (110 * k + fly) },
        { translateY: dy * (110 * k + fly) },
        {
          scale: track(tt, [
            [230, 0.3],
            [410, 1],
            [1430, 0.8],
          ]),
        },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        s.ink,
        {
          width: sz,
          height: sz,
          borderRadius: sz / 2,
          marginLeft: -sz / 2,
          marginTop: -sz / 2,
        },
        st,
      ]}
    />
  );
}

// ---------------------------------------------------------------- Mic Drop (taunt)

function MicDrop() {
  const { width, height, k } = useK();
  const T = useClock();
  const layer = useLayer(T);
  const floor = height * 0.69;
  useEffect(() => knock(550, 9), []);
  const mic = useAnimatedStyle(() => {
    const tt = T.value;
    const y = track(tt, [
      [0, -180 * k - floor],
      [550, -140 * k, 'in'],
      [750, -162 * k, 'out'],
      [900, -140 * k, 'in'],
      [950, -146 * k],
      [1000, -140 * k],
    ]);
    const r = track(tt, [
      [0, -6],
      [550, 0],
      [750, 40],
      [900, 84, 'in'],
      [950, 80],
      [1000, 84],
    ]);
    return { transform: [{ translateY: floor + y }, { rotate: `${r}deg` }] };
  });
  const thud = useAnimatedProps(() => {
    const q = seg(T.value, 550, 700, 'out');
    return {
      rx: (10 + 140 * q) * k,
      ry: (3 + 19 * q) * k,
      strokeWidth: (6 - 5 * q) * k,
      strokeOpacity: T.value < 550 ? 0 : 0.9 * (1 - q),
    };
  });
  const txt = useAnimatedStyle(() => ({
    opacity: seg(T.value, 850, 380, 'out'),
    transform: [{ translateY: 14 * k * (1 - seg(T.value, 850, 380, 'out')) }],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, layer]}>
      <Scrim T={T} />
      <Animated.View style={[s.words, { top: height * 0.44 }, txt]}>
        <Text style={[s.big, { fontSize: 44 * k }]}>Mic drop.</Text>
        <Text style={[s.small, { fontSize: 14 * k }]}>Nothing more to say.</Text>
      </Animated.View>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <AEllipse cx={width / 2} cy={floor + 6 * k} fill="none" stroke={CYAN} animatedProps={thud} />
        {Array.from({ length: 8 }, (_, i) => (
          <Dust key={i} T={T} side={i < 4 ? -1 : 1} n={i % 4} x={width / 2} y={floor} k={k} />
        ))}
      </Svg>
      <Animated.View
        style={[
          s.abs,
          {
            left: width / 2 - 24 * k,
            top: 0,
            width: 48 * k,
            height: 150 * k,
            transformOrigin: [24 * k, 140 * k, 0],
          },
          mic,
        ]}
      >
        <Svg width={48 * k} height={150 * k} viewBox="0 0 48 150">
          <Defs>
            <LinearGradient id="mg" x1="0" x2="1" y1="0" y2="0">
              <Stop offset="0" stopColor="#5c6a92" />
              <Stop offset="0.45" stopColor="#c9d3ee" />
              <Stop offset="1" stopColor="#3d4870" />
            </LinearGradient>
            <LinearGradient id="mh" x1="0" x2="1" y1="0" y2="0">
              <Stop offset="0" stopColor="#151b30" />
              <Stop offset="0.4" stopColor="#3a4466" />
              <Stop offset="1" stopColor="#10152a" />
            </LinearGradient>
          </Defs>
          <Rect x={4} y={2} width={40} height={50} rx={20} fill="url(#mg)" />
          {/* the grille: a few crossing lines read as mesh at this size */}
          <Path d="M10,10 L38,38 M8,22 L30,44 M18,6 L40,28 M38,10 L10,38 M40,22 L18,44 M30,6 L8,28" stroke="#26304f" strokeWidth={1} opacity={0.7} />
          <Rect x={2} y={44} width={44} height={10} rx={3} fill="#e0b44e" />
          <Rect x={2} y={44} width={44} height={3} rx={1.5} fill="#fff1c2" opacity={0.7} />
          <Path d="M7,54 L41,54 L33,146 Q24,150 15,146 Z" fill="url(#mh)" />
          <Rect x={21} y={70} width={6} height={14} rx={3} fill={CYAN} opacity={0.85} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

function Dust({ T, side, n, x, y, k }: { T: SharedValue<number>; side: number; n: number; x: number; y: number; k: number }) {
  const ap = useAnimatedProps(() => {
    const q = seg(T.value, 560 + n * 30, 800, 'out');
    return {
      cx: x + side * (8 + (32 + n * 22) * q) * k,
      cy: y + (4 - (10 + n * 6) * q) * k,
      r: (2 + (4 + n * 2) * q) * k,
      fillOpacity: T.value < 560 ? 0 : 0.5 * (1 - q),
    };
  });
  return <ACircle fill="#c9d3ee" animatedProps={ap} />;
}

// ---------------------------------------------------------------- Flatline (taunt)

function Flatline() {
  const { width, height, k } = useK();
  const T = useClock();
  const layer = useLayer(T);
  const y = height * 0.47;
  const { d, len } = useMemo(() => {
    const beat = (x0: number): [number, number][] => [
      [x0, 0],
      [x0 + 12, -12],
      [x0 + 24, 0],
      [x0 + 36, 18],
      [x0 + 50, -120],
      [x0 + 66, 70],
      [x0 + 80, 0],
    ];
    const pts: [number, number][] = [[-10, 0], ...beat(20), ...beat(120), [340, 0]];
    return line(pts.map(([px, py]) => [px * k, y + py * k]));
  }, [k, y]);
  useEffect(() => {
    thump(260);
    thump(610);
  }, []);
  const draw = useAnimatedProps(() => ({
    strokeDashoffset: len * (1 - seg(T.value, 0, 1300)),
  }));
  const cyan = useAnimatedProps(() => ({
    opacity: 1 - seg(T.value, 780, 200),
  }));
  const red = useAnimatedProps(() => ({ opacity: seg(T.value, 780, 200) }));
  const edge = useAnimatedStyle(() => ({
    opacity: track(T.value, [
      [900, 0],
      [1075, 0.9],
      [1250, 0],
      [1425, 0.7],
      [1600, 0],
    ]),
  }));
  const txt = useAnimatedStyle(() => ({
    opacity: track(T.value, [
      [950, 0],
      [1350, 1, 'out'],
      [2230, 1],
      [2550, 0],
    ]),
    transform: [{ translateY: 12 * k * (1 - seg(T.value, 950, 400, 'out')) }],
  }));
  const strokes = (c: string, glow: string) => (
    <>
      <APath
        d={d}
        fill="none"
        stroke={c}
        strokeOpacity={0.18}
        strokeWidth={16 * k}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray={len}
        animatedProps={draw}
      />
      <APath d={d} fill="none" stroke={c} strokeWidth={6 * k} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={len} animatedProps={draw} />
      <APath d={d} fill="none" stroke={glow} strokeWidth={1.8 * k} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={len} animatedProps={draw} />
    </>
  );
  return (
    <Animated.View style={[StyleSheet.absoluteFill, layer]}>
      <Scrim T={T} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <AG animatedProps={cyan}>{strokes(CYAN, '#ffffff')}</AG>
        <AG animatedProps={red}>{strokes(RED, '#ffd6db')}</AG>
      </Svg>
      <Animated.View style={[s.words, { top: height * 0.54 }, txt]}>
        <Text style={[s.big, { fontSize: 46 * k, color: RED }]}>Flatline.</Text>
        <Text style={[s.small, { fontSize: 14 * k, color: '#c6d0ee' }]}>{"That's you, everyone else."}</Text>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, s.edge, { borderColor: RED }, edge]} />
    </Animated.View>
  );
}

// ---------------------------------------------------------------- Spotlight (taunt)

function Spotlight() {
  const { width, height, k } = useK();
  const T = useClock();
  const dark = useAnimatedStyle(() => ({
    opacity: track(T.value, [
      [0, 0],
      [270, 0.88],
      [DUR - 400, 0.88],
      [DUR, 0],
    ]),
  }));
  // The lamp catches: off, on, a flicker, on.
  const lit = useAnimatedStyle(() => ({
    opacity: track(T.value, [
      [320, 0],
      [380, 1],
      [460, 0.15],
      [540, 1],
      [DUR - 400, 1],
      [DUR, 0],
    ]),
  }));
  const floor = height * 0.69;
  const cx = width / 2;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#03060f' }, dark]} />
      <Animated.View style={[StyleSheet.absoluteFill, lit]}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="cone" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#fff6d8" stopOpacity={0.75} />
              <Stop offset="1" stopColor="#fff6d8" stopOpacity={0.12} />
            </LinearGradient>
            <RadialGradient id="pool" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor="#fff6d8" stopOpacity={0.7} />
              <Stop offset="0.6" stopColor="#fff6d8" stopOpacity={0.25} />
              <Stop offset="1" stopColor="#fff6d8" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Path d={`M${cx - 14 * k},-4 L${cx + 14 * k},-4 L${cx + 150 * k},${floor} L${cx - 150 * k},${floor} Z`} fill="url(#cone)" />
          <Ellipse cx={cx} cy={floor} rx={160 * k} ry={28 * k} fill="url(#pool)" />
          <Rect x={cx - 22 * k} y={-6} width={44 * k} height={16 * k} rx={5 * k} fill="#2b324d" />
        </Svg>
        <View style={[s.words, { top: floor + 35 * k }]}>
          <Text style={[s.big, { fontSize: 38 * k, color: '#fff6d8' }]}>All eyes on me.</Text>
          <Text style={[s.small, { fontSize: 14 * k }]}>The rest of you can sit in the dark.</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------- Trophy (Yazan's Lottie, 115 KB vector)

function TrophyFx() {
  const { width, height, k } = useK();
  const T = useClock();
  const layer = useLayer(T);
  const size = 320 * k;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, layer]}>
      <Scrim T={T} />
      <View
        style={[
          s.abs,
          {
            left: (width - size) / 2,
            top: height * 0.25,
            width: size,
            height: size,
          },
        ]}
      >
        <Trophy size={size} />
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------- Medal (Yazan's medal, redrawn as vector art)

const STAR = 'M0,-12 L3.5,-4 L12,-3.7 L5.6,2 L7.4,10.5 L0,6 L-7.4,10.5 L-5.6,2 L-12,-3.7 L-3.5,-4 Z';

function Medal() {
  const { width, height, k } = useK();
  const T = useClock();
  const layer = useLayer(T, DUR - 400);
  const top = height * 0.22;
  const swing = useAnimatedStyle(() => {
    const tt = T.value;
    return {
      transform: [
        {
          translateY: track(tt, [
            [0, -420 * k - top],
            [440, 12 * k, 'in'],
            [680, 0, 'out'],
          ]),
        },
        {
          rotate: `${track(tt, [
            [440, 0],
            [680, 9, 'inOut'],
            [1000, -6, 'inOut'],
            [1280, 3, 'inOut'],
            [1560, -1, 'inOut'],
            [2000, 0, 'inOut'],
          ])}deg`,
        },
      ],
    };
  });
  const shine = useAnimatedProps(() => ({
    x: -40 + 290 * seg(T.value, 1000, 650, 'inOut'),
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, layer]}>
      <Scrim T={T} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {[0, 1].map((i) => (
          <Ring key={i} T={T} at={440 + i * 110} cx={width / 2} cy={top + 178 * k} from={60 * k} to={220 * k} w={8 * k} color="#ffcf4a" len={800} />
        ))}
      </Svg>
      <Animated.View
        style={[
          s.abs,
          {
            left: width / 2 - 100 * k,
            top,
            width: 200 * k,
            height: 260 * k,
            transformOrigin: [100 * k, 0, 0],
          },
          swing,
        ]}
      >
        <Svg width={200 * k} height={260 * k} viewBox="0 0 200 260">
          <Defs>
            <LinearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#ffb062" />
              <Stop offset="1" stopColor="#f0782a" />
            </LinearGradient>
            <LinearGradient id="rib" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#5b4ff0" />
              <Stop offset="0.5" stopColor="#8d84ff" />
              <Stop offset="1" stopColor="#5b4ff0" />
            </LinearGradient>
            <LinearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#ffe768" />
              <Stop offset="0.55" stopColor="#ffbf2a" />
              <Stop offset="1" stopColor="#f59a12" />
            </LinearGradient>
            <LinearGradient id="in" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#ffd24a" />
              <Stop offset="1" stopColor="#ffb320" />
            </LinearGradient>
            <ClipPath id="disc">
              <Circle cx={100} cy={178} r={62} />
            </ClipPath>
          </Defs>
          <Path d="M60,38 L140,38 L128,132 L100,152 L72,132 Z" fill="url(#rib)" />
          <Path d="M91,38 L109,38 L106,140 L94,140 Z" fill="#ffffff" opacity={0.95} />
          <Path d="M60,38 L72,38 L80,128 L72,132 Z M140,38 L128,38 L120,128 L128,132 Z" fill="#3f34c9" opacity={0.55} />
          <Rect x={38} y={10} width={124} height={32} rx={16} fill="url(#bar)" />
          <Rect x={44} y={13} width={112} height={7} rx={3.5} fill="#ffffff" opacity={0.25} />
          {[70, 100, 130].map((x) => (
            <Path key={x} d={STAR} transform={`translate(${x},26) scale(0.55)`} fill="#ffffff" stroke="#ffffff" strokeWidth={2} strokeLinejoin="round" />
          ))}
          <Circle cx={100} cy={182} r={62} fill="#d97810" />
          <Circle cx={100} cy={178} r={62} fill="url(#gold)" />
          <Circle cx={100} cy={178} r={45} fill="none" stroke="#ef7f2c" strokeWidth={7} opacity={0.85} />
          <Circle cx={100} cy={178} r={41} fill="url(#in)" />
          <Path d={STAR} transform="translate(100,180) scale(1.9)" fill="#fff3c0" stroke="#fff3c0" strokeWidth={3} strokeLinejoin="round" />
          <G clipPath="url(#disc)">
            <G transform="rotate(32 100 178)">
              <AnimatedRect y={90} width={26} height={180} fill="#ffffff" opacity={0.42} animatedProps={shine} />
            </G>
          </G>
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const PLAY: Record<string, () => React.JSX.Element> = {
  confetti: Confetti,
  pulse_wave: PulseWave,
  too_easy: TooEasy,
  mic_drop: MicDrop,
  flatline: Flatline,
  spotlight: Spotlight,
  trophy: TrophyFx,
  medal: Medal,
  // retired before the server swapped them (20261018040000_win_effects_v2)
  signed_off: TooEasy,
  supernova: Spotlight,
};

const s = StyleSheet.create({
  abs: { position: 'absolute' },
  box: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  at: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  bit: { position: 'absolute', left: 0, top: 0, borderRadius: 1 },
  edge: { borderWidth: 3 },
  stamp: {
    borderColor: '#e2465a',
    alignItems: 'center',
    backgroundColor: 'rgba(226,70,90,0.1)',
  },
  stampT: { fontFamily: F.display, letterSpacing: 3, color: RED },
  stampS: {
    fontFamily: F.mono,
    letterSpacing: 2.2,
    color: '#ff8a98',
    marginTop: 2,
  },
  ink: {
    position: 'absolute',
    left: '50%',
    top: 0,
    backgroundColor: '#e2465a',
  },
  words: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  big: { fontFamily: F.display, color: '#ffffff' },
  small: { fontFamily: F.body, color: '#9fb0dc', marginTop: 4 },
});

/** A tiny still sign for each effect in the shop list. */
export function EffectSign({ kind, size }: { kind: EffectKey; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      {kind === 'confetti' ? (
        PAPER.slice(0, 6).map((c, i) => <Path key={i} d={`M${6 + (i % 3) * 11},${8 + Math.floor(i / 3) * 14} l5,2 l-2,6 l-5,-2z`} fill={c} />)
      ) : kind === 'pulse_wave' || kind === 'flatline' ? (
        <>
          <Circle cx={20} cy={20} r={16} fill="none" stroke={kind === 'flatline' ? RED : CYAN} strokeOpacity={0.4} strokeWidth={1.4} />
          <Path
            d={kind === 'flatline' ? 'M3,21 L9,21 L12,15 L15,28 L18,9 L21,21 L37,21' : 'M3,21 L13,21 L16,15 L19,28 L22,9 L25,21 L37,21'}
            stroke={kind === 'flatline' ? RED : CYAN}
            strokeWidth={2.2}
            fill="none"
            strokeLinejoin="round"
          />
        </>
      ) : kind === 'too_easy' ? (
        <>
          <Path d="M5,13 L35,8 L37,27 L7,32 Z" fill="none" stroke="#e2465a" strokeWidth={2} />
          <Path d="M11,20 L31,17 M12,25 L26,23" stroke="#e2465a" strokeWidth={2} strokeLinecap="round" />
        </>
      ) : kind === 'mic_drop' ? (
        <G transform="rotate(-30 20 20)">
          <Rect x={14} y={4} width={12} height={14} rx={6} fill="#c9d3ee" />
          <Rect x={13} y={16} width={14} height={3} rx={1} fill="#e0b44e" />
          <Path d="M15,19 L25,19 L23,36 L17,36 Z" fill="#3a4466" />
        </G>
      ) : kind === 'spotlight' ? (
        <>
          <Path d="M17,3 L23,3 L34,34 L6,34 Z" fill="#fff6d8" opacity={0.55} />
          <Ellipse cx={20} cy={34} rx={15} ry={3} fill="#fff6d8" opacity={0.8} />
        </>
      ) : kind === 'trophy' ? (
        <>
          <Path d="M12,6 L28,6 L27,17 Q20,25 13,17 Z" fill="#f5a524" />
          <Path d="M12,8 Q5,8 7,14 Q9,18 13,17 M28,8 Q35,8 33,14 Q31,18 27,17" fill="none" stroke="#f5a524" strokeWidth={2} />
          <Rect x={18} y={21} width={4} height={7} fill="#f5a524" />
          <Rect x={12} y={28} width={16} height={6} rx={1.5} fill="#3a4466" />
        </>
      ) : (
        <>
          <Path d="M13,3 L27,3 L24,17 L20,20 L16,17 Z" fill="#7a70ff" />
          <Path d="M18.5,3 L21.5,3 L21,18 L19,18 Z" fill="#ffffff" />
          <Circle cx={20} cy={27} r={10} fill="#ffbf2a" />
          <Path d={STAR} transform="translate(20,27.5) scale(0.45)" fill="#fff3c0" />
        </>
      )}
    </Svg>
  );
}
