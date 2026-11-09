import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Text } from '@/components/AppText';

import { PlayerFace } from '@/features/style/Frame';
import { nth } from '@/match/live';
import type { RaceState } from '@/match/race';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import type { BotRace } from './engine';
import { YOU } from './engine';

/** How long a rival's wrong guess stays readable on its pill. */
const SHOW_WRONG_MS = 3000;

/**
 * The rivals' progress pills during a question (G4): each rival's face, a tick and place once it solves, and in
 * Diagnostic Pursuit its wrong guesses as they happen (crossed out, then a count). `wrongName` turns a guess into words.
 */
export function RivalStrip({ st, race, t, wrongName }: { st: RaceState; race: BotRace; t: number; wrongName?: (id: string) => string }) {
  const th = useTheme();
  const plans = race.plansNow();
  const start = race.startOfNow();
  if (st.phase !== 'case' || !plans || start == null) return null;
  const el = t - start;
  const rows = st.players.filter((p) => p.user_id !== YOU);
  return (
    <View style={s.row}>
      {rows.map((p) => {
        const plan = plans[p.user_id];
        const made = plan?.wrongAt.filter((w) => w <= el).length ?? 0;
        const lastAt = made ? plan.wrongAt[made - 1] : null;
        const fresh = wrongName && !p.solved && lastAt != null && el - lastAt < SHOW_WRONG_MS ? plan.wrongs?.[made - 1] : undefined;
        return (
          <View key={p.user_id} style={[s.pill, { backgroundColor: th.panel, borderColor: p.solved ? '#2fbf7a' : th.panelLine }]}>
            <PlayerFace slug={p.character} size={u(20)} userId={p.user_id} still />
            <View style={s.txt}>
              <Text style={[s.name, { color: th.fg }]} numberOfLines={1}>{p.name.split(' ')[0]}</Text>
              {p.solved ? (
                <Animated.Text entering={ZoomIn.duration(200)} style={[s.stat, { color: '#2fbf7a' }]}>✓ {nth(p.item_rank ?? 1)}</Animated.Text>
              ) : fresh ? (
                <Animated.Text key={made} entering={FadeIn.duration(160)} numberOfLines={1} style={[s.stat, s.wrong, { color: '#f87171' }]}>
                  {wrongName!(fresh)}
                </Animated.Text>
              ) : (
                <Text style={[s.stat, { color: th.mute }]}>{made && wrongName ? `✗ ${made}` : '…'}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: u(6), marginBottom: u(8), marginRight: u(34) },
  pill: { flexDirection: 'row', alignItems: 'center', gap: u(6), borderWidth: 1, borderRadius: 999, paddingVertical: u(3), paddingLeft: u(3), paddingRight: u(10), maxWidth: u(150) },
  txt: { flexShrink: 1 },
  name: { fontFamily: F.bodySemi, fontSize: u(10.5), lineHeight: u(13) },
  stat: { fontFamily: F.mono, fontSize: u(9.5), lineHeight: u(12) },
  wrong: { textDecorationLine: 'line-through' },
});
