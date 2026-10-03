import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import type { Standing } from '../engine/types';
import { Btn, Kick } from './ui';

/** Rule 16: pass-the-phone curtain. Full cover, next player's name, scoreboard only (no answers), then "I'm ready". */
export function Curtain({ name, color, sub, board, onReady }: { name: string; color?: string; sub?: string; board: (Pick<Standing, 'seat' | 'name' | 'score'> & { color?: string })[]; onReady: () => void }) {
  const t = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)} style={[StyleSheet.absoluteFill, s.root, { backgroundColor: t.sky }]}>
      <Kick>Pass the phone to</Kick>
      <Text style={[s.name, { color: color ?? t.accent }]}>{name}</Text>
      {sub ? <Kick>{sub}</Kick> : null}
      <View style={[s.board, { borderColor: t.panelLine, backgroundColor: t.panel }]}>
        {board.map((b) => (
          <View key={b.seat} style={s.row}>
            <View style={s.who2}>
              {b.color ? <View style={[s.dot, { backgroundColor: b.color }]} /> : null}
              <Text style={[s.who, { color: b.name === name ? (color ?? t.accent) : t.fg }]}>{b.name}</Text>
            </View>
            <Text style={[s.pts, { color: t.soft }]}>{b.score}</Text>
          </View>
        ))}
      </View>
      <Btn label="I'm ready" onPress={onReady} style={{ alignSelf: 'stretch' }} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { zIndex: 30, alignItems: 'center', justifyContent: 'center', padding: u(24), gap: u(14) },
  name: { fontFamily: F.display, fontSize: u(34), lineHeight: u(36) },
  board: { alignSelf: 'stretch', borderRadius: u(16), borderWidth: 1, padding: u(12), gap: u(6) },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  who2: { flexDirection: 'row', alignItems: 'center', gap: u(6) },
  dot: { width: u(8), height: u(8), borderRadius: u(4) },
  who: { fontFamily: F.bodySemi, fontSize: u(12) },
  pts: { fontFamily: F.mono, fontSize: u(11) },
});
