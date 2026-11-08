import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { makeMutable, useAnimatedStyle, withDelay, withSequence, withTiming } from 'react-native-reanimated';

/** The results page under a win effect: the effect's layer can't reach the page, so it moves it through these. */
const shakeX = makeMutable(0);
const punch = makeMutable(1);

/** A hard knock: the page jolts sideways and settles (Too Easy, Mic Drop). */
export function knock(at: number, amp: number) {
  shakeX.value = withDelay(
    at,
    withSequence(
      withTiming(amp, { duration: 45 }),
      withTiming(-amp * 0.8, { duration: 70 }),
      withTiming(amp * 0.5, { duration: 70 }),
      withTiming(-amp * 0.25, { duration: 70 }),
      withTiming(0, { duration: 90 }),
    ),
  );
}

/** A heartbeat thump: the page swells a little and comes back (Pulse Wave, Flatline). */
export function thump(at: number, to = 1.03) {
  punch.value = withDelay(at, withSequence(withTiming(to, { duration: 90 }), withTiming(1, { duration: 190 })));
}

/** Wrap a results page so win effects can shake it. Transforms only. */
export function WinShake({ children }: { children: ReactNode }) {
  const st = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { scale: punch.value }],
  }));
  return <Animated.View style={[s.fill, st]}>{children}</Animated.View>;
}

const s = StyleSheet.create({ fill: { flex: 1 } });
