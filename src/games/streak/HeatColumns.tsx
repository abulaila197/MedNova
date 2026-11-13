import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/AppText';
import { YOU } from '@/bots/race/engine';
import { PlayerFace } from '@/features/style/Frame';
import type { RacePlayer } from '@/match/race';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { heatColors, SEGMENTS } from './HeatBoard';
import { tr } from '@/i18n';

/**
 * The rivals' heat columns (G4, Yazan 2026-11-09): a small tube per rival that rises with its streak and crashes when
 * the streak breaks. They move at the reveal, when everyone's answers show; while a question runs a dot shows who
 * has answered.
 */
export function HeatColumns({ players, reveal }: { players: RacePlayer[]; reveal: boolean }) {
  const rivals = players.filter((p) => p.user_id !== YOU);
  return (
    <View style={s.row}>
      {rivals.map((p) => (
        <Column key={p.user_id} p={p} reveal={reveal} />
      ))}
    </View>
  );
}

function Column({ p, reveal }: { p: RacePlayer; reveal: boolean }) {
  const t = useTheme();
  const hc = heatColors();
  const lit = Math.min(p.streak, SEGMENTS);
  // A crash: the column flashes red and shakes when a streak of 2 or more breaks.
  const before = useRef(p.streak);
  const shake = useSharedValue(0);
  const flash = useSharedValue(0);
  useEffect(() => {
    if (p.streak === 0 && before.current >= 2) {
      shake.value = withSequence(withTiming(-3, { duration: 50 }), withTiming(3, { duration: 70 }), withTiming(-2, { duration: 60 }), withTiming(0, { duration: 60 }));
      flash.value = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 700 }));
    }
    before.current = p.streak;
  }, [p.streak, shake, flash]);
  const moving = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const red = useAnimatedStyle(() => ({ opacity: flash.value }));
  const answered = !reveal && p.done;
  return (
    <Animated.View style={[s.col, moving]}>
      <View>
        <PlayerFace slug={p.character} size={u(20)} userId={p.user_id} still />
        {answered ? <View style={[s.dot, { backgroundColor: t.accent, borderColor: t.panel }]} /> : null}
      </View>
      <View style={[s.tube, { borderColor: t.panelLine, backgroundColor: t.panel }]} accessibilityLabel={tr('{name}: streak {streak}', { name: p.name, streak: p.streak })}>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <View key={i} style={[s.seg, { backgroundColor: i < lit ? (i >= SEGMENTS - 3 ? hc.hot : t.accent) : hc.segOff }]} />
        ))}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.crash, { backgroundColor: hc.bad }, red]} />
      </View>
      <Text style={[s.n, { color: p.streak ? t.white : t.dim }]}>{p.streak}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: u(8), marginRight: u(34) },
  col: { alignItems: 'center', gap: u(3), width: u(24) },
  dot: { position: 'absolute', right: -u(2), bottom: -u(2), width: u(8), height: u(8), borderRadius: u(4), borderWidth: 1.5 },
  tube: { width: u(10), borderWidth: 1, borderRadius: u(4), padding: u(1.5), gap: u(1.5), flexDirection: 'column-reverse', overflow: 'hidden' },
  seg: { height: u(3), borderRadius: u(1) },
  crash: { borderRadius: u(4) },
  n: { fontFamily: F.mono, fontSize: u(9) },
});
