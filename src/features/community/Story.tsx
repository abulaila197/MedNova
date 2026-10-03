import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Empty, Fade } from '@/features/community/fx';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F, type Theme } from '@/theme/tokens';

// Page colours from the locked preview (d-/l-story).
const C = {
  dark: { ring: '#c9b8ff', spine: 'rgba(201,184,255,0.4)', glowShadow: 'rgba(5,7,20,0.9)' },
  light: { ring: '#c98a1e', spine: 'rgba(184,116,31,0.4)', glowShadow: 'rgba(236,235,231,0.9)' },
};
const GAP = '#070a1c'; // the 2px dark gap ring around every story dot (same in both modes in the preview)

type Dot = { art: string; state: 'seen' | 'on' | 'new' };
const SPINE: Dot[] = [
  { art: 'ci', state: 'seen' },
  { art: 'md', state: 'seen' },
  { art: 'sd', state: 'on' },
  { art: 'ct', state: 'new' },
  { art: 'sa', state: 'new' },
  { art: 'sr', state: 'new' },
  { art: 'cs', state: 'new' },
];

// Story area: design y 88..545 (282 x 457).
const AH = 457;

function StoryDot({ t, d }: { t: Theme; d: Dot }) {
  const p = C[t.mode];
  const size = d.state === 'on' ? 32 : 24;
  const ring = d.state === 'on' ? 1.5 : 1;
  const col = d.state === 'on' ? t.accent : d.state === 'seen' ? 'rgba(255,255,255,0.18)' : p.ring;
  const outer = size + 4 + ring * 2;
  return (
    <View style={{ width: u(outer), height: u(outer), borderRadius: u(outer / 2), backgroundColor: col, alignItems: 'center', justifyContent: 'center', margin: u(-(outer - size) / 2) }}>
      <View style={{ width: u(size + 4), height: u(size + 4), borderRadius: u((size + 4) / 2), backgroundColor: GAP, alignItems: 'center', justifyContent: 'center' }}>
        <Empty w={size} h={size} radius={size / 2}>
          {d.state === 'seen' ? <View style={[StyleSheet.absoluteFill, { backgroundColor: t.mode === 'dark' ? 'rgba(20,22,40,0.45)' : 'rgba(120,110,95,0.35)' }]} /> : null}
        </Empty>
      </View>
    </View>
  );
}

/** An opened short: feathered photo, vertical counter, story spine on the right and the caption. */
export function Story() {
  const t = useTheme();
  const p = C[t.mode];
  return (
    <Fade stops={[[0, 1], [0.76, 1], [0.97, 0], [1, 0]]} style={s.area}>
      <Empty w={210} h={300} radius={18} style={{ position: 'absolute', left: u(18), top: u(8) }} />
      <View style={s.vkBox} pointerEvents="none">
        <Text style={[s.vk, { color: t.mute }]} numberOfLines={1}>
          <Text style={{ color: t.fg }}>SHORT</Text> · 03 / 14
        </Text>
      </View>
      <View style={s.spine}>
        <LinearGradient colors={['transparent', p.spine, 'transparent']} style={s.spLine} />
        {SPINE.map((d, i) => (
          <StoryDot key={i} t={t} d={d} />
        ))}
      </View>
      <View style={s.cpt}>
        <Text style={[s.kick, { color: t.kick }]}>NOVA COMMUNITY</Text>
        <Text style={[s.h3, { color: t.white, textShadowColor: p.glowShadow }]}>
          A night on{'\n'}the <Text style={{ fontFamily: F.displayItalic, color: t.accent }}>ward</Text>
        </Text>
        <View style={s.row}>
          <Text style={[s.rowT, { color: t.mute }]}>
            <Text style={[s.rowB, { color: t.fg }]}>2.4k</Text> likes
          </Text>
          <Text style={[s.rowT, { color: t.mute }]}>
            <Text style={[s.rowB, { color: t.fg }]}>86</Text> shares
          </Text>
          <Text style={[s.rowT, { color: t.mute }]}>@mednova</Text>
        </View>
      </View>
    </Fade>
  );
}

const s = StyleSheet.create({
  area: { marginTop: u(16), height: u(AH), overflow: 'hidden' },
  vkBox: { position: 'absolute', left: u(20 - 65), top: u(121 - 65 - 6), width: u(130), height: u(12), transform: [{ rotate: '-90deg' }], justifyContent: 'center' },
  vk: { fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(12), letterSpacing: u(2.04) },
  spine: { position: 'absolute', left: u(236), top: u(8), width: u(30), height: u(399), alignItems: 'center', justifyContent: 'space-between' },
  spLine: { position: 'absolute', top: u(10), bottom: u(10), left: u(14.5), width: 1 },
  cpt: { position: 'absolute', left: u(18), top: u(302), width: u(204) },
  kick: { marginTop: u(7), lineHeight: u(12), fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(1.7) },
  h3: { marginTop: u(7), fontFamily: F.display, fontSize: u(30), lineHeight: u(27.6), textShadowOffset: { width: 0, height: u(2) }, textShadowRadius: u(14) },
  row: { marginTop: u(8), flexDirection: 'row', gap: u(14), alignItems: 'center' },
  rowT: { fontFamily: F.body, fontSize: u(10), lineHeight: u(12) },
  rowB: { fontFamily: F.bodySemi },
});
