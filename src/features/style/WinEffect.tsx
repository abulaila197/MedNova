import { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { Text } from '@/components/AppText';
import { PulseStar } from '@/components/PulseStar';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import type { EffectKey } from './catalog';
import { useLook, wantLooks } from './useStyle';

const LONG = 2600;
const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);

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
    }, LONG);
    return () => clearTimeout(id);
  }, [k, onDone]);
  if (!k || !on) return null;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => setOn(false)}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {k === 'confetti' ? <Confetti /> : k === 'pulse_wave' ? <PulseWave /> : k === 'signed_off' ? <SignedOff /> : <Supernova />}
      </View>
    </Modal>
  );
}

/** 0 -> 1 over the effect, once (Reduce Motion: straight to the end, held, then gone). */
function useRun(ms = LONG - 200) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 0.6 : 0);
  useEffect(() => {
    if (!reduce) p.value = withTiming(1, { duration: ms, easing: Easing.linear });
  }, [ms, p, reduce]);
  return p;
}

/** Fades the whole layer in fast and out at the end. */
function useLayer(p: SharedValue<number>) {
  return useAnimatedStyle(() => ({ opacity: p.value < 0.08 ? p.value / 0.08 : p.value > 0.82 ? Math.max(0, (1 - p.value) / 0.18) : 1 }));
}

const PAPER = ['#f2cc68', '#4fc8ff', '#c73646', '#9be3b0', '#e5833a', '#c9b8ff', '#fff6d6'];

function Confetti() {
  const { width, height } = useWindowDimensions();
  const p = useRun();
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
  const layer = useLayer(p);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, layer]}>
      {bits.map((b, i) => (
        <Bit key={i} b={b} p={p} width={width} height={height} />
      ))}
    </Animated.View>
  );
}

function Bit({ b, p, width, height }: { b: { x: number; drift: number; delay: number; spin: number; w: number; c: string }; p: SharedValue<number>; width: number; height: number }) {
  const st = useAnimatedStyle(() => {
    const q = Math.max(0, Math.min(1, (p.value - b.delay) / (1 - b.delay)));
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

function PulseWave() {
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  const p = useRun();
  const layer = useLayer(p);
  const W = 300;
  const d = 'M0,50 L95,50 L110,50 L120,38 L130,50 L140,50 L150,8 L162,92 L174,50 L190,50 L200,42 L212,50 L300,50';
  const len = 520;
  const line = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - Math.min(1, p.value / 0.45)) }));
  const ring = useAnimatedProps(() => {
    const q = Math.max(0, (p.value - 0.3) / 0.7);
    return { r: 10 + q * 260, strokeOpacity: 0.7 * (1 - q) };
  });
  const ring2 = useAnimatedProps(() => {
    const q = Math.max(0, (p.value - 0.45) / 0.55);
    return { r: 10 + q * 220, strokeOpacity: 0.5 * (1 - q) };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.mid, layer]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <ACircle cx={width / 2} cy={height / 2} fill="none" stroke={t.accent} strokeWidth={3} animatedProps={ring} />
        <ACircle cx={width / 2} cy={height / 2} fill="none" stroke={t.gradA} strokeWidth={2} animatedProps={ring2} />
      </Svg>
      <Svg width={width} height={(width * 100) / W} viewBox={`0 0 ${W} 100`}>
        <APath d={d} stroke={t.accent} strokeWidth={3.2} fill="none" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={len} animatedProps={line} />
      </Svg>
    </Animated.View>
  );
}

function SignedOff() {
  const p = useRun();
  const layer = useLayer(p);
  const st = useAnimatedStyle(() => {
    const q = Math.min(1, p.value / 0.16);
    return { transform: [{ scale: 2.2 - 1.2 * q * q }, { rotate: '-12deg' }], opacity: q };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.mid, layer]}>
      <Animated.View style={[s.stamp, st]}>
        <Text style={s.stampT}>DISCHARGED</Text>
        <Text style={s.stampS}>WINNER · SIGNED OFF</Text>
      </Animated.View>
    </Animated.View>
  );
}

function Supernova() {
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  const p = useRun();
  const layer = useLayer(p);
  const star = useAnimatedStyle(() => {
    const q = Math.min(1, p.value / 0.35);
    return { transform: [{ scale: 0.2 + 1.3 * Math.sin((q * Math.PI) / 2) }, { rotate: `${q * 45}deg` }] };
  });
  const flash = useAnimatedStyle(() => ({ opacity: p.value < 0.3 ? 0 : Math.max(0, 0.55 - (p.value - 0.3) * 1.2) }));
  const rays = useMemo(() => Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2), []);
  const burst = useAnimatedProps(() => {
    const q = Math.max(0, (p.value - 0.28) / 0.72);
    return { strokeDashoffset: -q * 260, strokeOpacity: 1 - q };
  });
  const cx = width / 2;
  const cy = height / 2;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.mid, layer]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.mode === 'light' ? '#fff3d6' : '#d9f3ff' }, flash]} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {rays.map((a, i) => (
          <APath
            key={i}
            d={`M${cx + Math.cos(a) * 40},${cy + Math.sin(a) * 40} L${cx + Math.cos(a) * 300},${cy + Math.sin(a) * 300}`}
            stroke={i % 2 ? t.gradA : t.accent}
            strokeWidth={i % 2 ? 1.5 : 2.5}
            strokeLinecap="round"
            strokeDasharray="60 400"
            animatedProps={burst}
          />
        ))}
      </Svg>
      <Animated.View style={star}>
        <PulseStar width={u(130)} height={u(130)} light={t.mode === 'light'} glow={1} />
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  mid: { alignItems: 'center', justifyContent: 'center' },
  bit: { position: 'absolute', left: 0, top: 0, borderRadius: 1 },
  stamp: { borderWidth: u(4), borderColor: '#c73646', borderRadius: u(10), paddingHorizontal: u(18), paddingVertical: u(8), alignItems: 'center', backgroundColor: 'rgba(199,54,70,0.08)' },
  stampT: { fontFamily: F.display, fontSize: u(34), letterSpacing: u(3), color: '#c73646' },
  stampS: { fontFamily: F.mono, fontSize: u(9), letterSpacing: u(2.4), color: '#c73646', marginTop: u(2) },
});

/** A tiny still sign for each effect in the shop list. */
export function EffectSign({ kind, size }: { kind: EffectKey; size: number }) {
  const t = useTheme();
  if (kind === 'supernova') return <PulseStar width={size} height={size} light={t.mode === 'light'} glow={0.6} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      {kind === 'confetti'
        ? PAPER.slice(0, 6).map((c, i) => <Path key={i} d={`M${6 + (i % 3) * 11},${8 + Math.floor(i / 3) * 14} l5,2 l-2,6 l-5,-2z`} fill={c} />)
        : kind === 'pulse_wave'
          ? [
              <Circle key="c" cx={20} cy={20} r={16} fill="none" stroke={t.accent} strokeOpacity={0.4} strokeWidth={1.4} />,
              <Path key="p" d="M3,21 L13,21 L16,15 L19,28 L22,9 L25,21 L37,21" stroke={t.accent} strokeWidth={2} fill="none" strokeLinejoin="round" />,
            ]
          : [
              <Path key="r" d="M5,13 L35,8 L37,27 L7,32 Z" fill="none" stroke="#c73646" strokeWidth={2} />,
              <Path key="l" d="M11,20 L31,17 M12,25 L26,23" stroke="#c73646" strokeWidth={2} strokeLinecap="round" />,
            ]}
    </Svg>
  );
}
