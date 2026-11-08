import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Text } from '@/components/AppText';
import { useSvgId } from '@/components/svgId';
import { Bolt } from '@/features/sparks/Bolt';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { doneOf, timeLeft, weekName, type Rounds } from './useRounds';

/** Look B: a heartbeat line that lights up as you use Sparks; one beat for each of the week's 3 missions. */
export function Beat({ r, more = true }: { r: Rounds; more?: boolean }) {
  const t = useTheme();
  const id = useSvgId('rb');
  const W = 250;
  const TOP = r.missions.at(-1)?.of ?? 1;
  const DONE = doneOf(r);
  let d = 'M0,9';
  const marks: { x: number; label: string }[] = [];
  for (const m of r.missions) {
    // Each beat sits where its mission is reached along the line (the last one just short of the end).
    const x = Math.min(W - 10, (m.of / TOP) * W);
    d += ` L${x - 7},9 L${x - 4},6 L${x - 2},9 L${x},1 L${x + 2},15 L${x + 4},9`;
    marks.push({ x, label: `${m.claimed ? '✓ ' : ''}${m.of}` });
  }
  d += ` L${W},9`;
  return (
    <View style={s.beat}>
      <View style={s.row}>
        <Text style={[s.beatT, { color: t.white }]}>
          Grand Rounds <Text style={{ fontFamily: F.displayItalic, color: t.accent }}>{weekName(r.this)}</Text>
        </Text>
      </View>
      <View style={s.row}>
        <Text style={[s.left, { color: t.mute, flex: 1 }]}>{r.claimed ? 'DONE THIS WEEK' : `${timeLeft(r.ends).toUpperCase()} LEFT${more ? ' · TAP FOR MORE' : ''}`}</Text>
        <View style={s.prize}>
          <Bolt size={u(9)} />
          <Text style={[s.prizeT, { color: t.fg }]}>{`${r.used} / ${TOP}`}</Text>
        </View>
      </View>
      <Svg width="100%" height={u(18)} viewBox={`0 0 ${W} 16`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2={W} y2="0" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={t.gradA} />
            <Stop offset={DONE} stopColor={t.gradB} />
            <Stop offset={DONE + 0.001} stopColor={t.chipLine} />
            <Stop offset="1" stopColor={t.chipLine} />
          </LinearGradient>
        </Defs>
        <Path d={d} stroke={`url(#${id})`} strokeWidth={1.4} fill="none" strokeLinejoin="round" />
      </Svg>
      <View style={s.lbl}>
        {marks.map((m) => (
          <Text key={m.label} style={[s.part, { left: `${(m.x / W) * 100}%`, color: t.mute }]}>
            {m.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  beat: { gap: u(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(6) },
  beatT: { flex: 1, fontFamily: F.display, fontSize: u(11) },
  left: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(0.8) },
  prize: { flexDirection: 'row', alignItems: 'center', gap: u(2) },
  prizeT: { fontFamily: F.bodySemi, fontSize: u(9) },
  lbl: { height: u(10) },
  part: { position: 'absolute', width: u(50), marginLeft: u(-25), textAlign: 'center', fontFamily: F.mono, fontSize: u(6.5), letterSpacing: u(0.4) },
});
