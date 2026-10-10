import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/AppText';
import Svg, { Circle, Line } from 'react-native-svg';

import { Screen } from '@/components/Screen';
import { CHAPTERS, SCORING, type Faq } from '@/features/info/content';
import { Fade } from '@/features/info/Fade';
import { InfoScroll, Kicker, Rich, s as ui, useInfo } from '@/features/info/ui';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

const SEARCH = 'search';

/** FAQ, locked "Chapters, revised": numbered areas (search first), a section tag, one card per question with +/−. */
export default function Page() {
  const c = useInfo();
  const [area, setArea] = useState('02');
  const [open, setOpen] = useState<Record<string, boolean>>({ [CHAPTERS[1].items[0].q]: true });
  const [query, setQuery] = useState('');
  const toggle = (q: string) => setOpen((o) => ({ ...o, [q]: !o[q] }));
  const ch = CHAPTERS.find((x) => x.n === area);
  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return CHAPTERS.flatMap((x) => x.items).filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
  }, [query]);

  return (
    <Screen tab={null} glow={21} under={<Orb />}>
      <InfoScroll>
        <Kicker>MedNova · Support</Kicker>
        <Rich text={'Answers before\nthe *next case.*'} style={[ui.H, s.H]} />

        <Fade from={0.85} horizontal style={s.areasWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.areas}>
            <Pressable onPress={() => setArea(SEARCH)} accessibilityRole="button" accessibilityLabel="Search questions" style={[s.area, s.searchChip, { backgroundColor: c.surf, borderColor: area === SEARCH ? c.areaOnLine : c.line }]}>
              <SearchGlyph color={area === SEARCH ? c.fg : c.mute} />
            </Pressable>
            {CHAPTERS.map((x) => {
              const on = x.n === area;
              return (
                <Pressable key={x.n} onPress={() => setArea(x.n)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.area, { backgroundColor: c.surf, borderColor: on ? c.areaOnLine : c.line }]}>
                  {on ? (
                    <LinearGradient colors={[c.t.gradA, c.t.gradB]} start={{ x: 0, y: 0.41 }} end={{ x: 1, y: 0.59 }} style={s.no}>
                      <Text style={[s.noT, { color: c.t.onGrad }]}>{x.n}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[s.no, { backgroundColor: c.surf2 }]}>
                      <Text style={[s.noT, { color: c.kick }]}>{x.n}</Text>
                    </View>
                  )}
                  <Text style={[s.areaT, { color: on ? c.fg : c.mute }]}>{x.chip}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Fade>

        {ch ? (
          <>
            <View style={s.fqh}>
              <Text style={[s.h4, { color: c.fg }]}>{ch.title}</Text>
              <Text style={[s.tag, { color: c.mute }]}>
                {ch.n} · {ch.tag.toUpperCase()}
              </Text>
            </View>
            {ch.items.map((f) => (
              <Card key={f.q} f={f} open={!!open[f.q]} onPress={() => toggle(f.q)} />
            ))}
          </>
        ) : (
          <>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search questions"
              placeholderTextColor={c.mute}
              autoFocus
              style={[s.search, { backgroundColor: c.surf, borderColor: c.line, color: c.fg }]}
            />
            {query.trim() && !found.length ? <Text style={[s.none, { color: c.mute }]}>No question matches “{query.trim()}”.</Text> : null}
            <View style={s.found}>
              {found.map((f) => (
                <Card key={f.q} f={f} open={!!open[f.q]} onPress={() => toggle(f.q)} />
              ))}
            </View>
          </>
        )}
      </InfoScroll>
    </Screen>
  );
}

/** One question card (.qc): a header row with +/−, the answer underneath when open. */
function Card({ f, open, onPress }: { f: Faq; open: boolean; onPress: () => void }) {
  const c = useInfo();
  return (
    <View style={[s.qc, { backgroundColor: c.surf, borderColor: open ? c.openLine : c.line }]}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }} style={[s.qh, open && { backgroundColor: c.surf2 }]}>
        <Text style={[s.qhT, { color: c.fg }]}>{f.q}</Text>
        <Text style={[s.sign, { color: open ? c.openSign : c.mute }]}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open ? (
        <View style={s.qa}>
          <Text style={[s.qaT, { color: c.mute }]}>{f.a}</Text>
          {f.scoring ? (
            <View style={s.sc}>
              {SCORING.map((x) => (
                <View key={x.k} style={[s.scCell, { backgroundColor: c.surf2 }]}>
                  <Text style={[s.scK, { color: c.mute }]}>{x.k}</Text>
                  <Text style={[s.scV, { color: x.neg ? c.neg : c.fg }]}>{x.v}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** The ⚲ search mark of the first area chip. */
function SearchGlyph({ color }: { color: string }) {
  return (
    <Svg width={u(9)} height={u(12)} viewBox="0 0 9 12">
      <Circle cx={4.5} cy={4} r={3} stroke={color} strokeWidth={1} fill="none" />
      <Line x1={4.5} y1={7} x2={4.5} y2={11.5} stroke={color} strokeWidth={1} />
    </Svg>
  );
}

/** .fq-orb: a faint ring off the right edge with a dashed ring inside it (behind the header). */
function Orb() {
  const c = useInfo();
  const ring = c.lt ? 'rgba(229,131,58,0.14)' : 'rgba(111,214,255,0.14)';
  const dash = c.lt ? 'rgba(184,116,31,0.14)' : 'rgba(201,184,255,0.14)';
  return (
    <View pointerEvents="none" style={s.orb}>
      <Svg width="100%" height="100%" viewBox="0 0 240 240">
        <Circle cx={120} cy={120} r={119.5} stroke={ring} strokeWidth={1} fill="none" />
        <Circle cx={120} cy={120} r={83.5} stroke={dash} strokeWidth={1} strokeDasharray="3 3" fill="none" />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  H: { fontSize: u(31), lineHeight: u(29.45), letterSpacing: u(-0.31) },
  orb: { position: 'absolute', left: u(132), top: u(40), width: u(240), height: u(240) },
  // .areas: full-bleed swipeable row, fades out at the right edge
  areasWrap: { marginTop: u(14), marginHorizontal: u(-18) },
  areas: { paddingHorizontal: u(18), gap: u(6) },
  area: { flexDirection: 'row', alignItems: 'center', gap: u(6), height: u(30), paddingLeft: u(6), paddingRight: u(10), borderRadius: u(12), borderWidth: 1 },
  searchChip: { width: u(25), paddingLeft: 0, paddingRight: 0, justifyContent: 'center' },
  areaT: { fontFamily: F.bodySemi, fontSize: u(10) },
  no: { height: u(16), paddingHorizontal: u(5), borderRadius: u(6), justifyContent: 'center' },
  noT: { fontFamily: F.mono, fontSize: u(8) },
  fqh: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: u(16), marginBottom: u(8) },
  h4: { fontFamily: F.display, fontSize: u(22), lineHeight: u(28) },
  tag: { flexShrink: 0, fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.2) },
  qc: { borderRadius: u(16), borderWidth: 1, marginBottom: u(7), overflow: 'hidden' },
  qh: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: u(10), paddingVertical: u(11), paddingHorizontal: u(13) },
  qhT: { flex: 1, fontFamily: F.bodySemi, fontSize: u(11.5), lineHeight: u(14) },
  sign: { fontFamily: F.body, fontSize: u(15), lineHeight: u(19) },
  qa: { paddingTop: u(9), paddingHorizontal: u(13), paddingBottom: u(12) },
  qaT: { fontFamily: F.body, fontSize: u(10), lineHeight: u(15.5) },
  sc: { flexDirection: 'row', gap: u(4), marginTop: u(8) },
  scCell: { flex: 1, alignItems: 'center', paddingVertical: u(5), borderRadius: u(8) },
  scK: { fontFamily: F.mono, fontSize: u(7), lineHeight: u(9), marginBottom: u(2) },
  scV: { fontFamily: F.mono, fontSize: u(8), lineHeight: u(10) },
  search: { marginTop: u(16), paddingVertical: u(9), paddingHorizontal: u(12), borderRadius: u(14), borderWidth: 1, fontFamily: F.body, fontSize: u(11), outlineStyle: 'none' } as object,
  none: { marginTop: u(10), fontFamily: F.body, fontSize: u(10), lineHeight: u(15.5) },
  found: { marginTop: u(10) },
});
