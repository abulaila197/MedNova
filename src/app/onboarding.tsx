import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { TopInset } from '@/components/StatusMock';
import { Intro } from '@/features/start/Intro';
import { NAVY } from '@/features/start/Sky';
import { useSlides } from '@/features/start/Slides';
import { markOnboarded } from '@/state/start';
import { u, useScreen } from '@/theme/scale';

const LAST = 2;
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

/** Intro, then three swipeable onboarding slides. Always dark. */
export default function Onboarding() {
  const { width: w, height: h } = useScreen();
  const ins = useSafeAreaInsets();
  const [intro, setIntro] = useState(true);
  const pos = useSharedValue(0);
  const start = useSharedValue(0);

  const padTop = (Platform.OS === 'web' ? u(30) : ins.top) + u(14);
  const padBottom = u(22) + ins.bottom;

  const toAuth = useCallback(() => {
    markOnboarded();
    router.replace('/auth');
  }, []);
  const go = useCallback(
    (i: number) => {
      if (i > LAST) return toAuth();
      const n = Math.max(0, i);
      pos.value = withTiming(n, { duration: 380, easing: EASE });
    },
    [pos, toAuth],
  );
  const next = useCallback(() => go(Math.round(pos.value) + 1), [go, pos]);

  // The swipe runs on the UI thread; only leaving for sign-in goes back to React.
  const pan = Gesture.Pan()
    .enabled(!intro)
    .activeOffsetX([-10, 10])
    .failOffsetY([-14, 14])
    .onStart(() => {
      cancelAnimation(pos);
      start.value = pos.value;
    })
    .onUpdate((e) => {
      // a little resistance past the first slide; past the last one the swipe leads to sign-in
      const p = start.value - e.translationX / w;
      pos.value = p < 0 ? p * 0.3 : p;
    })
    .onEnd((e) => {
      const base = Math.round(start.value);
      const moved = pos.value - base;
      let target = Math.round(pos.value);
      if (Math.abs(moved) > 0.16 || Math.abs(e.velocityX) > 400) target = base + (moved > 0 ? 1 : -1);
      if (target > LAST) {
        pos.value = withTiming(LAST, { duration: 200, easing: EASE });
        scheduleOnRN(toAuth);
        return;
      }
      pos.value = withTiming(Math.max(0, target), { duration: 380, easing: EASE });
    });

  const row = useAnimatedStyle(() => ({ transform: [{ translateX: -Math.min(pos.value, LAST + 0.3) * w }] }));
  const slides = useSlides({ w, h, padTop, padBottom, onNext: next, onSkip: toAuth });

  return (
    <View style={[s.root, { backgroundColor: NAVY }]}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ flexDirection: 'row', width: w * 3, height: h }, row]}>{slides}</Animated.View>
      </GestureDetector>
      <View pointerEvents="none" style={s.status}>
        <TopInset color="rgba(238,240,255,0.85)" />
      </View>
      {intro ? <Intro w={w} h={h} onDone={() => setIntro(false)} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  status: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30 },
});
