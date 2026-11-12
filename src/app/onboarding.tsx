import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { PhoneColumn } from '@/components/PhoneColumn';
import { TopInset } from '@/components/TopInset';
import { Intro } from '@/features/start/Intro';
import { NAVY } from '@/features/start/Sky';
import { useSlides } from '@/features/start/Slides';
import { startAds } from '@/lib/ads';
import { askPushNow, pushAllowed } from '@/lib/push';
import { markOnboarded } from '@/state/start';
import { TABLET, u, useScreen } from '@/theme/scale';

const LAST = 2;
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

/** Set once the last slide hands over to the permission pop-ups and sign-in (a second swipe does nothing). */
let leaving = false;

/** Intro, then three swipeable onboarding slides. Always dark. */
export default function OnboardingPage() {
  // The logo intro covers the whole screen, also on a tablet where the slides sit in a column.
  const { width, height } = useScreen();
  const [intro, setIntro] = useState(true);
  return (
    <View style={s.page}>
      <PhoneColumn soft>
        <Onboarding intro={intro} />
      </PhoneColumn>
      {intro ? <Intro w={width} h={height} onDone={() => setIntro(false)} /> : null}
    </View>
  );
}

function Onboarding({ intro }: { intro: boolean }) {
  const { width: w, height: h } = useScreen();
  const ins = useSafeAreaInsets();
  const pos = useSharedValue(0);
  const start = useSharedValue(0);

  const padTop = (Platform.OS === 'web' ? u(30) : ins.top) + u(14);
  const padBottom = u(22) + ins.bottom;

  // Permissions (Yazan 2026-11-11): right after the last slide and before sign-in, the phone's own pop-ups, like
  // most apps: notifications, then (iPhone) the ads consent and Apple's tracking question. Each only once.
  const toAuth = useCallback(() => {
    if (leaving) return;
    leaving = true;
    markOnboarded();
    void (async () => {
      try {
        if ((await pushAllowed()) === 'ask') await askPushNow(null);
        await startAds();
      } catch {
        // a refused or failed pop-up never blocks sign-in
      }
      router.replace('/auth');
    })();
  }, []);
  const go = useCallback(
    (i: number) => {
      if (i > LAST) return toAuth();
      const n = Math.max(0, i);
      pos.set(withTiming(n, { duration: 380, easing: EASE }));
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
      pos.set(p < 0 ? p * 0.3 : p);
    })
    .onEnd((e) => {
      const base = Math.round(start.value);
      const moved = pos.value - base;
      let target = Math.round(pos.value);
      if (Math.abs(moved) > 0.16 || Math.abs(e.velocityX) > 400) target = base + (moved > 0 ? 1 : -1);
      if (target > LAST) {
        pos.set(withTiming(LAST, { duration: 200, easing: EASE }));
        scheduleOnRN(toAuth);
        return;
      }
      pos.set(withTiming(Math.max(0, target), { duration: 380, easing: EASE }));
    });

  const row = useAnimatedStyle(() => ({ transform: [{ translateX: -Math.min(pos.value, LAST + 0.3) * w }] }));
  const slides = useSlides({ w, h, padTop, padBottom, onNext: next, onSkip: toAuth });

  return (
    <View style={[s.root, { backgroundColor: TABLET ? undefined : NAVY }]}>
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ flexDirection: 'row', width: w * 3, height: h }, row]}>{slides}</Animated.View>
      </GestureDetector>
      <View pointerEvents="none" style={s.status}>
        <TopInset />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: NAVY },
  root: { flex: 1, overflow: 'hidden' },
  status: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30 },
});
