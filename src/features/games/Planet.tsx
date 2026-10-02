import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Circle, Defs, RadialGradient, Stop, Svg } from 'react-native-svg';

import { u } from '@/theme/scale';
import type { Mode } from '@/theme/tokens';

import { RING_CX, RING_CY, RING_R, SLOT_ANGLE, SLOT_OFF, SLOT_OPACITY, SLOT_SIZE } from './fit';
import { Glyph } from './Glyph';

const PAL = {
  dark: {
    bg: ['#3b4180', '#171b3a', '#0a0c1e'], mid: 0.58, edge: 'rgba(255,255,255,0.14)',
    inset: [0, 0, 0, 0.5], insetSel: [0, 0, 0, 0.4], drop: { c: [0, 0, 0, 0.9], blur: 18, spread: 6 },
    halo: [143, 117, 255],
  },
  light: {
    bg: ['#ffffff', '#f2ece0', '#d9cfbb'], mid: 0.55, edge: 'rgba(40,36,28,0.12)',
    inset: [120, 95, 40, 0.18], insetSel: [0, 0, 0, 0.4], drop: { c: [80, 60, 20, 0.45], blur: 16, spread: 8 },
    halo: [233, 191, 79],
  },
};
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;
const P = 40; // room around the planet for its shadow and glow

/** Wrap a ring offset into [-4, 4). */
export function wrapOff(v: number) {
  'worklet';
  return ((((v + 4) % 8) + 8) % 8) - 4;
}

/** One glyph planet on the ring; it rides along the curve as the selected game changes. */
export function Planet({ k, j, pos, sel, mode, onPress }: { k: string; j: number; pos: SharedValue<number>; sel: number; mode: Mode; onPress: () => void }) {
  const p = PAL[mode];
  const off0 = ((((j - sel + 4) % 8) + 8) % 8) - 4;
  const d = SLOT_SIZE[off0 + 4]; // settled diameter
  const isSel = off0 === 0;
  const id = `${mode}-${k}`;

  const box = useAnimatedStyle(() => {
    const off = wrapOff(j - pos.value);
    const a = (interpolate(off, SLOT_OFF, SLOT_ANGLE) * Math.PI) / 180;
    const size = interpolate(off, SLOT_OFF, SLOT_SIZE);
    const x = RING_CX + RING_R * Math.sin(a);
    const y = RING_CY - RING_R * Math.cos(a) - 2;
    return {
      opacity: interpolate(off, SLOT_OFF, SLOT_OPACITY),
      transform: [{ translateX: u(x - d / 2) }, { translateY: u(y - d / 2) }, { scale: size / d }],
    };
  });
  const selA = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - Math.abs(wrapOff(j - pos.value))) }));
  const dropA = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.abs(wrapOff(j - pos.value))) }));

  // outer drop shadow (box-shadow 0 8px blur -spread)
  const rs = d / 2 - p.drop.spread;
  const sg = p.drop.blur / 2;
  const dropPeak = p.drop.c[3] * (1 - Math.exp(-(rs * rs) / (2 * sg * sg)));
  const dropR = rs + 2 * sg;
  // selected halo: 0 0 0 5px (.3) + 0 0 34px (.75)
  const gR = d / 2 + 34;
  const gPeak = 0.75 * (1 - Math.exp(-((d / 2) ** 2) / (2 * 17 * 17)));
  // inset shadow -4px -6px 10px
  const ins = isSel ? p.insetSel : p.inset;
  const r = d / 2;
  const iR = r + 10;
  const iStart = Math.max(0, r - 10) / iR;
  const bw = isSel ? 2 : 1;
  const gpx = u(0.58 * (d - 2 * bw));

  return (
    <Animated.View style={[s.planet, { width: u(d), height: u(d) }, box]}>
      <Animated.View style={[s.pad, { left: u(-P), top: u(-P), width: u(d + 2 * P), height: u(d + 2 * P) }, dropA]} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox={`${-P} ${-P} ${d + 2 * P} ${d + 2 * P}`}>
          <Defs>
            <RadialGradient id={`dr-${id}`} cx={r} cy={r + 8} r={dropR} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={rgb(p.drop.c)} stopOpacity={dropPeak} />
              <Stop offset={rs / dropR} stopColor={rgb(p.drop.c)} stopOpacity={dropPeak * 0.5} />
              <Stop offset="1" stopColor={rgb(p.drop.c)} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={r} cy={r + 8} r={dropR} fill={`url(#dr-${id})`} />
        </Svg>
      </Animated.View>
      <Animated.View style={[s.pad, { left: u(-P), top: u(-P), width: u(d + 2 * P), height: u(d + 2 * P) }, selA]} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox={`${-P} ${-P} ${d + 2 * P} ${d + 2 * P}`}>
          <Defs>
            <RadialGradient id={`gl-${id}`} cx={r} cy={r} r={gR} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={rgb(p.halo)} stopOpacity={gPeak} />
              <Stop offset={r / gR} stopColor={rgb(p.halo)} stopOpacity={0.375} />
              <Stop offset="1" stopColor={rgb(p.halo)} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={r} cy={r} r={gR} fill={`url(#gl-${id})`} />
          <Circle cx={r} cy={r} r={r + 2.5} fill="none" stroke={rgb(p.halo)} strokeOpacity={0.3} strokeWidth={5} />
        </Svg>
      </Animated.View>
      <Svg width="100%" height="100%" viewBox={`0 0 ${d} ${d}`} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`bg-${id}`} cx={0.34 * d} cy={0.28 * d} r={0.9767 * d} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={p.bg[0]} />
            <Stop offset={p.mid} stopColor={p.bg[1]} />
            <Stop offset="1" stopColor={p.bg[2]} />
          </RadialGradient>
          <RadialGradient id={`in-${id}`} cx={r - 4} cy={r - 6} r={iR} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={rgb(ins)} stopOpacity={0} />
            <Stop offset={iStart} stopColor={rgb(ins)} stopOpacity={0} />
            <Stop offset={r / iR} stopColor={rgb(ins)} stopOpacity={ins[3] * 0.5} />
            <Stop offset="1" stopColor={rgb(ins)} stopOpacity={ins[3]} />
          </RadialGradient>
        </Defs>
        <Circle cx={r} cy={r} r={r} fill={`url(#bg-${id})`} />
        <Circle cx={r} cy={r} r={r} fill={`url(#in-${id})`} />
        <Circle cx={r} cy={r} r={r - 0.5} fill="none" stroke={p.edge} strokeWidth={1} />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, s.round, { borderWidth: u(2), borderColor: '#ffffff' }, selA]} pointerEvents="none" />
      <View style={s.center} pointerEvents="none">
        <Glyph k={k} mode={mode} px={gpx} id={id} />
      </View>
      <Pressable style={[StyleSheet.absoluteFill, s.round]} onPress={onPress} hitSlop={u(4)} accessibilityRole="button" accessibilityLabel={`Show game ${j + 1}`} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  planet: { position: 'absolute', left: 0, top: 0 },
  pad: { position: 'absolute' },
  round: { borderRadius: 999 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
