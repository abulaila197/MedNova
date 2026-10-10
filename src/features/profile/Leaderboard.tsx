import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { LevelBadge, useBalance } from '@/components/LevelBadge';
import { Fade, useSvgId } from '@/features/community/fx';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

// Page colours from the locked preview (d-/l-leaderboard).
const C = {
  dark: {
    star: '#ffffff',
    // rank words and the pinned rank number are lilac (#c9b8ff) in the preview; accent per the standing rule
    rank: '#6fd6ff',
    pinLine: 'rgba(164,139,255,0.55)',
    pinShadow: (k: number) => `0px ${12 * k}px ${30 * k}px ${-14 * k}px rgba(143,117,255,0.8)`,
    prog: 'rgba(255,255,255,0.1)',
  },
  light: {
    star: '#e5833a',
    rank: '#c98a1e',
    pinLine: 'rgba(233,191,79,0.55)',
    pinShadow: (k: number) => `0px ${12 * k}px ${30 * k}px ${-14 * k}px rgba(233,191,79,0.8)`,
    prog: 'rgba(255,255,255,0.1)',
  },
};
const HALO = '201,184,255'; // star glow colour (both modes in the preview)

// Top three as stars. cx = star centre x, top = star top (screen design px), d = star diameter, a = glow alpha.
const TOP3 = [
  { word: 'First', name: 'Lina', level: 24, pts: '2,940', cx: 141, top: 139, d: 20, a: 0.9, blur: 32, spread: 7 },
  { word: 'Second', name: 'Omar', level: 21, pts: '2,710', cx: 62, top: 192, d: 14, a: 0.65, blur: 22, spread: 5 },
  { word: 'Third', name: 'Sara', level: 18, pts: '2,455', cx: 221.5, top: 211, d: 11, a: 0.45, blur: 18, spread: 4 },
];
// Stand-in players until the board is wired (wire-later.md); levels come from the server then (LV3).
const ROWS = [
  { n: '04', name: 'Rami', level: 16, pts: '2,180' },
  { n: '05', name: 'Noor', level: 15, pts: '2,030' },
];
const TOP = 72; // content area top (design px)

/** CSS box-shadow `0 0 blur spread` glow around a circle of radius r, as a soft radial gradient. */
function StarGlow({ r, blur, spread, a }: { r: number; blur: number; spread: number; a: number }) {
  const id = useSvgId('sg');
  const e = r + spread; // shadow edge
  const R = e + blur;
  const sz = 2 * R;
  return (
    <Svg width={u(sz)} height={u(sz)} viewBox={`0 0 ${sz} ${sz}`} style={{ position: 'absolute', left: u(r - R), top: u(r - R) }} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx={R} cy={R} r={R} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={`rgb(${HALO})`} stopOpacity={a * 0.6} />
          <Stop offset={Math.max(0, e - blur / 2) / R} stopColor={`rgb(${HALO})`} stopOpacity={a * 0.52} />
          <Stop offset={e / R} stopColor={`rgb(${HALO})`} stopOpacity={a * 0.3} />
          <Stop offset={(e + blur / 2) / R} stopColor={`rgb(${HALO})`} stopOpacity={a * 0.09} />
          <Stop offset="1" stopColor={`rgb(${HALO})`} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={R} cy={R} r={R} fill={`url(#${id})`} />
    </Svg>
  );
}

/** Leaderboard: scope and filters, the top three as stars, ranked rows and your pinned row. */
export function Leaderboard() {
  const t = useTheme();
  const p = C[t.mode];
  const pill = [s.pill, { backgroundColor: t.panel, borderColor: t.panelLine }];
  const me = useBalance();
  return (
    <Fade stops={[[0, 1], [0.86, 1], [0.99, 0], [1, 0]]} style={s.area}>
      <ScrollView style={s.fill} contentContainerStyle={s.c} showsVerticalScrollIndicator={false}>
        <View style={s.lb}>
          <View style={s.top}>
            <View style={s.scope}>
              <Text style={[s.scopeT, { color: t.accent, fontFamily: F.displayItalic }]}>Everyone</Text>
              <Pressable accessibilityRole="button">
                <Text style={[s.scopeT, { color: t.mute }]}>Friends</Text>
              </Pressable>
            </View>
            <View style={s.flt}>
              <Pressable style={pill} accessibilityRole="button">
                <Text style={[s.pillT, { color: t.mute }]}>All games ▾</Text>
              </Pressable>
              <Pressable style={pill} accessibilityRole="button">
                <Text style={[s.pillT, { color: t.mute }]}>Any ▾</Text>
              </Pressable>
            </View>
          </View>
          <View style={s.hero}>
            {TOP3.map((r) => (
              <View key={r.word} style={[s.rk, { left: u(r.cx - 40), top: u(r.top - 115) }]}>
                <View style={{ width: u(r.d), height: u(r.d) }}>
                  <StarGlow r={r.d / 2} blur={r.blur} spread={r.spread} a={r.a} />
                  <View style={{ width: u(r.d), height: u(r.d), borderRadius: u(r.d / 2), backgroundColor: p.star }} />
                </View>
                <Text style={[s.word, { color: p.rank }]}>{r.word}</Text>
                <View style={s.nmRow}>
                  <Text style={[s.name, { color: t.fg }]}>{r.name}</Text>
                  <LevelBadge level={r.level} size={u(15)} />
                </View>
                <Text style={[s.pts, { color: t.mute }]}>{r.pts}</Text>
              </View>
            ))}
          </View>
          {ROWS.map(({ n, name, level, pts }, i) => (
            <View key={n} style={[s.r, { borderColor: t.panelLine }, i === 0 && s.first]}>
              <Text style={[s.rN, { color: t.kick }]}>{n}</Text>
              <View style={s.rNm}>
                <Text style={[s.rB, { color: t.fg }]}>{name}</Text>
                <LevelBadge level={level} size={u(15)} />
              </View>
              <Text style={[s.rS, { color: t.mute }]}>{pts}</Text>
            </View>
          ))}
        </View>
        <View style={[s.pin, { backgroundColor: t.panel, borderColor: p.pinLine, boxShadow: p.pinShadow(u(1)) }]}>
          <Text style={[s.pinN, { color: p.rank }]}>14</Text>
          <View style={s.pinB}>
            <View style={s.nmRow}>
              <Text style={[s.you, { color: t.fg }]}>You</Text>
              <LevelBadge level={me.level} progress={me.into / me.need} size={u(15)} />
            </View>
            <Text style={[s.sub, { color: t.mute }]}>15 POINTS TO PASS TALA</Text>
            <View style={[s.prog, { backgroundColor: p.prog }]}>
              <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.progI} />
            </View>
          </View>
          <Text style={[s.pinS, { color: t.fg }]}>1,480</Text>
        </View>
      </ScrollView>
    </Fade>
  );
}

const s = StyleSheet.create({
  area: { flex: 1 },
  fill: { flex: 1 },
  c: { paddingTop: u(88 - TOP), paddingBottom: u(50) },
  lb: { paddingHorizontal: u(16), height: u(331) },
  top: { height: u(23), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scope: { flexDirection: 'row', gap: u(12), alignItems: 'center' },
  scopeT: { fontFamily: F.display, fontSize: u(17), lineHeight: u(21) },
  flt: { flexDirection: 'row', gap: u(6), marginRight: u(-13) },
  pill: { height: u(23), paddingHorizontal: u(9), borderRadius: 999, borderWidth: 1, justifyContent: 'center' },
  pillT: { fontFamily: F.bodySemi, fontSize: u(9) },
  hero: { height: u(200), marginTop: u(4), marginHorizontal: u(-16) },
  rk: { position: 'absolute', width: u(80), alignItems: 'center' },
  word: { marginTop: u(4), fontFamily: F.displayItalic, fontSize: u(13), lineHeight: u(16) },
  name: { marginTop: u(4), fontFamily: F.display, fontSize: u(15), lineHeight: u(15) },
  pts: { marginTop: u(4), fontFamily: F.mono, fontSize: u(7.5), lineHeight: u(10), letterSpacing: u(1.05) },
  r: { flexDirection: 'row', alignItems: 'center', gap: u(12), paddingVertical: u(8), height: u(36), borderBottomWidth: 1 },
  first: { borderTopWidth: 1, height: u(37) },
  rN: { width: u(16), fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(12) },
  nmRow: { flexDirection: 'row', alignItems: 'center', gap: u(5) },
  rNm: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: u(6) },
  rB: { fontFamily: F.display, fontSize: u(16), lineHeight: u(16) },
  rS: { fontFamily: F.display, fontSize: u(15), lineHeight: u(19) },
  pin: { marginTop: u(10), marginHorizontal: u(14), height: u(66), flexDirection: 'row', alignItems: 'center', gap: u(12), paddingHorizontal: u(14), borderRadius: u(18), borderWidth: 1 },
  pinN: { fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(12) },
  pinB: { flex: 1 },
  you: { fontFamily: F.displayItalic, fontSize: u(17), lineHeight: u(21) },
  sub: { marginTop: u(3), fontFamily: F.mono, fontSize: u(7.5), lineHeight: u(10), letterSpacing: u(0.9) },
  prog: { marginTop: u(6), height: u(2), borderRadius: u(2), overflow: 'hidden' },
  progI: { width: '64%', height: '100%', borderRadius: u(2) },
  pinS: { fontFamily: F.display, fontSize: u(16), lineHeight: u(20) },
});
