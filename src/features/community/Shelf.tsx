import { router, type Href } from 'expo-router';
import { Image, type ImageSourcePropType, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { tapped } from '@/lib/sound';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

// Stand-ins until Yazan's wallpaper and merch photos arrive.
export const WALLPAPERS: ImageSourcePropType[] = [
  require('@/assets/games/dark/the-diagnostic-pursuit.jpg'),
  require('@/assets/onboarding/nova-community.jpg'),
  require('@/assets/onboarding/learning-space.jpg'),
  require('@/assets/games/dark/the-riddler.jpg'),
  require('@/assets/onboarding/games.jpg'),
  require('@/assets/games/dark/trust-me-not.jpg'),
];
export const MERCH: ImageSourcePropType[] = [
  require('@/assets/games/dark/the-conqueror.jpg'),
  require('@/assets/games/dark/case-files-unsolved.jpg'),
  require('@/assets/games/dark/the-silent-artist.jpg'),
  require('@/assets/games/dark/the-wheels-of-chaos.jpg'),
  require('@/assets/games/dark/nova-medicordle.jpg'),
];

const W = 58; // one photo, phone-wallpaper shaped
const H = 92;

/**
 * A Community shelf (Yazan, 2026-10-13): a row of overlapping photos ending in a +. The + (or any photo) opens
 * `to`: the wallpaper viewer for Nova Wallpapers, Still rising for Nova merch.
 */
export function Shelf({ lead, em, note, photos, to }: { lead: string; em: string; note: string; photos: ImageSourcePropType[]; to: Href }) {
  const t = useTheme();
  const open = tapped(() => router.push(to));
  const n = photos.length;
  const step = 30;
  return (
    <Pressable onPress={open} style={[s.card, { backgroundColor: t.panel, borderColor: t.panelLine }]} accessibilityRole="button" accessibilityLabel={`${lead} ${em}, open`}>
      <View style={s.top}>
        <Text style={[s.kick, { color: t.kick }]}>{`${lead} ${em}`.toUpperCase()}</Text>
        <Text style={[s.note, { color: t.mute }]}>{note}</Text>
      </View>
      <Text style={[s.title, { color: t.white }]}>
        {lead} <Text style={{ fontFamily: F.displayItalic, color: t.accent }}>{em}</Text>
      </Text>
      <View style={[s.row, { height: u(H + 14) }]}>
        {photos.map((src, i) => {
          // A hand of cards spread from the left (Yazan's pick), tilting a little more each time.
          const tilt = -10 + (20 * i) / Math.max(1, n);
          const lift = Math.abs(tilt) * 0.35;
          return (
            <View
              key={i}
              style={[
                s.photo,
                { left: u(i * step), top: u(6 + lift), borderColor: t.panel, transform: [{ rotate: `${tilt}deg` }], zIndex: i },
              ]}>
              <Image source={src} style={s.img} resizeMode="cover" />
            </View>
          );
        })}
        <View
          style={[
            s.photo,
            s.plus,
            { left: u(n * step), top: u(6), borderColor: t.accent, backgroundColor: t.chip, zIndex: n, transform: [{ rotate: '10deg' }] },
          ]}>
          <Text style={[s.plusT, { color: t.accent }]}>+</Text>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: u(18), borderWidth: 1, paddingHorizontal: u(14), paddingTop: u(12), paddingBottom: u(10), overflow: 'hidden' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kick: { fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(1.7) },
  note: { fontFamily: F.body, fontSize: u(9.5) },
  title: { fontFamily: F.display, fontSize: u(20), lineHeight: u(23), marginTop: u(4) },
  row: { marginTop: u(8) },
  photo: { position: 'absolute', width: u(W), height: u(H), borderRadius: u(10), borderWidth: u(2), overflow: 'hidden', boxShadow: '0 6px 14px rgba(0,0,0,0.35)', transformOrigin: 'bottom center' },
  img: { width: '100%', height: '100%' },
  plus: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1.5 },
  plusT: { fontFamily: F.display, fontSize: u(30), lineHeight: u(34) },
});
