import { StyleSheet, Text, View } from 'react-native';

import { Face } from '@/games/shell/Face';
import { Kick } from '@/games/shell/ui';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import type { RacePlayer } from './race';

/**
 * Between items in a race match (Riddler, Medicordle, Streak online): the answer, each player's result for it,
 * and when the next one starts. Uses the game's own theme colours, like the offline reveal cards.
 */
export function RaceReveal({ label, answer, players, me, how, next }: { label: string; answer: string; players: RacePlayer[]; me: string; how: (p: RacePlayer) => string; next: string }) {
  const t = useTheme();
  const rows = [...players].filter((p) => !p.dropped).sort((a, b) => (b.item_points ?? 0) - (a.item_points ?? 0));
  return (
    <View style={[s.card, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
      <Kick color={t.accent}>{label}</Kick>
      <Text style={[s.ans, { color: t.white }]}>{answer}</Text>
      <View style={{ gap: u(5) }}>
        {rows.map((p) => (
          <View key={p.user_id} style={s.row}>
            <Face slug={p.character} size={u(20)} />
            <Text style={[s.who, { color: t.fg }]} numberOfLines={1}>{p.user_id === me ? 'You' : p.name}</Text>
            <Text style={[s.how, { color: t.mute }]}>{how(p)}</Text>
            <Text style={[s.pts, { color: p.item_points ? t.white : t.dim }]}>{p.item_points ? `+${p.item_points}` : '0'}</Text>
          </View>
        ))}
      </View>
      <Text style={[s.next, { color: t.mute }]}>{next}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: u(16), padding: u(13), gap: u(7) },
  ans: { fontFamily: F.display, fontSize: u(20), lineHeight: u(24) },
  // Rows stop short of the right edge so the floating talk button (ON22) never covers the points.
  row: { flexDirection: 'row', alignItems: 'center', gap: u(8), marginRight: u(34) },
  who: { flex: 1, fontFamily: F.bodySemi, fontSize: u(12) },
  how: { fontFamily: F.mono, fontSize: u(10.5) },
  pts: { fontFamily: F.mono, fontSize: u(11.5), minWidth: u(36), textAlign: 'right' },
  next: { fontFamily: F.body, fontSize: u(10.5), textAlign: 'center', marginTop: u(2) },
});
