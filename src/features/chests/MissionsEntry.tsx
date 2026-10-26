import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { loadChallenges, useChests } from './useChests';

const NAMES = ['Warm-up', 'Full Shift', 'Overtime'];

/** Today's daily missions under Grand Rounds on the Achievements page (Yazan 2026-10-26); opens the Daily missions page. */
export function MissionsEntry() {
  const t = useTheme();
  const c = useChests((x) => x.c);
  useEffect(() => {
    void loadChallenges();
  }, []);
  const step = c?.step ?? 1;
  const names = c?.names ?? NAMES;
  const now = step > 3 ? null : c?.tasks[step - 1];
  const line = !now ? 'All 3 done today. New missions at midnight.' : now.map((x) => (x.k === 'review' ? `reviews ${x.n >= x.of ? 'done' : 'to finish'}` : `${x.n} of ${x.of} ${x.k === 'games' ? 'different games' : x.k}`)).join(', ');
  return (
    <Pressable onPress={() => router.navigate('/challenges' as never)} style={[s.card, { backgroundColor: t.panel, borderColor: t.panelLine }]} accessibilityRole="link" accessibilityLabel="Open daily missions">
      <View style={s.top}>
        <Text style={[s.k, { color: t.kick }]}>DAILY MISSIONS</Text>
        <Text style={[s.k, { color: step > 3 ? t.accent : t.mute }]}>{step > 3 ? 'ALL DONE' : `${step - 1} OF 3 DONE`}</Text>
      </View>
      <Text style={[s.h, { color: t.white }]}>{step > 3 ? 'Daily missions' : names[step - 1]}</Text>
      <Text style={[s.p, { color: t.mute }]}>{c ? line : 'Play different games to earn tokens every day'}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: u(16), paddingHorizontal: u(12), paddingTop: u(9), paddingBottom: u(9), marginTop: u(10), gap: u(3) },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  k: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.3) },
  h: { fontFamily: F.display, fontSize: u(11) },
  p: { fontFamily: F.body, fontSize: u(9) },
});
