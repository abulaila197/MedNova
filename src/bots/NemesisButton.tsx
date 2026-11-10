import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PlayerFace } from '@/features/style/Frame';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';

import { rivalOfDay, todayWin } from './daily';
import { loadRivals, useRivals } from './memory';

/**
 * The Nemesis button on the Games page (G6), under the chests: the rival of the day's face in the same ring as the
 * other three buttons. A red dot while today's boss is unbeaten; green once beaten, until the page is opened.
 */
export function NemesisButton() {
  const t = useTheme();
  const day = useRivals((x) => todayWin(x.day));
  useFocusEffect(
    useCallback(() => {
      void loadRivals();
    }, []),
  );
  const boss = rivalOfDay();
  return (
    <Pressable onPress={() => router.navigate('/nemesis' as never)} style={[s.btn, { backgroundColor: t.panel, borderColor: t.panelLine }]} accessibilityRole="button" accessibilityLabel={`Nemesis: rival of the day ${boss.bot.name}`}>
      <View style={[s.ring, { borderColor: t.chipLine }]}>
        <PlayerFace slug={boss.bot.character} size={u(19)} still />
      </View>
      {day?.won ? (day.seen ? null : <View style={[s.dot, { backgroundColor: '#5fd38a', borderColor: t.sky }]} />) : <View style={[s.dot, { backgroundColor: t.red, borderColor: t.sky }]} />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { position: 'absolute', right: u(16), top: u(98), width: u(27), height: u(27), borderRadius: u(13.5), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ring: { width: u(22), height: u(22), borderRadius: u(11), borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  dot: { position: 'absolute', right: u(-1), top: u(-1), width: u(7), height: u(7), borderRadius: u(3.5), borderWidth: 1 },
});
