import { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { u } from '@/theme/scale';

/**
 * The connection dot (Yazan 2026-11-02, replaces the "Reconnecting…" line in online games): a small wifi mark in the
 * top corner while a match screen's asks keep failing. Each screen reports under its own key; the dot shows while any
 * of them is down.
 */
const down = new Set<string>();
const subs = new Set<() => void>();
let ver = 0;

export function setNetDown(key: string, isDown: boolean) {
  if (down.has(key) === isDown) return;
  if (isDown) down.add(key);
  else down.delete(key);
  ver += 1;
  subs.forEach((f) => f());
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

export function NetDot() {
  useSyncExternalStore(subscribe, () => ver, () => ver);
  const top = useSafeAreaInsets().top;
  if (!down.size) return null;
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} pointerEvents="none" style={[s.dot, { top: top + u(46) }]} accessibilityLabel="Reconnecting">
      <View style={s.ring}>
        <Svg width={u(13)} height={u(13)} viewBox="0 0 24 24" fill="none" stroke="#ff9b5a" strokeWidth={2.4} strokeLinecap="round">
          <Path d="M2 9a15 15 0 0 1 20 0" opacity={0.45} />
          <Path d="M5.5 12.5a10 10 0 0 1 13 0" opacity={0.7} />
          <Path d="M9 16a5 5 0 0 1 6 0" />
          <Circle cx={12} cy={19.5} r={1.2} fill="#ff9b5a" />
        </Svg>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  dot: { position: 'absolute', right: u(12), zIndex: 50 },
  ring: { width: u(22), height: u(22), borderRadius: u(11), backgroundColor: 'rgba(13,23,56,0.9)', borderWidth: 1.5, borderColor: '#ff9b5a', alignItems: 'center', justifyContent: 'center' },
});
