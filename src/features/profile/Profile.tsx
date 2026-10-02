import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinear, Path, Stop } from 'react-native-svg';

import { Moon } from '@/components/Moon';
import { Display } from '@/components/Txt';
import { Fade, useSvgId } from '@/features/community/fx';
import { PlanetSystem } from '@/features/profile/PlanetSystem';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F, type Theme } from '@/theme/tokens';

// Page colours from the locked preview (d-/l-profile).
const C = {
  dark: { tide: ['#a48bff', '#6fd6ff'], ring: 'rgba(201,184,255,0.3)', online: '#7be0a8' },
  light: { tide: ['#e9bf4f', '#e5833a'], ring: 'rgba(184,116,31,0.3)', online: '#5e9e6a' },
};

// Tide lines: accuracy over time per game (points from the preview's 100 x 26 viewBox).
const TIDES: { name: string; acc: number; pts: number[] }[] = [
  { name: 'The Diagnostic Pursuit', acc: 82, pts: [7.8, 11.7, 8.6, 7.5, 11.4, 14.6, 12.7, 10.7, 10.9] },
  { name: 'Nova Medicordle', acc: 71, pts: [16.6, 13.0, 10.7, 11.2, 11.4, 17.2, 15.6, 16.9, 13.8] },
  { name: 'The Streak Master', acc: 64, pts: [12.5, 12.5, 19.2, 19.0, 19.0, 16.6, 12.7, 18.2, 13.5] },
  { name: 'The Riddler', acc: 77, pts: [14.3, 11.4, 11.7, 15.1, 13.3, 11.2, 12.2, 10.9, 11.4] },
  { name: 'Case Files: Unsolved', acc: 58, pts: [19.2, 18.7, 20.3, 15.1, 17.9, 17.2, 20.0, 20.5, 20.5] },
  { name: 'The Silent Artist', acc: 69, pts: [13.3, 16.1, 12.2, 15.3, 11.7, 12.5, 11.4, 12.2, 13.0] },
  { name: 'The Wheels of Chaos', acc: 73, pts: [10.7, 12.5, 10.4, 16.6, 13.3, 10.9, 15.1, 16.9, 17.2] },
  { name: 'Nova Crossword', acc: 61, pts: [17.7, 19.2, 17.2, 15.1, 20.0, 19.8, 13.5, 15.9, 19.5] },
];

const FRIENDS = [
  { name: 'Lina', f: 0.9, when: 'ONLINE', on: true },
  { name: 'Omar', f: 0.6, when: '2H AGO', on: false },
  { name: 'Sara', f: 0.35, when: 'YESTERDAY', on: false },
  { name: 'Rami', f: 0.15, when: '3 DAYS AGO', on: false },
];

const TW = 96; // sparkline width (design px)

function Tide({ t, pts }: { t: Theme; pts: number[] }) {
  const id = useSvgId('tg');
  const c = C[t.mode].tide;
  const d = 'M' + pts.map((y, i) => `${((i * 12.5 * TW) / 100).toFixed(2)},${y}`).join(' L');
  return (
    <Svg width={u(TW)} height={u(26)} viewBox={`0 0 ${TW} 26`}>
      <Defs>
        <SvgLinear id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={c[0]} stopOpacity={0.3} />
          <Stop offset="1" stopColor={c[1]} />
        </SvgLinear>
      </Defs>
      <Path d={d} fill="none" stroke={`url(#${id})`} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}

/** Profile: your planet with the game moons, name, three numbers, tide lines per game and the friends moon list. */
export function Profile() {
  const t = useTheme();
  const p = C[t.mode];
  const line = { borderColor: t.panelLine };
  return (
    <Fade stops={[[0, 0], [0.04, 1], [0.9, 1], [1, 0]]} style={s.area}>
      <ScrollView style={s.fill} contentContainerStyle={s.pf} showsVerticalScrollIndicator={false}>
        <PlanetSystem />
        <View style={s.idn}>
          <Display em="Yazan" italic style={[s.h2, { color: t.fg }]}>
            {'Dr. '}
          </Display>
          <Text style={[s.role, { color: t.mute }]}>INTERNAL MEDICINE · RESIDENT</Text>
        </View>
        <View style={[s.nums, line]}>
          {[
            ['142', 'SOLVED'],
            ['74%', 'ACCURACY'],
            ['12', 'BEST STREAK'],
          ].map(([n, l]) => (
            <View key={l} style={s.num}>
              <Text style={[s.numB, { color: t.fg }]}>{n}</Text>
              <Text style={[s.numS, { color: t.mute }]}>{l}</Text>
            </View>
          ))}
        </View>
        <Text style={[s.sh2, { color: t.kick }]}>BY GAME</Text>
        {TIDES.map((g) => (
          <View key={g.name} style={s.td}>
            <Text style={[s.tdB, { color: t.fg }]}>{g.name}</Text>
            <Tide t={t} pts={g.pts} />
            <Text style={[s.tdN, { color: t.fg }]}>{g.acc}%</Text>
          </View>
        ))}
        <Text style={[s.sh2, { color: t.kick }]}>FRIENDS</Text>
        {FRIENDS.map((fr) => (
          <View key={fr.name} style={[s.fr, line]}>
            <View style={[s.ring, { borderColor: p.ring }]}>
              <Moon size={u(22)} f={fr.f} glow={false} />
            </View>
            <View style={s.frT}>
              <Text style={[s.frB, { color: t.fg }]}>{fr.name}</Text>
              <Text style={[s.frS, { color: fr.on ? p.online : t.mute }]}>{fr.when}</Text>
            </View>
            {fr.on ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Challenge ${fr.name}`}>
                <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.ch}>
                  <Text style={[s.chT, { color: t.onGrad }]}>Challenge</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable style={[s.ch, s.ghost, line]} accessibilityRole="button" accessibilityLabel={`Challenge ${fr.name}`}>
                <Text style={[s.ghT, { color: t.mute }]}>Challenge</Text>
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>
    </Fade>
  );
}

const s = StyleSheet.create({
  area: { flex: 1 },
  fill: { flex: 1 },
  pf: { paddingTop: u(23), paddingHorizontal: u(16), paddingBottom: u(110), gap: u(6) },
  idn: { marginTop: u(2), alignItems: 'center' },
  h2: { fontSize: u(30), lineHeight: u(30), height: u(30), overflow: 'visible', textAlign: 'center' },
  role: { marginTop: u(5), fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(12), letterSpacing: u(1.53) },
  nums: { flexDirection: 'row', justifyContent: 'space-around', marginTop: u(14), marginBottom: u(10), paddingVertical: u(10), borderTopWidth: 1, borderBottomWidth: 1 },
  num: { alignItems: 'center', height: u(46) },
  numB: { fontFamily: F.display, fontSize: u(26), lineHeight: u(26), height: u(26) },
  numS: { marginTop: u(8), fontFamily: F.mono, fontSize: u(7.5), lineHeight: u(10), letterSpacing: u(1.2) },
  sh2: { marginTop: u(10), marginBottom: u(2), fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(12), letterSpacing: u(1.7) },
  td: { flexDirection: 'row', alignItems: 'center', gap: u(8), paddingVertical: u(7), minHeight: u(40) },
  tdB: { width: u(104), fontFamily: F.display, fontSize: u(12.5), lineHeight: u(14.375) },
  tdN: { width: u(34), textAlign: 'right', fontFamily: F.display, fontSize: u(16), lineHeight: u(20) },
  fr: { flexDirection: 'row', alignItems: 'center', gap: u(10), paddingVertical: u(9), borderBottomWidth: 1 },
  ring: { width: u(26), height: u(26), borderRadius: u(13), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  frT: { flex: 1 },
  frB: { fontFamily: F.display, fontSize: u(17), lineHeight: u(17) },
  frS: { marginTop: u(3), fontFamily: F.mono, fontSize: u(7.5), lineHeight: u(10), letterSpacing: u(1.05) },
  ch: { height: u(23), paddingHorizontal: u(10), borderRadius: u(10), justifyContent: 'center' },
  ghost: { height: u(25), borderWidth: 1 },
  chT: { fontFamily: F.bodyBold, fontSize: u(9.5) },
  ghT: { fontFamily: F.bodySemi, fontSize: u(9.5) },
});
