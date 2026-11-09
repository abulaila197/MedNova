import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Text } from '@/components/AppText';

import { PlayerFace } from '@/features/style/Frame';
import { nth } from '@/match/live';
import type { RaceState } from '@/match/race';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import type { BotRace } from './engine';
import { YOU } from './engine';

/**
 * The rivals' progress pills during a question (G4): each rival's face, and a tick and place once it solves. Wrong
 * guesses never show here (Yazan 2026-11-09): in Diagnostic Pursuit they pop in the chat and go.
 */
export function RivalStrip({ st, race }: { st: RaceState; race: BotRace }) {
  const th = useTheme();
  if (st.phase !== 'case' || !race.plansNow()) return null;
  const rows = st.players.filter((p) => p.user_id !== YOU);
  return (
    <View style={s.row}>
      {rows.map((p) => (
        <View key={p.user_id} style={[s.pill, { backgroundColor: th.panel, borderColor: p.solved ? '#2fbf7a' : th.panelLine }]}>
          <PlayerFace slug={p.character} size={u(20)} userId={p.user_id} still />
          <View style={s.txt}>
            <Text style={[s.name, { color: th.fg }]} numberOfLines={1}>{p.name.split(' ')[0]}</Text>
            {p.solved ? (
              <Animated.Text entering={ZoomIn.duration(200)} style={[s.stat, { color: '#2fbf7a' }]}>✓ {nth(p.item_rank ?? 1)}</Animated.Text>
            ) : (
              <Text style={[s.stat, { color: th.mute }]}>…</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: u(6), marginBottom: u(8), marginRight: u(34) },
  pill: { flexDirection: 'row', alignItems: 'center', gap: u(6), borderWidth: 1, borderRadius: 999, paddingVertical: u(3), paddingLeft: u(3), paddingRight: u(10), maxWidth: u(150) },
  txt: { flexShrink: 1 },
  name: { fontFamily: F.bodySemi, fontSize: u(10.5), lineHeight: u(13) },
  stat: { fontFamily: F.mono, fontSize: u(9.5), lineHeight: u(12) },
});
