import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Empty, Fade } from '@/features/community/fx';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F, type Theme } from '@/theme/tokens';

// Page colours from the locked preview (d-/l-community).
const C = {
  dark: { tag: '#6fd6ff', title: '#eef0ff', shade: 'rgba(8,10,25,0.85)', play: 'rgba(8,10,25,0.55)' },
  light: { tag: '#c98a1e', title: '#fff8ee', shade: 'rgba(40,30,15,0.75)', play: 'rgba(251,249,244,0.7)' },
};

type Card = { kind: 'media'; art: string; tag: string; title: string; play: boolean } | { kind: 'quote'; text: string; tag: string };
const CARDS: Card[] = [
  { kind: 'media', art: 'ct', tag: 'REEL · 0:42', title: 'Why the ECG lied', play: true },
  { kind: 'quote', text: '“Common things are common. Until they aren’t.”', tag: 'POST · 214 likes' },
  { kind: 'media', art: 'md', tag: 'SHORT · 0:15', title: 'One-minute murmurs', play: true },
  { kind: 'media', art: 'sa', tag: 'POST', title: 'Our new case editor', play: false },
];

const openStory = () => router.push('/community/story');

function Avatar({ t, art, first }: { t: Theme; art: string; first?: boolean }) {
  return (
    <View style={[s.av, { marginLeft: first ? u(-2) : u(-11), borderColor: t.panel }]}>
      <Empty w={20} h={20} radius={10} />
    </View>
  );
}

function Media({ t, c }: { t: Theme; c: Extract<Card, { kind: 'media' }> }) {
  const p = C[t.mode];
  return (
    <Pressable onPress={openStory} style={[s.fr, { backgroundColor: t.panel, borderColor: t.panelLine }]} accessibilityRole="button" accessibilityLabel={c.title}>
      <Empty w={252} h={116}>
        <LinearGradient colors={['transparent', p.shade]} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
      </Empty>
      {c.play ? (
        <View style={[s.pl, { backgroundColor: p.play }]}>
          <Svg width={u(9)} height={u(9)} viewBox="0 0 10 10">
            <Path d="M2 1l7 4-7 4z" fill="#fff" />
          </Svg>
        </View>
      ) : null}
      <View style={s.lb}>
        <Text style={[s.tag, { color: p.tag }]}>{c.tag}</Text>
        <Text style={[s.ttl, { color: p.title }]} numberOfLines={1}>
          {c.title}
        </Text>
      </View>
    </Pressable>
  );
}

function Quote({ t, c }: { t: Theme; c: Extract<Card, { kind: 'quote' }> }) {
  return (
    <Pressable onPress={openStory} style={[s.fr, s.q, { backgroundColor: t.panel2, borderColor: t.panelLine }]} accessibilityRole="button" accessibilityLabel="Post">
      <Text style={[s.qt, { color: t.fg }]}>{c.text}</Text>
      <Text style={[s.qs, { color: t.kick }]}>{c.tag}</Text>
    </Pressable>
  );
}

/** Community feed: "This week" heading, the stories stack and one column of equal cards. */
export function Feed() {
  const t = useTheme();
  return (
    <Fade stops={[[0, 1], [0.82, 1], [1, 0]]} style={s.area}>
      <ScrollView style={s.fill} contentContainerStyle={s.c2} showsVerticalScrollIndicator={false}>
        <View style={s.ctop}>
          <View style={s.head}>
            <Text style={[s.kick, { color: t.kick }]}>NOVA COMMUNITY</Text>
            <Text style={[s.h2, { color: t.white }]}>
              This <Text style={{ fontFamily: F.displayItalic, color: t.accent }}>week</Text>
            </Text>
          </View>
          <Pressable onPress={openStory} style={[s.stack, { backgroundColor: t.panel, borderColor: t.panelLine }]} accessibilityRole="button" accessibilityLabel="6 new stories">
            <View style={s.avs}>
              <Avatar t={t} art="sd" first />
              <Avatar t={t} art="ct" />
              <Avatar t={t} art="md" />
            </View>
            <Text style={[s.stT, { color: t.fg }]}>6 new stories</Text>
          </Pressable>
        </View>
        {CARDS.map((c, i) => (c.kind === 'media' ? <Media key={i} t={t} c={c} /> : <Quote key={i} t={t} c={c} />))}
      </ScrollView>
    </Fade>
  );
}

const s = StyleSheet.create({
  area: { flex: 1, marginTop: u(16) },
  fill: { flex: 1 },
  c2: { paddingHorizontal: u(14), gap: u(10), paddingBottom: u(90) },
  ctop: { flexDirection: 'row', alignItems: 'flex-end', gap: u(10), height: u(46), marginBottom: u(2) },
  head: { width: u(118), height: u(46) },
  kick: { marginTop: u(7), height: u(12), lineHeight: u(12), fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(1.7) },
  h2: { marginTop: u(3), fontFamily: F.display, fontSize: u(25), lineHeight: u(24), height: u(24), overflow: 'visible' },
  stack: { flexDirection: 'row', alignItems: 'center', gap: u(7), height: u(30), paddingLeft: u(4), paddingRight: u(9), borderRadius: 999, borderWidth: 1, flexShrink: 0, marginBottom: 0 },
  avs: { flexDirection: 'row' },
  av: { width: u(24), height: u(24), borderRadius: u(12), borderWidth: u(2), margin: u(-2), overflow: 'hidden' },
  stT: { fontFamily: F.body, fontSize: u(9.5) },
  fr: { height: u(118), borderRadius: u(18), borderWidth: 1, overflow: 'hidden' },
  q: { padding: u(12), justifyContent: 'center' },
  qt: { fontFamily: F.displayItalic, fontSize: u(17), lineHeight: u(18.7) },
  qs: { marginTop: u(8), fontFamily: F.mono, fontSize: u(7.5), lineHeight: u(10), letterSpacing: u(1.2) },
  pl: {
    position: 'absolute',
    left: u(211),
    top: u(-3),
    width: u(22),
    height: u(22),
    borderRadius: u(11),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: u(8) },
    shadowOpacity: 0.9,
    shadowRadius: u(6),
  },
  lb: { position: 'absolute', left: u(26), right: u(24), bottom: u(8) },
  tag: { fontFamily: F.mono, fontSize: u(7.5), lineHeight: u(10), letterSpacing: u(1.2) },
  ttl: { marginTop: u(2), fontFamily: F.display, fontSize: u(14), lineHeight: u(14) },
});
