import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { REVIEW } from './data';
import { useLearnColors } from './palette';

/** Today's review flash card: the disease on the front, one dossier field on the back. */
export function FlipCard({ flipped, onPress }: { flipped: boolean; onPress: () => void }) {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withTiming(flipped ? 180 : 0, { duration: 600, easing: Easing.bezier(0.3, 0.8, 0.3, 1) });
  }, [flipped, r]);
  const front = useAnimatedStyle(() => ({
    opacity: r.value < 90 ? 1 : 0,
    transform: [{ perspective: u(900) }, { rotateY: `${-r.value}deg` }],
  }));
  const back = useAnimatedStyle(() => ({
    opacity: r.value >= 90 ? 1 : 0,
    transform: [{ perspective: u(900) }, { rotateY: `${180 - r.value}deg` }],
  }));
  const face = [s.face, { borderColor: c.cardLine, boxShadow: c.cardShadow }];
  const bg = <LinearGradient colors={[c.cardA, c.cardB]} style={[StyleSheet.absoluteFill, { borderRadius: u(19) }]} />;
  return (
    <Pressable onPress={onPress} style={s.flip} accessibilityRole="button" accessibilityLabel={flipped ? 'Show the disease' : 'Show one fact from its dossier'}>
      <Animated.View style={[face, front]} pointerEvents="none">
        {bg}
        <View style={s.src}>
          <View style={[s.dot, { backgroundColor: c.miss }]} />
          <Text style={[s.srcT, { color: c.mute }]}>Missed in</Text>
          <Text style={[s.srcT, s.srcB, { color: c.strong }]}>{REVIEW.game}</Text>
          <Text style={[s.srcT, { color: c.mute }]}>· {REVIEW.when}</Text>
        </View>
        <View style={s.mid}>
          <Text style={[s.big, { color: t.fg }]}>{REVIEW.first}</Text>
          <Text style={[s.big, { color: t.accent, fontFamily: F.displayItalic }]}>{REVIEW.em}</Text>
        </View>
        <Text style={[s.hint, { color: c.mute }]}>Tap for one fact from its dossier</Text>
      </Animated.View>
      <Animated.View style={[face, back]} pointerEvents="none">
        {bg}
        <Text style={[s.fld, { color: t.accent }]}>{REVIEW.field.label.toUpperCase()}</Text>
        <Text style={[s.fact, { color: t.fg }]}>{REVIEW.field.text}</Text>
        <View style={s.foot}>
          <View style={s.dots}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={[s.ld, i === REVIEW.dot ? { width: u(14), backgroundColor: t.accent } : { backgroundColor: c.dotOff }]} />
            ))}
          </View>
          <Text style={[s.hint, { color: c.mute }]}>From the dossier</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  flip: { flex: 1, minHeight: u(220) },
  face: { ...StyleSheet.absoluteFill, borderRadius: u(20), borderWidth: 1, padding: u(16), gap: u(7), backfaceVisibility: 'hidden' },
  src: { flexDirection: 'row', alignItems: 'center', gap: u(6) },
  dot: { width: u(6), height: u(6), borderRadius: u(6) },
  srcT: { fontFamily: F.body, fontSize: u(10), lineHeight: u(12) },
  srcB: { fontFamily: F.bodySemi },
  mid: { flex: 1, justifyContent: 'center' },
  big: { fontFamily: F.display, fontSize: u(38), lineHeight: u(38), letterSpacing: u(-0.76) },
  hint: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(11) },
  fld: { fontFamily: F.mono, fontSize: u(9), lineHeight: u(12), letterSpacing: u(1.62) },
  fact: { fontFamily: F.display, fontSize: u(19), lineHeight: u(24.7) },
  foot: { marginTop: 'auto', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dots: { flexDirection: 'row', gap: u(4) },
  ld: { width: u(5), height: u(5), borderRadius: u(5) },
});
