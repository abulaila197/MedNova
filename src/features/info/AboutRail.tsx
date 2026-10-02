import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { u } from '@/theme/scale';

import { useInfo } from './ui';

/**
 * The thin rail on the right of About (.rail): how far the sun has risen.
 * The dot starts where the reference shows it (38% down) and travels to the bottom as you scroll.
 */
export function AboutRail({ progress }: { progress: SharedValue<number> }) {
  const c = useInfo();
  const h = useSharedValue(0);
  const dot = useAnimatedStyle(() => ({ transform: [{ translateY: h.value * (0.38 + 0.62 * Math.min(1, Math.max(0, progress.value))) - u(4) }] }));
  return (
    <View pointerEvents="none" style={s.rail} onLayout={(e) => (h.value = e.nativeEvent.layout.height)}>
      <LinearGradient colors={c.lt ? ['rgb(207,200,186)', 'rgba(229,131,58,0.7)'] : ['#1c2142', 'rgba(255,196,150,0.6)']} style={s.line} />
      <Animated.View style={[s.dot, dot]} />
    </View>
  );
}

const s = StyleSheet.create({
  // .rail: right 8, top 20 / bottom 30 of the page (y=108..515)
  rail: { position: 'absolute', right: u(8), top: u(20), bottom: u(30), width: u(2) },
  line: { ...StyleSheet.absoluteFill, borderRadius: u(2) },
  dot: {
    position: 'absolute',
    top: 0,
    left: u(-3),
    width: u(8),
    height: u(8),
    borderRadius: u(4),
    backgroundColor: '#ffd7b0',
    shadowColor: '#ffb98a',
    shadowOpacity: 1,
    shadowRadius: u(5),
    shadowOffset: { width: 0, height: 0 },
  },
});
