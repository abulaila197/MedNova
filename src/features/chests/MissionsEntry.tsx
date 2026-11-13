import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { loadChallenges, missionsLeft, useChests } from './useChests';
import { tr } from '@/i18n';

const NAMES = [tr('Warm-up'), tr('Full Shift'), tr('Overtime')];

/** Today's daily missions under Grand Rounds on the Achievements page (Yazan 2026-10-26); opens the Daily missions page. */
export function MissionsEntry() {
  const t = useTheme();
  const c = useChests((x) => x.c);
  useEffect(() => {
    void loadChallenges();
  }, []);
  const step = c?.step ?? 1;
  const dot = missionsLeft(c);
  const names = c?.names ?? NAMES;
  const now = step > 3 ? null : c?.tasks[step - 1];
  const line = !now ? tr('All 3 done today. New missions at midnight.') : now.map((x) => (x.k === 'review' ? tr('reviews {n}', { n: x.n >= x.of ? tr('done') : tr('to finish') }) : tr('{n} of {of} {n2}', { n: x.n, of: x.of, n2: x.k === 'games' ? tr('different games') : tr(x.k) }))).join(', ');
  return (
    <Pressable onPress={() => router.navigate('/challenges' as never)} style={[s.card, { backgroundColor: t.panel, borderColor: t.panelLine }]} accessibilityRole="link" accessibilityLabel={tr('Open daily missions')}>
      <View style={s.top}>
        <View style={s.kRow}>
          <Text style={[s.k, { color: t.kick }]}>{tr('DAILY MISSIONS')}</Text>
          {dot ? <View style={[s.dot, { backgroundColor: t.red }]} accessibilityLabel={tr('Not done yet')} /> : null}
        </View>
        <Text style={[s.k, { color: step > 3 ? t.accent : t.mute }]}>{step > 3 ? tr('ALL DONE') : tr('{n} OF 3 DONE', { n: step - 1 })}</Text>
      </View>
      <Text style={[s.h, { color: t.white }]}>{step > 3 ? tr('Daily missions') : names[step - 1]}</Text>
      <Text style={[s.p, { color: t.mute }]}>{c ? line : tr('Play different games to earn tokens every day')}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: u(16), paddingHorizontal: u(12), paddingTop: u(9), paddingBottom: u(9), marginTop: u(10), gap: u(3) },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kRow: { flexDirection: 'row', alignItems: 'center', gap: u(6) },
  dot: { width: u(7), height: u(7), borderRadius: u(4) },
  k: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.3) },
  h: { fontFamily: F.display, fontSize: u(11) },
  p: { fontFamily: F.body, fontSize: u(9) },
});
