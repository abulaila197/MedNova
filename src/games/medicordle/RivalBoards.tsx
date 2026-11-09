import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Text } from '@/components/AppText';
import { YOU, type BotRace } from '@/bots/race/engine';
import { PlayerFace } from '@/features/style/Frame';
import { nth } from '@/match/live';
import type { RaceState } from '@/match/race';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { MAX_ROWS } from './core';
import { slideColors } from './palette';

/**
 * The rivals' mini boards (G4, Yazan 2026-11-09): colours only, never letters, filling row by row as each rival plays a
 * real word. A rival's board gets a green edge and its place once it solves.
 */
export function RivalBoards({ st, race, t, len }: { st: RaceState; race: BotRace; t: number; len: number }) {
  const th = useTheme();
  const c = slideColors(th.mode);
  const plans = race.plansNow();
  const start = race.startOfNow();
  if (st.phase !== 'case' || !plans || start == null) return null;
  const el = t - start;
  const cell = Math.max(u(3.5), Math.min(u(7), u(64) / len));
  const colour = { g: c.ok, y: c.near, x: c.off } as Record<string, string>;
  return (
    <View style={s.row}>
      {st.players
        .filter((p) => p.user_id !== YOU)
        .map((p) => {
          const rows = (plans[p.user_id]?.rows ?? []).filter((r) => r.at <= el);
          return (
            <View key={p.user_id} style={[s.card, { borderColor: p.solved ? c.ok : c.line, backgroundColor: c.glass }]}>
              <View style={s.head}>
                <PlayerFace slug={p.character} size={u(16)} userId={p.user_id} still />
                <Text style={[s.name, { color: th.fg }]} numberOfLines={1}>{p.name.split(' ')[0]}</Text>
                {p.solved ? <Text style={[s.place, { color: c.ok }]}>{nth(p.item_rank ?? 1)}</Text> : null}
              </View>
              <View style={{ gap: u(1.5) }}>
                {Array.from({ length: MAX_ROWS }, (_, i) => (
                  <View key={i} style={s.cells}>
                    {Array.from({ length: len }, (_, j) => {
                      const ch = rows[i]?.colours[j];
                      return ch ? (
                        <Animated.View key={j} entering={ZoomIn.duration(180).delay(j * 40)} style={{ width: cell, height: cell, borderRadius: 1.5, backgroundColor: colour[ch] }} />
                      ) : (
                        <View key={j} style={{ width: cell, height: cell, borderRadius: 1.5, borderWidth: 0.5, borderColor: c.line }} />
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          );
        })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: u(6), justifyContent: 'center', marginBottom: u(6), marginRight: u(34) },
  card: { borderWidth: 1, borderRadius: u(10), padding: u(5), gap: u(4), alignItems: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: u(4), maxWidth: u(96) },
  name: { fontFamily: F.bodySemi, fontSize: u(9.5), flexShrink: 1 },
  place: { fontFamily: F.mono, fontSize: u(9) },
  cells: { flexDirection: 'row', gap: u(1.5) },
});
