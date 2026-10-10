import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import type { Standing } from '../engine/types';
import type { RecapLine } from './recap';
import { Btn, Kick } from './ui';

/**
 * Rule 16: pass-the-phone curtain. Full cover, next player's name, scoreboard only (no answers), then "I'm ready".
 * OF1: offline modes have no live alerts, so `recap` lists what happened since this player's last turn.
 */
export function Curtain({ name, color, sub, board, recap, onReady }: { name: string; color?: string; sub?: string; board: (Pick<Standing, 'seat' | 'name' | 'score'> & { color?: string })[]; recap?: RecapLine[]; onReady: () => void }) {
  const t = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)} style={[StyleSheet.absoluteFill, s.root, { backgroundColor: t.sky }]}>
      <Kick>Pass the phone to</Kick>
      <Text style={[s.name, { color: color ?? t.accent }]}>{name}</Text>
      {sub ? <Kick>{sub}</Kick> : null}
      {recap?.length ? <Recap lines={recap} /> : null}
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

/** OF1: "Since your last turn" list, one line per event with the player's colour dot; a lead change stands out. */
export function Recap({ lines }: { lines: RecapLine[] }) {
  const t = useTheme();
  return (
    <View style={[s.recap, { borderColor: t.panelLine, backgroundColor: t.panel }]}>
      <Text style={[s.recapK, { color: t.soft }]}>SINCE YOUR LAST TURN</Text>
      {lines.map((l) => (
        <View key={l.key} style={s.line}>
          <View style={[s.dot, { backgroundColor: l.color ?? t.soft }]} />
          <Text style={[l.lead ? s.leadTxt : s.lineTxt, { color: l.lead ? (l.color ?? t.accent) : t.fg }]}>{l.text}</Text>
        </View>
      ))}
    </View>
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
  recap: { alignSelf: 'stretch', borderRadius: u(16), borderWidth: 1, paddingHorizontal: u(12), paddingVertical: u(10), gap: u(6) },
  recapK: { fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(1.4), marginBottom: u(2) },
  line: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  lineTxt: { flex: 1, fontFamily: F.body, fontSize: u(12), lineHeight: u(16) },
  leadTxt: { flex: 1, fontFamily: F.bodySemi, fontSize: u(12.5), lineHeight: u(16) },
});
