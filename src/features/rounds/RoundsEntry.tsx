import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { Beat } from './Ribbon';
import { loadRounds, readyOf, useRoundsStore } from './useRounds';

/** This week's Grand Rounds at the top of the Achievements page: the same heartbeat line, changing every week. */
export function RoundsEntry() {
  const t = useTheme();
  const r = useRoundsStore((x) => x.r);
  useEffect(() => {
    void loadRounds();
  }, []);
  if (!r) return null;
  const ready = readyOf(r).length > 0;
  return (
    <Pressable onPress={() => router.navigate('/rounds' as never)} style={[s.card, { backgroundColor: t.panel, borderColor: ready ? t.accent : t.panelLine }]} accessibilityRole="link" accessibilityLabel="Open Grand Rounds">
      <View style={s.top}>
        <Text style={[s.k, { color: t.kick }]}>THIS WEEK</Text>
        <Text style={[s.k, { color: ready ? t.accent : t.mute }]}>{r.claimed ? 'STAMPED' : ready ? 'READY TO COLLECT' : `${r.stamps.length} WEEK${r.stamps.length === 1 ? '' : 'S'} DONE`}</Text>
      </View>
      <Beat r={r} more={false} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: u(16), paddingHorizontal: u(12), paddingTop: u(9), paddingBottom: u(7), marginTop: u(14), gap: u(4) },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  k: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.3) },
});
