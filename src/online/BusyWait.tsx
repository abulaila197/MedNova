import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Text } from '@/components/AppText';

import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/**
 * Busy line (Yazan 2026-11-01, his pick: a banner inside the lobby). While too many players are online, the room stays
 * in its lobby (faces, chat and Leave at hand) and this banner shows its place in line. The match starts by itself when
 * its turn comes; the host can stop waiting.
 */
export function BusyWait({ place, onStop }: { game?: string; place: number; onStop?: () => void }) {
  const pulse = useSharedValue(0.35);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View style={s.wrap} pointerEvents="box-none">
      <View style={s.card} accessibilityLiveRegion="polite">
        <Animated.View style={[s.dot, dot]} />
        <View style={s.txt}>
          <Text style={s.h}>{`Servers are busy · You’re number ${Math.max(1, place)} in line`}</Text>
          <Text style={s.p}>Your match starts by itself when it’s your turn. Keep this screen open.</Text>
        </View>
        {onStop ? (
          <Pressable onPress={onStop} hitSlop={u(8)} accessibilityRole="button" style={s.stop}>
            <Text style={s.stopT}>Stop</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: u(10), alignSelf: 'stretch',
    paddingVertical: u(10), paddingHorizontal: u(12), borderRadius: u(14),
    backgroundColor: 'rgba(16,20,34,0.94)', borderWidth: 1, borderColor: 'rgba(255,196,84,0.55)',
    boxShadow: '0px 8px 20px rgba(0,0,0,0.45)',
  },
  dot: { width: u(9), height: u(9), borderRadius: u(5), backgroundColor: '#ffc454' },
  txt: { flex: 1, minWidth: 0, gap: u(2) },
  h: { color: '#fff', fontFamily: F.bodyBold, fontSize: u(12.5) },
  p: { color: 'rgba(255,255,255,0.72)', fontFamily: F.body, fontSize: u(10.5), lineHeight: u(14) },
  stop: { paddingHorizontal: u(10), paddingVertical: u(6), borderRadius: u(12), borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  stopT: { color: '#fff', fontFamily: F.bodySemi, fontSize: u(11) },
});
