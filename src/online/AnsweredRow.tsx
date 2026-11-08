import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Text } from '@/components/AppText';

import { PlayerFace } from '@/features/style/Frame';
import { u } from '@/theme/scale';

/** One seat in the row: its face, and whether it has answered this question. */
export type Seat = { user_id: string; character: string; done: boolean; dropped?: boolean };

/**
 * Who has answered (Yazan 2026-11-02, replaces "Locked in. Waiting for N more"): a row of the players' faces, each
 * getting a tick when they answer; the ones still thinking stay faded. No sentence to read.
 */
export function AnsweredRow({ seats, size = 26 }: { seats: Seat[]; size?: number }) {
  const list = seats.filter((p) => !p.dropped);
  if (list.length < 2) return null;
  const d = u(size);
  return (
    <Animated.View entering={FadeIn.duration(200)} style={s.row} accessibilityLabel={`${list.filter((p) => p.done).length} of ${list.length} answered`}>
      {list.map((p) => (
        <View key={p.user_id} style={{ width: d, height: d, opacity: p.done ? 1 : 0.38 }}>
          <PlayerFace slug={p.character} size={d} userId={p.user_id} still />
          {p.done ? (
            <Animated.View entering={ZoomIn.duration(220)} style={[s.tick, { backgroundColor: '#2fbf7a', borderColor: '#0d1738' }]}>
              <Text style={s.tickT}>✓</Text>
            </Animated.View>
          ) : null}
        </View>
      ))}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: u(8), paddingVertical: u(4) },
  tick: { position: 'absolute', right: -u(3), bottom: -u(3), width: u(13), height: u(13), borderRadius: u(7), borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tickT: { color: '#fff', fontSize: u(8), lineHeight: u(10), fontWeight: '800' },
});
