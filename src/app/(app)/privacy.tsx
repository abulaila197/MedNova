import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import type Animated from 'react-native-reanimated';

import { Screen } from '@/components/Screen';
import { PRIVACY, TERMS, type Legal } from '@/features/info/content';
import { InfoScroll, Kicker, Rich, s as ui, useInfo } from '@/features/info/ui';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

const DOCS = { Privacy: PRIVACY, Terms: TERMS };
type Doc = keyof typeof DOCS;

/** Privacy & Terms, locked "P2 Plain words": each section opens with one plain serif line, the legal text below in small type. */
export default function Page() {
  const c = useInfo();
  const { doc: start } = useLocalSearchParams<{ doc?: string }>();
  const [doc, setDoc] = useState<Doc>(start === 'terms' ? 'Terms' : 'Privacy');
  const ref = useRef<Animated.ScrollView | null>(null);
  const choose = (d: Doc) => {
    setDoc(d);
    ref.current?.scrollTo({ y: 0, animated: false });
  };
  return (
    <Screen tab={null} glow={21}>
      <InfoScroll scrollRef={ref}>
        <View style={[s.pill, { backgroundColor: c.surf, borderColor: c.line }]}>
          {(Object.keys(DOCS) as Doc[]).map((d) => {
            const on = d === doc;
            return (
              <Pressable key={d} onPress={() => choose(d)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.seg, on && { backgroundColor: c.fg }]}>
                <Text style={[s.segT, { color: on ? c.pillOnText : c.mute }]}>{d}</Text>
              </Pressable>
            );
          })}
        </View>
        {DOCS[doc].map((x) => (
          <View key={doc + x.n} style={[ui.xsec, s.sec]}>
            <Kicker inSec>
              {x.n} · {x.k}
            </Kicker>
            <Rich text={x.plain} style={s.plain} />
            {x.legal.map((b, i) => (
              <Block key={i} b={b} first={i === 0} />
            ))}
          </View>
        ))}
      </InfoScroll>
    </Screen>
  );
}

/** One piece of legal text (.legal): a paragraph, optionally led by a bold phrase, or a list. */
function Block({ b, first }: { b: Legal; first: boolean }) {
  const c = useInfo();
  if ('li' in b) {
    return (
      <View style={[s.list, !first && s.next]}>
        {b.li.map((li) => (
          <View key={li} style={s.li}>
            <View style={[s.dot, { backgroundColor: c.kick }]} />
            <Text style={[s.legal, s.liT, { color: c.mute }]}>{li}</Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <Text style={[s.legal, !first && s.next, { color: c.mute }]}>
      {b.b ? <Text style={{ fontFamily: F.bodySemi, color: c.fg }}>{b.b} </Text> : null}
      {b.p}
    </Text>
  );
}

const s = StyleSheet.create({
  // .pill2: Privacy | Terms switch
  pill: { flexDirection: 'row', alignSelf: 'flex-start', marginTop: u(6), padding: u(3), borderRadius: 999, borderWidth: 1 },
  seg: { paddingVertical: u(5), paddingHorizontal: u(12), borderRadius: 999 },
  segT: { fontFamily: F.bodySemi, fontSize: u(10), lineHeight: u(12) },
  // .plain: the one plain serif line
  plain: { marginTop: u(6), fontSize: u(20), lineHeight: u(23) },
  // .legal: small muted text; as a <p> it keeps a 1em bottom margin (the section's paddingBottom)
  sec: { paddingBottom: u(9.5) },
  next: { marginTop: u(9.5) },
  legal: { marginTop: u(6), fontFamily: F.body, fontSize: u(9.5), lineHeight: u(14.725) },
  list: { marginTop: u(6), gap: u(4) },
  li: { flexDirection: 'row', gap: u(8) },
  liT: { flex: 1, marginTop: 0 },
  dot: { width: u(3), height: u(3), borderRadius: u(1.5), marginTop: u(6) },
});
