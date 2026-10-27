import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { useSession } from '@/games/shell/session';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';

import { loadWaiting, useInbox } from './useInbox';

/**
 * The Inbox button, first of the four round buttons on the Games page (Yazan 2026-10-27: Inbox, daily reward, Grand
 * Rounds, chests). The red dot shows while a message is unopened or a gift is not collected.
 */
export function InboxButton() {
  const t = useTheme();
  const uid = useSession((x) => x.userId);
  const waiting = useInbox((x) => x.waiting);
  // On every visit, and again when the player signs in or out here.
  useFocusEffect(
    useCallback(() => {
      void loadWaiting();
    }, []),
  );
  useEffect(() => {
    void loadWaiting();
  }, [uid]);
  const line = { stroke: t.accent, strokeWidth: 2.4, fill: 'none', strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  return (
    <Pressable
      onPress={() => router.navigate('/inbox' as never)}
      style={[s.btn, { backgroundColor: t.panel, borderColor: t.panelLine }]}
      accessibilityRole="button"
      accessibilityLabel={waiting ? `Inbox, ${waiting} new` : 'Inbox'}>
      {/* Same face as the other three: a faint ring, an envelope inside. */}
      <Svg width={u(24)} height={u(24)} viewBox="0 0 30 30">
        <Circle cx={15} cy={15} r={13} fill="none" stroke={t.chipLine} strokeWidth={1.6} />
        <G transform="translate(7.5 7.5) scale(0.625)">
          <Path d="M4 6.5 H20 A1 1 0 0 1 21 7.5 V17.5 A1 1 0 0 1 20 18.5 H4 A1 1 0 0 1 3 17.5 V7.5 A1 1 0 0 1 4 6.5 Z" {...line} />
          <Path d="M3.5 7.5 L12 13.5 L20.5 7.5" {...line} />
        </G>
      </Svg>
      {waiting ? <View style={[s.dot, { backgroundColor: t.red, borderColor: t.sky }]} /> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { position: 'absolute', right: u(16), top: u(8), width: u(27), height: u(27), borderRadius: u(13.5), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  // The smaller red dot on all four buttons (Yazan 2026-10-27).
  dot: { position: 'absolute', right: u(-1), top: u(-1), width: u(7), height: u(7), borderRadius: u(3.5), borderWidth: 1 },
});
