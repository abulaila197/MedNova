import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { Circle, Defs, LinearGradient, Stop, Svg } from 'react-native-svg';

import { GAMES } from '@/data/games';
import { u } from '@/theme/scale';
import type { Mode } from '@/theme/tokens';

import { BODY_TOP, DOTS_TOP, RING_CX, RING_CY, RING_R, W } from './fit';
import { wrapOff } from './Planet';

const RING = {
  dark: { line: '#e6deff' },
  light: { line: '#9a5a12' },
};
const H = 615 - BODY_TOP;

/** The big circle horizon the planets sit on: only a hairline that fades toward both edges, so the page background shows below it. */
export function Ring({ mode, top }: { mode: Mode; top: number }) {
  const c = RING[mode];
  return (
    <Svg width={u(W)} height={u(H)} viewBox={`0 0 ${W} ${H}`} style={[s.ring, { top }]} pointerEvents="none">
      <Defs>
        <LinearGradient id={`ln-${mode}`} x1="0" y1="0" x2={W} y2="0" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={c.line} stopOpacity={0} />
          <Stop offset="0.5" stopColor={c.line} stopOpacity={0.95} />
          <Stop offset="1" stopColor={c.line} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Circle cx={RING_CX} cy={RING_CY} r={RING_R} fill="none" stroke={`url(#ln-${mode})`} strokeWidth={2} />
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

/** One swipe dot per game (active one is a 14px pill). */
export function Dots({ pos, onPick }: { pos: SharedValue<number>; onPick: (j: number) => void }) {
  return (
    <View style={s.dots}>
      {Array.from({ length: GAMES.length }, (_, j) => (
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
