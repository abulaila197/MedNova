import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Circle, Defs, RadialGradient, Stop, Svg } from 'react-native-svg';

import { u } from '@/theme/scale';
import type { Mode } from '@/theme/tokens';

import { BODY_TOP, DOTS_TOP, RING_CX, RING_CY, RING_R, W } from './fit';
import { wrapOff } from './Planet';

const RING = {
  dark: { solid: '#10132a', c1: '#8f75ff', o1: 0.38, c3: 'rgb(21,25,51)', stroke: 'rgba(201,184,255,0.5)' },
  light: { solid: '#f3efe6', c1: '#e9bf4f', o1: 0.4, c3: 'rgb(251,249,244)', stroke: 'rgba(184,116,31,0.5)' },
};
const H = 615 - BODY_TOP;

/** The big circle horizon the planets sit on. */
export function Ring({ mode, top }: { mode: Mode; top: number }) {
  const c = RING[mode];
  return (
    <Svg width={u(W)} height={u(H)} viewBox={`0 0 ${W} ${H}`} style={[s.ring, { top }]} pointerEvents="none">
      <Defs>
        <RadialGradient id={`hz-${mode}`} cx={RING_CX} cy={RING_CY - RING_R} r={2 * RING_R} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={c.c1} stopOpacity={c.o1} />
          <Stop offset="0.22" stopColor={c.c3} stopOpacity={0.55} />
          <Stop offset="1" stopColor={c.c3} stopOpacity={0.55} />
        </RadialGradient>
      </Defs>
      <Circle cx={RING_CX} cy={RING_CY} r={RING_R} fill={c.solid} />
      <Circle cx={RING_CX} cy={RING_CY} r={RING_R} fill={`url(#hz-${mode})`} stroke={c.stroke} strokeWidth={1.1} />
    </Svg>
  );
}

function Dot({ j, pos, onPick }: { j: number; pos: SharedValue<number>; onPick: (j: number) => void }) {
  const a = useAnimatedStyle(() => {
    const on = Math.max(0, 1 - Math.abs(wrapOff(j - pos.value)));
    return { width: u(4 + 10 * on), backgroundColor: `rgba(255,255,255,${0.3 + 0.7 * on})` };
  });
  return (
    <Pressable onPress={() => onPick(j)} hitSlop={{ top: u(8), bottom: u(8), left: u(2), right: u(2) }} accessibilityRole="button" accessibilityLabel={`Game ${j + 1}`}>
      <Animated.View style={[s.dot, a]} />
    </Pressable>
  );
}

/** The 8 swipe dots (active one is a 14px pill). */
export function Dots({ pos, onPick }: { pos: SharedValue<number>; onPick: (j: number) => void }) {
  return (
    <View style={s.dots}>
      {Array.from({ length: 8 }, (_, j) => (
        <Dot key={j} j={j} pos={pos} onPick={onPick} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  ring: { position: 'absolute', left: 0 },
  dots: { position: 'absolute', left: 0, right: 0, top: u(DOTS_TOP - BODY_TOP), height: u(4), flexDirection: 'row', justifyContent: 'center', gap: u(4) },
  dot: { height: u(4), borderRadius: u(4) },
});
