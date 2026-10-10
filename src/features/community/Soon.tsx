import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { cover, Feather } from '@/features/community/fx';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

const ART = {
  dark: require('@/assets/art/rising-dark.jpg'),
  light: require('@/assets/art/rising-light.jpg'),
};

// .soonart: 282 x 230, background cover at 50% 62%, mask radial-gradient(70% 62% at 50% 55%, #000 45%, transparent 85%)
const BW = 282;
const BH = 230;

/** "Still rising": the Community coming-soon screen. */
export function Soon() {
  const t = useTheme();
  return (
    <View style={s.soon}>
      <Feather
        source={ART[t.mode]}
        box={{ w: BW, h: BH }}
        place={cover(900, 900, BW, BH, 0.5, 0.62)}
        ellipse={{ cx: 0.5 * BW, cy: 0.55 * BH, rx: 0.7 * BW, ry: 0.62 * BH }}
        stops={[[0, 1], [0.45, 1], [0.85, 0]]}
        style={s.art}
      />
      <Text style={[s.kick, { color: t.kick }]}>NOVA COMMUNITY</Text>
      <Text style={[s.h2, { color: t.white }]}>
        Still <Text style={{ fontFamily: F.displayItalic, color: t.accent }}>rising</Text>
      </Text>
      <Text style={[s.p, { color: t.mute }]}>Reels, shorts, stories and posts from MedNova land here soon.</Text>
      <Pressable style={[s.nt, { backgroundColor: t.panel, borderColor: t.panelLine }]} accessibilityRole="button">
        <Text style={[s.ntT, { color: t.fg }]}>Notify me</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  soon: { marginTop: u(16), paddingTop: u(13), alignItems: 'center', gap: u(12) },
  art: { marginHorizontal: 0 },
  kick: { height: u(12), lineHeight: u(12), fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(1.7) },
  h2: { height: u(29), lineHeight: u(29), fontFamily: F.display, fontSize: u(30), overflow: 'visible' },
  p: { width: u(230), textAlign: 'center', fontFamily: F.body, fontSize: u(11), lineHeight: u(16.5) },
  nt: { marginTop: u(6), height: u(34), paddingHorizontal: u(16), borderRadius: 999, borderWidth: 1, justifyContent: 'center' },
  ntT: { fontFamily: F.bodySemi, fontSize: u(11) },
});
