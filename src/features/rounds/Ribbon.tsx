import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Text } from '@/components/AppText';
import { TokenCoin } from '@/components/PulseStar';
import { useSvgId } from '@/components/svgId';
import { tapped } from '@/lib/sound';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import { doneOf, loadRounds, PART_NAME, timeLeft, useRoundsStore, weekName, type Rounds } from './useRounds';

/**
 * Grand Rounds on the Games page (Yazan 2026-10-13): a small round button on the right under the header; tapping it
 * opens a small pop-up with the heartbeat line (look B).
 */
export function RoundsButton() {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const r = useRoundsStore((x) => x.r);
  const toggle = tapped(() => setOpen((o) => !o));
  useEffect(() => {
    void loadRounds();
  }, []);
  // Leaving the Games page closes the pop-up and re-reads the week on return.
  useFocusEffect(
    useCallback(() => {
      void loadRounds();
      return () => setOpen(false);
    }, []),
  );
  if (!r) return null;
  return (
    <>
      {open ? <Pressable style={StyleSheet.absoluteFill} onPress={toggle} accessibilityLabel="Close Grand Rounds" /> : null}
      <Pressable onPress={toggle} style={[s.btn, { backgroundColor: t.panel, borderColor: t.panelLine }]} accessibilityRole="button" accessibilityLabel="Grand Rounds this week" accessibilityState={{ expanded: open }}>
        <Ring done={doneOf(r)} />
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={[s.pop, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
          <Pressable
            onPress={() => {
              setOpen(false);
              router.navigate('/rounds' as never);
            }}
            accessibilityRole="link"
            accessibilityLabel="Open Grand Rounds">
            <Beat r={r} />
          </Pressable>
        </Animated.View>
      ) : null}
    </>
  );
}

/** The button face: a tiny heartbeat inside a ring that fills with the week's progress. */
function Ring({ done }: { done: number }) {
  const t = useTheme();
  const id = useSvgId('rr');
  const r = 13;
  const c = 2 * Math.PI * r;
  return (
    <Svg width={u(24)} height={u(24)} viewBox="0 0 30 30">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={t.gradA} />
          <Stop offset="1" stopColor={t.gradB} />
        </LinearGradient>
      </Defs>
      <Circle cx={15} cy={15} r={r} fill="none" stroke={t.chipLine} strokeWidth={1.6} />
      <Circle cx={15} cy={15} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={1.8} strokeDasharray={`${c * done} ${c}`} strokeLinecap="round" transform="rotate(-90 15 15)" />
      <Path d="M7.5,15.5 L11,15.5 L12.6,12.5 L14.4,19.5 L16.4,9.5 L18.2,15.5 L22.5,15.5" stroke={t.accent} strokeWidth={1.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

/** Look B: a heartbeat line that lights up as you play; each beat is one sub-mode (or the one mode of a mode week). */
export function Beat({ r, more = true }: { r: Rounds; more?: boolean }) {
  const t = useTheme();
  const id = useSvgId('rb');
  const W = 250;
  const TOTAL = r.parts.reduce((a, p) => a + p.of, 0);
  const DONE = doneOf(r);
  let x = 0;
  let d = 'M0,9';
  const marks: { x: number; label: string }[] = [];
  for (const p of r.parts) {
    const w = (p.of / TOTAL) * W;
    const m = x + w / 2;
    // The beat labels are 50 units wide, too narrow for 'Pass the phone': the ribbon keeps the short 'Pass'.
    d += ` L${m - 7},9 L${m - 4},6 L${m - 2},9 L${m},1 L${m + 2},15 L${m + 4},9 L${x + w},9`;
    marks.push({ x: m, label: `${r.this.kind === 'mode' ? 'Wins' : p.k === 'offline' ? 'Pass' : PART_NAME[p.k]} ${p.n ?? 0}/${p.of}` });
    x += w;
  }
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
          <Text style={[s.prizeT, { color: t.fg }]}>{r.prize}</Text>
          <TokenCoin size={u(10)} progress={1} track="transparent" />
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
  btn: { position: 'absolute', right: u(16), top: u(8), width: u(27), height: u(27), borderRadius: u(13.5), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pop: { position: 'absolute', left: u(16), right: u(16), top: u(41), borderRadius: u(14), borderWidth: 1, paddingHorizontal: u(12), paddingTop: u(10), paddingBottom: u(8) },
  beat: { gap: u(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: u(6) },
  beatT: { flex: 1, fontFamily: F.display, fontSize: u(11) },
  left: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(0.8) },
  prize: { flexDirection: 'row', alignItems: 'center', gap: u(2) },
  prizeT: { fontFamily: F.bodySemi, fontSize: u(9) },
  lbl: { height: u(10) },
  part: { position: 'absolute', width: u(50), marginLeft: u(-25), textAlign: 'center', fontFamily: F.mono, fontSize: u(6.5), letterSpacing: u(0.4) },
});
