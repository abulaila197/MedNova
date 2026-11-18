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
import { LTR, LTR_WEB } from '@/i18n';
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
  // Small on purpose (Yazan 2026-11-18): the rivals' boards must not take height from the player's own tiles.
  const cell = Math.max(u(2.6), Math.min(u(4.2), u(40) / len));
  const colour = { g: c.ok, y: c.near, x: c.off } as Record<string, string>;
  return (
    // Left to right in Arabic too: the gap at the end keeps clear of your own character, which sits on the right.
    <View {...LTR_WEB} style={[s.row, LTR]}>
      {st.players
        .filter((p) => p.user_id !== YOU)
        .map((p) => {
          const rows = (plans[p.user_id]?.rows ?? []).filter((r) => r.at <= el);
          return (
            <View key={p.user_id} {...LTR_WEB} style={[s.card, LTR, { borderColor: p.solved ? c.ok : c.line, backgroundColor: c.glass }]}>
              <View style={s.who}>
                <PlayerFace slug={p.character} size={u(14)} userId={p.user_id} still />
                {p.solved ? (
                  <Text style={[s.place, { color: c.ok }]}>{nth(p.item_rank ?? 1)}</Text>
                ) : (
                  <Text style={[s.name, { color: th.fg }]} numberOfLines={1}>{p.name.split(' ')[0]}</Text>
                )}
              </View>
              <View style={{ gap: u(1) }}>
                {Array.from({ length: MAX_ROWS }, (_, i) => (
                  <View key={i} style={s.cells}>
                    {Array.from({ length: len }, (_, j) => {
                      const ch = rows[i]?.colours[j];
                      return ch ? (
                        <Animated.View key={j} entering={ZoomIn.duration(180).delay(j * 40)} style={{ width: cell, height: cell, borderRadius: 1, backgroundColor: colour[ch] }} />
                      ) : (
                        <View key={j} style={{ width: cell, height: cell, borderRadius: 1, borderWidth: 0.5, borderColor: c.line }} />
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
  row: { flexDirection: 'row', gap: u(6), justifyContent: 'center', marginBottom: u(4), marginEnd: u(58) },
  // One short strip per rival: face and name beside the mini board, not above it.
  card: { flexDirection: 'row', borderWidth: 1, borderRadius: u(8), paddingVertical: u(3), paddingHorizontal: u(4), gap: u(4), alignItems: 'center' },
  who: { alignItems: 'center', gap: u(1), maxWidth: u(36) },
  name: { fontFamily: F.bodySemi, fontSize: u(8), maxWidth: u(36) },
  place: { fontFamily: F.mono, fontSize: u(8) },
  cells: { flexDirection: 'row', gap: u(1) },
});
