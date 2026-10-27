import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';

import { openDaily, useDaily } from './DailyHost';

/**
 * The daily reward button under the Inbox button on the Games page (Yazan 2026-10-26, moved 2026-10-27): opens the daily pop-up, where
 * today's reward can be collected if it wasn't yet. A dot shows while it waits.
 */
export function DailyButton() {
  const t = useTheme();
  const ready = useDaily((x) => x.ready);
  const line = { stroke: t.accent, strokeWidth: 2.4, fill: 'none', strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  return (
    <Pressable onPress={openDaily} style={[s.btn, { backgroundColor: t.panel, borderColor: t.panelLine }]} accessibilityRole="button" accessibilityLabel={ready ? 'Daily reward, ready to collect' : 'Daily reward'}>
      {/* Same face as the Grand Rounds and chest buttons: a faint ring, a gift box inside. */}
      <Svg width={u(24)} height={u(24)} viewBox="0 0 30 30">
        <Circle cx={15} cy={15} r={13} fill="none" stroke={t.chipLine} strokeWidth={1.6} />
        <G transform="translate(7.5 7.5) scale(0.625)">
          <Path d="M4.5 10.5 H19.5 V19.5 A1 1 0 0 1 18.5 20.5 H5.5 A1 1 0 0 1 4.5 19.5 Z" {...line} />
          <Path d="M3 7 H21 V10.5 H3 Z" {...line} />
          <Path d="M12 7 V20.5" {...line} />
          <Path d="M12 7 C10 3.5 6.5 4 7.5 6 C8 7 10 7 12 7 C14 7 16 7 16.5 6 C17.5 4 14 3.5 12 7 Z" {...line} />
        </G>
      </Svg>
      {ready ? <View style={[s.dot, { backgroundColor: t.red, borderColor: t.sky }]} /> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  // Second of the four, under Inbox (top 8), 35 apart like the rest (Yazan 2026-10-27).
  btn: { position: 'absolute', right: u(16), top: u(43), width: u(27), height: u(27), borderRadius: u(13.5), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', right: u(-1), top: u(-1), width: u(7), height: u(7), borderRadius: u(3.5), borderWidth: 1 },
});
