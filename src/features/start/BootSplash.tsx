import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useScreen } from '@/theme/scale';

const NOVA = require('@/assets/images/splash-nova.png');
// The picture is 1200 x 504 with the lettering across 1120 px of it.
const ART_W = 1120 / 1200;
const ART_AR = 504 / 1200;

/**
 * The NOVA splash, drawn by the app (2026-10-19, Yazan: the logo must fill about 80% of the width). Android 12+
 * squeezes the phone's own splash picture into a small circle, so that one is now plain black (app.json) and this
 * takes over the moment the app starts, then fades away once `hide` is true.
 */
export function BootSplash({ hide }: { hide: boolean }) {
  const { width } = useScreen();
  const [gone, setGone] = useState(false);
  const o = useSharedValue(1);
  useEffect(() => {
    if (hide) o.value = withTiming(0, { duration: 300 }, (fin) => fin && scheduleOnRN(setGone, true));
  }, [hide, o]);
  const fade = useAnimatedStyle(() => ({ opacity: o.value }));
  if (gone) return null;
  const w = (width * 0.8) / ART_W;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.root, fade]} pointerEvents={hide ? 'none' : 'auto'} onLayout={() => void SplashScreen.hideAsync()}>
      <Image source={NOVA} style={{ width: w, height: w * ART_AR }} contentFit="contain" transition={0} />
    </Animated.View>
  );
}

const s = StyleSheet.create({ root: { backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', zIndex: 50 } });
