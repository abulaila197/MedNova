import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { I } from '@/features/store/FreeTokens';
import { LINKS } from '@/features/store/links';
import { tapped } from '@/lib/sound';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

// Nova Verse's four pages on the Community page, one tile each in one row (Yazan 2026-11-08, look B). Each tile's border
// takes its icon's colour: Instagram purple, YouTube red, Facebook blue, TikTok black (a black disc, white mark).
const PAGES = [
  { key: 'tiktok', name: 'TikTok', icon: '#ffffff', disc: '#000000', line: 'rgba(255,255,255,0.55)' },
  { key: 'instagram', name: 'Instagram', icon: '#b46cff', disc: 'rgba(180,108,255,0.16)', line: 'rgba(180,108,255,0.75)' },
  { key: 'facebook', name: 'Facebook', icon: '#3b8cff', disc: 'rgba(59,140,255,0.16)', line: 'rgba(59,140,255,0.75)' },
  { key: 'youtube', name: 'YouTube', icon: '#ff3b3b', disc: 'rgba(255,59,59,0.16)', line: 'rgba(255,59,59,0.75)' },
] as const;

/** Follow us: TikTok, Instagram, Facebook and YouTube as four tiles that open each page. */
export function Socials() {
  const t = useTheme();
  return (
    <View style={s.wrap}>
      <Text style={[s.kick, { color: t.kick }]}>FOLLOW NOVA VERSE</Text>
      <View style={s.row}>
        {PAGES.map((p) => {
          const Icon = I[p.key];
          return (
            <Pressable
              key={p.key}
              onPress={tapped(() => Linking.openURL(LINKS[p.key]).catch(() => {}))}
              accessibilityRole="link"
              accessibilityLabel={`MedNova on ${p.name}`}
              style={[s.tile, { backgroundColor: t.panel2, borderColor: p.line }]}>
              <View style={[s.disc, { backgroundColor: p.disc, borderColor: p.line }]}>
                <Icon size={u(20)} color={p.icon} />
              </View>
              <Text style={[s.name, { color: t.fg }]} numberOfLines={1}>
                {p.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: u(7) },
  kick: { fontFamily: F.mono, fontSize: u(8), letterSpacing: u(1.5), lineHeight: u(11) },
  row: { flexDirection: 'row', gap: u(7) },
  tile: { flex: 1, alignItems: 'center', gap: u(6), borderWidth: 1.5, borderRadius: u(16), paddingVertical: u(11) },
  disc: { width: u(38), height: u(38), borderRadius: u(19), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: F.bodySemi, fontSize: u(9.5), lineHeight: u(13) },
});
