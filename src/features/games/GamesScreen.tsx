import { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { cancelAnimation, Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/Screen';
import { GAMES } from '@/data/games';
import { GamePage } from './GamePage';
import { Dots, Ring } from './Ring';
import { Planet, wrapOff } from './Planet';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';

const N = GAMES.length;
const mod = (v: number) => ((v % N) + N) % N;
const EASE = Easing.bezier(0.3, 0.7, 0.2, 1);

/** Locked Games page (decision 63): swipe through the games; the planet ring and dots follow. */
export function GamesScreen() {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  // The horizon is drawn under the header and dock (as in the prototype, where the dock covers it).
  const bodyTop = (Platform.OS === 'web' ? u(30) : ins.top) + u(42);
  const pos = useSharedValue(0); // unbounded page position; game = pos mod N
  const start = useSharedValue(0);
  const [sel, setSel] = useState(0);

  const go = useCallback(
    (target: number) => {
      pos.value = withTiming(target, { duration: 380, easing: EASE });
      setSel(mod(target));
    },
    [pos],
  );
  const pick = useCallback((target: number) => setSel(mod(target)), []);
  const jump = useCallback(
    (j: number) => {
      const cur = Math.round(pos.value);
      go(cur + wrapOff(j - cur));
    },
    [go, pos],
  );

  // The swipe runs on the UI thread; only the settled page goes back to React.
  const pan = Gesture.Pan()
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
      pos.value = withTiming(target, { duration: 380, easing: EASE });
      scheduleOnRN(pick, target);
    });

  return (
    <Screen tab="games" glow={0} under={<Ring mode={t.mode} top={bodyTop} />}>
      <GestureDetector gesture={pan}>
        <View style={s.fill}>
          {/* only the shown game and its neighbours are mounted; the rest are off screen anyway */}
          {GAMES.map((g, j) => (Math.abs(wrapOff(j - sel)) <= 2 ? <GamePage key={g.key} game={g} j={j} pos={pos} active={j === sel} /> : null))}
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
