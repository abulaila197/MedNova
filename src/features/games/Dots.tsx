import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { GAMES } from '@/data/games';
import { u } from '@/theme/scale';

import { DOTS_Y } from './fit';

const N = GAMES.length;
const HALF = N / 2;

/** Wrap a page offset into [-N/2, N/2), so the games loop round. */
export function wrapOff(v: number) {
  'worklet';
  return ((((v + HALF) % N) + N) % N) - HALF;
}

function Dot({ j, pos, onPick, accent }: { j: number; pos: SharedValue<number>; onPick: (j: number) => void; accent: string }) {
  const a = useAnimatedStyle(() => {
    const on = Math.max(0, 1 - Math.abs(wrapOff(j - pos.value)));
    return { width: u(5 + 13 * on), backgroundColor: on > 0.5 ? accent : `rgba(255,255,255,${0.6 + 0.4 * on})` };
  });
  return (
    <Pressable onPress={() => onPick(j)} hitSlop={{ top: u(8), bottom: u(8), left: u(2), right: u(2) }} accessibilityRole="button" accessibilityLabel={`Game ${j + 1}`}>
      <Animated.View style={[s.dot, a]} />
    </Pressable>
  );
}

/** One swipe dot per game, where the planet arc used to be (2026-10-19); the shown game is a longer cyan pill. */
export function Dots({ pos, onPick, accent }: { pos: SharedValue<number>; onPick: (j: number) => void; accent: string }) {
  return (
    <View style={s.dots} pointerEvents="box-none">
      {Array.from({ length: N }, (_, j) => (
        <Dot key={j} j={j} pos={pos} onPick={onPick} accent={accent} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  dots: { position: 'absolute', left: 0, right: 0, top: u(DOTS_Y - 2.5), height: u(5), flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: u(5) },
  dot: { height: u(5), borderRadius: u(5) },
});
