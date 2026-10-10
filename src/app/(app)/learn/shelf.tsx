import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { Screen } from '@/components/Screen';
import { Back } from '@/features/learn/Back';
import { NEUROLOGY, type Disease } from '@/features/learn/data';
import { Fade } from '@/features/learn/Fade';
import { useLearnColors } from '@/features/learn/palette';
import { Toggle } from '@/features/learn/Toggle';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

/** Group the shelf A to Z under its first letters. */
const GROUPS = NEUROLOGY.reduce<{ letter: string; items: Disease[] }[]>((acc, d) => {
  const l = d.name[0].toUpperCase();
  const g = acc.find((x) => x.letter === l);
  if (g) g.items.push(d);
  else acc.push({ letter: l, items: [d] });
  return acc;
}, []);
const MISSED = NEUROLOGY.filter((d) => d.mark === 'miss').length;
const MASTERED = NEUROLOGY.filter((d) => d.mark === 'done').length;

/** Neurology shelf: an A to Z index drawer of its dossiers, with a letter rail. */
export default function ShelfPage() {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  const [filter, setFilter] = useState(1);
  const misses = filter === 0;
  const list = useRef<ScrollView>(null);
  const tops = useRef<Record<string, number>>({});
  const open = () => router.push('/learn/dossier');
  const row = (d: Disease) => (
    <Pressable key={d.name} onPress={open} style={[s.ir, { borderBottomColor: c.itemLine }]} accessibilityRole="button">
      <Text style={[s.irT, { color: c.itemText }]} numberOfLines={1}>
        {d.name}
      </Text>
      <View style={[s.mk, { backgroundColor: d.mark === 'miss' ? c.miss : d.mark === 'done' ? t.accent : c.dotPlain }]} />
    </Pressable>
  );
  return (
    <Screen tab="learn" glow={6}>
      <View style={s.dpb}>
        <View style={s.dtop}>
          <Back label="Dossiers" fallback="/learn" />
          <Text style={[s.cnt, { color: c.mute }]}>{`${MASTERED} of ${NEUROLOGY.length} mastered`.toUpperCase()}</Text>
        </View>
        <Text style={[s.dt, { color: t.fg }]}>
          Neuro<Text style={{ color: t.accent }}>logy</Text>
        </Text>
        <Toggle options={[{ label: 'My misses', count: MISSED }, { label: `All ${NEUROLOGY.length}` }]} value={filter} onChange={setFilter} />
        <Fade from={0.78} to={0.96} style={s.scr}>
          <ScrollView ref={list} showsVerticalScrollIndicator={false} contentContainerStyle={s.idx}>
            {misses
              ? NEUROLOGY.filter((d) => d.mark === 'miss').map(row)
              : GROUPS.map((g) => (
                  <View key={g.letter} onLayout={(e) => (tops.current[g.letter] = e.nativeEvent.layout.y)}>
                    <Text style={[s.lt, { color: t.accent, borderBottomColor: c.letterLine }]}>{g.letter}</Text>
                    {g.items.map(row)}
                  </View>
                ))}
          </ScrollView>
          <View style={s.az}>
            {GROUPS.map((g) => (
              <Pressable
                key={g.letter}
                hitSlop={{ top: u(3), bottom: u(3), left: u(8), right: u(8) }}
                onPress={() => !misses && list.current?.scrollTo({ y: tops.current[g.letter] ?? 0, animated: true })}
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
  mk: { width: u(6), height: u(6), borderRadius: u(6) },
  az: { position: 'absolute', right: 0, top: 0, width: u(5), paddingVertical: u(8), gap: u(7), alignItems: 'center' },
  azT: { fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(12) },
});
