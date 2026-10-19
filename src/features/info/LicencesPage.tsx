import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { InfoScroll, Kicker, Rich, s as ui, useInfo } from '@/features/info/ui';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import DATA from './licences.json';

type Pkg = { n: string; v: string; l: string; c: string; f?: string };
const PKGS = DATA.packages as Pkg[];
const TEXTS = DATA.texts as Record<string, string>;
// One group per licence, the most used first. Font packages also carry the font's OFL notice.
const GROUPS = Object.entries(
  PKGS.reduce<Record<string, Pkg[]>>((m, p) => {
    (m[p.l] ??= []).push(p);
    return m;
  }, {}),
).sort((a, b) => b[1].length - a[1].length);
const FONTS = PKGS.filter((p) => p.f);

/** Open-source licences (Session 4, linked from About): every package the app ships, grouped by licence, with the full texts. Built by scripts/build-licences.mjs. */
export function LicencesPage() {
  const c = useInfo();
  return (
    <Screen tab={null} glow={21}>
      <InfoScroll>
        <Kicker>Open-source licences</Kicker>
        <Rich text={'Built on *open source.*'} style={ui.H} />
        <Text style={[ui.p, { color: c.mute }]}>{`MedNova uses ${PKGS.length} open-source packages and ${FONTS.length} font families. Tap a licence to see who made them and read its full text.`}</Text>
        <Text style={[ui.p, { color: c.mute }]}>The Trophy win effect animation is from LottieFiles, used under its free Lottie Simple License.</Text>
        <View style={ui.xsec}>
          <Group title="Fonts · SIL Open Font License 1.1" rows={FONTS.map((p) => p.f!)} text={TEXTS['OFL-1.1']} />
          {GROUPS.map(([l, list]) => (
            <Group key={l} title={`${l} · ${list.length}`} rows={list.map((p) => `${p.n} ${p.v}${p.c ? `  ${p.c}` : ''}`)} text={TEXTS[l]} />
          ))}
        </View>
      </InfoScroll>
    </Screen>
  );
}

function Group({ title, rows, text }: { title: string; rows: string[]; text?: string }) {
  const c = useInfo();
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  return (
    <View style={[s.g, { borderColor: c.line }]}>
      <Pressable onPress={() => setOpen(!open)} style={s.head} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={[s.title, { color: c.fg }]}>{title}</Text>
        <Text style={[s.chev, { color: c.mute }]}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open ? (
        <View style={s.body}>
          {rows.map((r) => (
            <Text key={r} style={[s.row, { color: c.mute }]} selectable>
              {r}
            </Text>
          ))}
          {text ? (
            <Pressable onPress={() => setFull(!full)} accessibilityRole="button">
              <Text style={[s.more, { color: c.t.accent }]}>{full ? 'Hide the licence' : 'Read the licence'}</Text>
            </Pressable>
          ) : null}
          {full && text ? (
            <Text style={[s.text, { color: c.mute }]} selectable>
              {text}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  g: { borderBottomWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', paddingVertical: u(11), gap: u(8) },
  title: { flex: 1, fontFamily: F.bodySemi, fontSize: u(11.5) },
  chev: { fontFamily: F.mono, fontSize: u(14) },
  body: { paddingBottom: u(12), gap: u(4) },
  row: { fontFamily: F.mono, fontSize: u(8), lineHeight: u(11.5) },
  more: { fontFamily: F.bodySemi, fontSize: u(10), marginTop: u(6) },
  text: { fontFamily: F.mono, fontSize: u(7.5), lineHeight: u(11), marginTop: u(4) },
});
