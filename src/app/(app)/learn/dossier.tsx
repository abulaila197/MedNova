import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Screen } from '@/components/Screen';
import { Back } from '@/components/Back';
import { DISCLAIMER } from '@/features/info/content';
import { DOSSIER, type Field } from '@/features/learn/data';
import { useLearnColors } from '@/features/learn/palette';
import { VText } from '@/features/learn/VText';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

// Folder tab heights from the locked preview (they size to their labels).
const TAB_H = [69, 51, 51, 79, 56];

/** A disease dossier: a folder card whose five tabs on the right switch the field. */
export default function DossierPage() {
  const t = useTheme();
  const c = useLearnColors(t.mode);
  const [on, setOn] = useState(0);
  return (
    <Screen tab="learn" glow={6}>
      <View style={s.dpb}>
        <View style={s.dtop}>
          <Back label={DOSSIER.shelf} fallback="/learn/shelf" />
          <Text style={[s.ms, { color: c.miss }]}>{DOSSIER.status.toUpperCase()}</Text>
        </View>
        <Text style={[s.dt, { color: t.fg }]}>
          {DOSSIER.first} <Text style={{ color: t.accent, fontFamily: F.displayItalic }}>{DOSSIER.em}</Text>
        </Text>
        <View style={s.dm}>
          <View style={[s.sw, { backgroundColor: c.swatch, borderColor: c.swatchLine }]} />
          <Text style={[s.dmT, { color: c.mute }]}>{DOSSIER.meta}</Text>
        </View>
        <View style={s.fold}>
          <View style={[s.fcard, { borderColor: c.cardLine, boxShadow: c.cardShadow }]}>
            <LinearGradient colors={[c.fcardA, c.fcardB]} style={[StyleSheet.absoluteFill, s.fbg]} />
            {DOSSIER.fields.map((f, i) => (
              <Pane key={f.key} f={f} on={i === on} />
            ))}
            {/* Inside the folder's empty foot: below it the Games button covers the page. */}
            <Text style={[s.dmT, s.note, { color: c.mute }]}>{DISCLAIMER}</Text>
          </View>
          <View style={s.ftabs}>
            {DOSSIER.fields.map((f, i) => {
              const sel = i === on;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setOn(i)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={f.tab}
                  style={[s.tab, { height: u(TAB_H[i]) }, sel ? { backgroundColor: c.tabOn, borderColor: c.tabOnLine, marginLeft: -1, width: u(30) + 1 } : { backgroundColor: c.tabOff, borderColor: c.tabOffLine }]}
                >
                  <VText h={u(TAB_H[i]) - 2} line={u(10)} dir="down" style={{ fontFamily: F.mono, fontSize: u(7), letterSpacing: u(0.42), color: sel ? t.accent : c.tabOffText }}>
                    {f.tab.toUpperCase()}
                  </VText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Screen>
  );
}

/** One field of the folder: fades and settles into place when its tab is chosen. */
function Pane({ f, on }: { f: Field; on: boolean }) {
  const t = useTheme();
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(on ? 1 : 0, { duration: 400, easing: Easing.ease });
  }, [on, p]);
  const st = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: u(8) * (1 - p.value) }] }));
  return (
    <Animated.View style={[s.fp, st]} pointerEvents={on ? 'auto' : 'none'}>
      <Text style={[s.cf, { color: t.accent }]}>{f.label.toUpperCase()}</Text>
      <Text style={[s.p, { color: t.fg }]}>{f.text}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  dpb: { flex: 1, paddingTop: u(14), paddingHorizontal: u(14), gap: u(8) },
  dtop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ms: { fontFamily: F.mono, fontSize: u(8.5), lineHeight: u(12), letterSpacing: u(1.02) },
  dt: { fontFamily: F.display, fontSize: u(28), lineHeight: u(28), letterSpacing: u(-0.56) },
  dm: { flexDirection: 'row', alignItems: 'center', gap: u(6) },
  sw: { width: u(16), height: u(6), borderRadius: u(2), borderWidth: 1 },
  dmT: { fontFamily: F.body, fontSize: u(10), lineHeight: u(12) },
  note: { position: 'absolute', left: u(16), right: u(12), bottom: u(12), fontSize: u(8.5) },
  fold: { flexDirection: 'row', marginTop: u(6), height: u(322) },
  fcard: {
    flex: 1,
    borderWidth: 1,
    borderRightWidth: 0,
    borderTopLeftRadius: u(18),
    borderBottomLeftRadius: u(18),
    borderBottomRightRadius: u(18),
  },
  fbg: { borderTopLeftRadius: u(17), borderBottomLeftRadius: u(17), borderBottomRightRadius: u(18) },
  fp: { ...StyleSheet.absoluteFill, paddingVertical: u(18), paddingHorizontal: u(14), gap: u(10) },
  cf: { fontFamily: F.mono, fontSize: u(9), lineHeight: u(12), letterSpacing: u(1.62) },
  p: { fontFamily: F.display, fontSize: u(16), lineHeight: u(21.12) },
  ftabs: { width: u(30), gap: u(4) },
  tab: { width: u(30), borderWidth: 1, borderLeftWidth: 0, borderTopRightRadius: u(10), borderBottomRightRadius: u(10), justifyContent: 'center' },
});
