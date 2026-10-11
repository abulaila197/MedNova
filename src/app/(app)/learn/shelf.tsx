import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { Screen } from '@/components/Screen';
import { Back } from '@/components/Back';
import { Fade } from '@/components/Fade';
import { BOOKS, DOSSIERS, type Dossier } from '@/features/learn/library';
import { useLearnColors } from '@/features/learn/palette';
import { useLearn } from '@/features/learn/useLearn';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/** One specialty book: an A to Z index drawer of the diseases you missed in it (RL6), with a letter rail. */
export default function ShelfPage() {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  const { book: key } = useLocalSearchParams<{ book?: string }>();
  const book = BOOKS.find((b) => b.key === key) ?? BOOKS[0];
  const { data } = useLearn();
  const list = useRef<ScrollView>(null);
  const tops = useRef<Record<string, number>>({});
  const mine = book.ids
    .filter((id) => data?.missed.has(id))
    .map((id) => DOSSIERS.get(id)!)
    .sort((a, b) => a.name.localeCompare(b.name));
  const groups = mine.reduce<{ letter: string; items: Dossier[] }[]>((acc, d) => {
    const l = d.name[0].toUpperCase();
    const g = acc.find((x) => x.letter === l);
    if (g) g.items.push(d);
    else acc.push({ letter: l, items: [d] });
    return acc;
  }, []);
  const words = book.name.split(' ');
  const row = (d: Dossier) => (
    <Pressable key={d.id} onPress={() => router.push(`/learn/dossier?id=${d.id}`)} style={[s.ir, { borderBottomColor: c.itemLine }]} accessibilityRole="button">
      <Text style={[s.irT, { color: c.itemText }]} numberOfLines={1}>
        {d.name}
      </Text>
      <Text style={[s.n, { color: c.miss }]}>{`×${data?.missed.get(d.id)?.count ?? 1}`}</Text>
    </Pressable>
  );
  return (
    <Screen tab="learn" glow={6}>
      <View style={s.dpb}>
        <View style={s.dtop}>
          <Back label="Dossiers" fallback="/learn" />
          <Text style={[s.cnt, { color: c.mute }]}>{`${mine.length} missed of ${book.ids.length}`.toUpperCase()}</Text>
        </View>
        <Text style={[s.dt, { color: t.fg }]}>
          {words.length > 1 ? `${words.slice(0, -1).join(' ')} ` : ''}
          <Text style={{ color: t.accent }}>{words[words.length - 1]}</Text>
        </Text>
        {data && !mine.length ? (
          <Text style={[s.none, { color: c.mute }]}>No misses here yet. Diseases you miss in The Diagnostic Pursuit, Case Files and The Riddler land in their book.</Text>
        ) : null}
        <Fade from={0.78} to={0.96} style={s.scr}>
          <ScrollView ref={list} showsVerticalScrollIndicator={false} contentContainerStyle={s.idx}>
            {groups.map((g) => (
              <View key={g.letter} onLayout={(e) => (tops.current[g.letter] = e.nativeEvent.layout.y)}>
                <Text style={[s.lt, { color: t.accent, borderBottomColor: c.letterLine }]}>{g.letter}</Text>
                {g.items.map(row)}
              </View>
            ))}
          </ScrollView>
          <View style={s.az}>
            {groups.map((g) => (
              <Pressable
                key={g.letter}
                hitSlop={{ top: u(3), bottom: u(3), left: u(8), right: u(8) }}
                onPress={() => list.current?.scrollTo({ y: tops.current[g.letter] ?? 0, animated: true })}
                accessibilityLabel={`Jump to ${g.letter}`}
              >
                <Text style={[s.azT, { color: c.rail }]}>{g.letter}</Text>
              </Pressable>
            ))}
          </View>
        </Fade>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  dpb: { flex: 1, paddingTop: u(14), paddingHorizontal: u(14), gap: u(8) },
  dtop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cnt: { fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(12), letterSpacing: u(0.85) },
  dt: { fontFamily: F.display, fontSize: u(30), lineHeight: u(30), letterSpacing: u(-0.6) },
  scr: { flex: 1 },
  idx: { paddingRight: u(17), paddingBottom: u(96) },
  lt: { fontFamily: F.mono, fontSize: u(9), lineHeight: u(12), letterSpacing: u(1.44), paddingTop: u(10), paddingBottom: u(4), borderBottomWidth: 1 },
  ir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: u(9), paddingHorizontal: u(2), borderBottomWidth: 1 },
  irT: { flexShrink: 1, fontFamily: F.display, fontSize: u(15), lineHeight: u(19) },
  n: { fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(12) },
  none: { fontFamily: F.body, fontSize: u(11), lineHeight: u(15), marginTop: u(6) },
  az: { position: 'absolute', right: 0, top: 0, width: u(5), paddingVertical: u(8), gap: u(7), alignItems: 'center' },
  azT: { fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(12) },
});
