import { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { cancelAnimation, Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/Screen';
import { GAMES } from '@/data/games';
import { GamePage } from '@/features/games/GamePage';
import { Dots, Ring } from '@/features/games/Ring';
import { Planet, wrapOff } from '@/features/games/Planet';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';

const N = GAMES.length;
const mod = (v: number) => ((v % N) + N) % N;
const EASE = Easing.bezier(0.3, 0.7, 0.2, 1);

/** Locked Games page (decision 63): swipe through the 8 games; the planet ring and dots follow. */
export default function Page() {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  // The horizon is drawn under the header and dock (as in the prototype, where the dock covers it).
  const bodyTop = (Platform.OS === 'web' ? u(30) : ins.top) + u(42);
  const pos = useSharedValue(0); // unbounded page position; game = pos mod 8
  const start = useSharedValue(0);
  const [sel, setSel] = useState(0);

  const go = useCallback(
    (target: number) => {
      pos.value = withTiming(target, { duration: 380, easing: EASE });
      setSel(mod(target));
    },
    [pos],
  );
  const jump = useCallback(
    (j: number) => {
      const cur = Math.round(pos.value);
      go(cur + wrapOff(j - cur));
    },
    [go, pos],
  );

  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-10, 10])
    .failOffsetY([-14, 14])
    .onStart(() => {
      cancelAnimation(pos);
      start.value = pos.value;
    })
    .onUpdate((e) => {
      pos.value = start.value - e.translationX / u(282);
    })
    .onEnd((e) => {
      const base = Math.round(start.value);
      const moved = pos.value - base;
      let target = Math.round(pos.value);
      if (Math.abs(moved) > 0.18 || Math.abs(e.velocityX) > 400) target = base + (moved > 0 ? 1 : -1);
      go(target);
    });

  return (
    <Screen tab="games" glow={0} under={<Ring mode={t.mode} top={bodyTop} />}>
      <GestureDetector gesture={pan}>
        <View style={s.fill}>
          {GAMES.map((g, j) => (
            <GamePage key={g.key} game={g} j={j} pos={pos} active={j === sel} />
          ))}
          <Dots pos={pos} onPick={jump} />
          {GAMES.map((g, j) => (
            <Planet key={g.key} k={g.key} j={j} pos={pos} sel={sel} mode={t.mode} onPress={() => jump(j)} />
          ))}
        </View>
      </GestureDetector>
    </Screen>
  );
}

const s = StyleSheet.create({ fill: { flex: 1, overflow: 'hidden' } });
