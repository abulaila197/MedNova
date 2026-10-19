import { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { cancelAnimation, Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HEADER_H } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { GAMES } from '@/data/games';
import { GamePage } from './GamePage';
import { Dots, Ring } from './Ring';
import { Planet, wrapOff } from './Planet';
import { ChestButton } from '@/features/chests/ChestButton';
import { RoundsButton } from '@/features/rounds/Ribbon';
import { useTheme } from '@/state/app';
import { DESIGN_W, u } from '@/theme/scale';

import { FILL_H } from './fit';

const N = GAMES.length;
const mod = (v: number) => ((v % N) + N) % N;
const EASE = Easing.bezier(0.3, 0.7, 0.2, 1);

/** Locked Games page (decision 63): swipe through the games; the planet ring and dots follow. */
export function GamesScreen() {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  // The horizon is drawn under the header and dock (as in the prototype, where the dock covers it).
  const bodyTop = (Platform.OS === 'web' ? u(30) : ins.top) + HEADER_H;
  const pos = useSharedValue(0); // unbounded page position; game = pos mod N
  const start = useSharedValue(0);
  const [sel, setSel] = useState(0);
  // How much less room the body has than the design (taller dock over the phone's buttons): the lower group lifts by it.
  const [lift, setLift] = useState(0);

  const pick = useCallback((target: number) => setSel(mod(target)), []);
  const go = useCallback(
    (target: number) => {
      // The page (and its neighbours) are rebuilt only once the slide has landed, so building them can't stall it.
      pos.set(withTiming(target, { duration: 380, easing: EASE }, (fin) => fin && scheduleOnRN(pick, target)));
    },
    [pos, pick],
  );
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
      pos.set(start.value - e.translationX / u(DESIGN_W));
    })
    .onEnd((e) => {
      const base = Math.round(start.value);
      const moved = pos.value - base;
      let target = Math.round(pos.value);
      if (Math.abs(moved) > 0.18 || Math.abs(e.velocityX) > 400) target = base + (moved > 0 ? 1 : -1);
      pos.set(withTiming(target, { duration: 380, easing: EASE }, (fin) => fin && scheduleOnRN(pick, target)));
    });

  return (
    <Screen tab="games" glow={0} under={<Ring mode={t.mode} top={bodyTop - lift} />}>
      <GestureDetector gesture={pan}>
        <View style={s.fill} onLayout={(e) => setLift(Math.round(u(FILL_H) - e.nativeEvent.layout.height))}>
          {/* the shown game and two on each side are mounted, so the next page's art is already decoded when a swipe
              lands (2026-10-19, was one each side: building it as the slide ended froze the page) */}
          {GAMES.map((g, j) => (Math.abs(wrapOff(j - sel)) <= 2 ? <GamePage key={g.key} game={g} j={j} pos={pos} active={j === sel} lift={lift} /> : null))}
          <View style={[StyleSheet.absoluteFill, { transform: [{ translateY: -lift }] }]} pointerEvents="box-none">
            <Dots pos={pos} onPick={jump} />
            {GAMES.map((g, j) => (
              <Planet key={g.key} k={g.key} j={j} pos={pos} sel={sel} mode={t.mode} onPress={() => jump(j)} />
            ))}
          </View>
          <ChestButton />
          <RoundsButton />
        </View>
      </GestureDetector>
    </Screen>
  );
}

const s = StyleSheet.create({ fill: { flex: 1, overflow: 'hidden' } });
