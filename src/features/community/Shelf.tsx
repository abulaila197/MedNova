import { router, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { type ImageSourcePropType, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { tapped } from '@/lib/sound';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

// Yazan's wallpapers and merch photos (2026-10-13). w11-w30 (2026-11-01, Group 11): the newer characters, 15 alone
// and 5 small groups. Merch (2026-10-27): mugs between the clothes, m02 the black mug kept from the first set.
const WALL: Record<string, ImageSourcePropType> = {
  w01: require('@/assets/community/wallpapers/w01.jpg'),
  w02: require('@/assets/community/wallpapers/w02.jpg'),
  w03: require('@/assets/community/wallpapers/w03.jpg'),
  w04: require('@/assets/community/wallpapers/w04.jpg'),
  w05: require('@/assets/community/wallpapers/w05.jpg'),
  w06: require('@/assets/community/wallpapers/w06.jpg'),
  w07: require('@/assets/community/wallpapers/w07.jpg'),
  w08: require('@/assets/community/wallpapers/w08.jpg'),
  w09: require('@/assets/community/wallpapers/w09.jpg'),
  w10: require('@/assets/community/wallpapers/w10.jpg'),
  w11: require('@/assets/community/wallpapers/w11.jpg'),
  w12: require('@/assets/community/wallpapers/w12.jpg'),
  w13: require('@/assets/community/wallpapers/w13.jpg'),
  w14: require('@/assets/community/wallpapers/w14.jpg'),
  w15: require('@/assets/community/wallpapers/w15.jpg'),
  w16: require('@/assets/community/wallpapers/w16.jpg'),
  w17: require('@/assets/community/wallpapers/w17.jpg'),
  w18: require('@/assets/community/wallpapers/w18.jpg'),
  w19: require('@/assets/community/wallpapers/w19.jpg'),
  w20: require('@/assets/community/wallpapers/w20.jpg'),
  w21: require('@/assets/community/wallpapers/w21.jpg'),
  w22: require('@/assets/community/wallpapers/w22.jpg'),
  w23: require('@/assets/community/wallpapers/w23.jpg'),
  w24: require('@/assets/community/wallpapers/w24.jpg'),
  w25: require('@/assets/community/wallpapers/w25.jpg'),
  w26: require('@/assets/community/wallpapers/w26.jpg'),
  w27: require('@/assets/community/wallpapers/w27.jpg'),
  w28: require('@/assets/community/wallpapers/w28.jpg'),
  w29: require('@/assets/community/wallpapers/w29.jpg'),
  w30: require('@/assets/community/wallpapers/w30.jpg'),
};
/** The Wallpapers page, mixed old and new (Yazan 2026-11-01). Each id is the file, for likes and saved file names. */
export const WALLPAPER_IDS = ['w26', 'w15', 'w01', 'w22', 'w20', 'w02', 'w23', 'w21', 'w05', 'w14', 'w13', 'w03', 'w24', 'w16', 'w08', 'w30', 'w12', 'w04', 'w29', 'w19', 'w09', 'w25', 'w27', 'w06', 'w11', 'w18', 'w10', 'w28', 'w17', 'w07'];
export const WALLPAPERS: ImageSourcePropType[] = WALLPAPER_IDS.map((id) => WALL[id]);
/** The Community shelf's hand (Yazan 2026-11-01): the moon cradle and the robot dinner, plus 4 new ones, mixed. */
// Small copies for the shelf hands (Yazan 2026-11-02, lag): 12 full-size photos shrunk into small cards cost
// about 50 MB of memory; the full pictures load only on the wallpaper page.
export const SHELF_WALLPAPERS: ImageSourcePropType[] = [
  require('@/assets/community/thumbs/w26.jpg'),
  require('@/assets/community/thumbs/w04.jpg'),
  require('@/assets/community/thumbs/w28.jpg'),
  require('@/assets/community/thumbs/w11.jpg'),
  require('@/assets/community/thumbs/w01.jpg'),
  require('@/assets/community/thumbs/w17.jpg'),
];
export const MERCH: ImageSourcePropType[] = [
  require('@/assets/community/thumbs/m01.jpg'),
  require('@/assets/community/thumbs/m02.jpg'),
  require('@/assets/community/thumbs/m03.jpg'),
  require('@/assets/community/thumbs/m04.jpg'),
  require('@/assets/community/thumbs/m05.jpg'),
  require('@/assets/community/thumbs/m06.jpg'),
];

const W = 58; // one photo, phone-wallpaper shaped
const H = 92;
const SHOWN = 6; // the hand holds at most this many; the + opens the rest

/**
 * A Community shelf (Yazan, 2026-10-13): a row of overlapping photos ending in a +. The + (or any photo) opens
 * `to`: the wallpaper viewer for Nova Wallpapers, Still rising for Nova merch.
 */
export function Shelf({ lead, em, note, photos, to }: { lead: string; em: string; note?: string; photos: ImageSourcePropType[]; to: Href }) {
  const t = useTheme();
  const open = tapped(() => router.push(to));
  const hand = photos.slice(0, SHOWN);
  const n = hand.length;
  const step = 30;
  return (
    <Pressable onPress={open} style={[s.card, { backgroundColor: t.panel, borderColor: t.panelLine }]} accessibilityRole="button" accessibilityLabel={`${lead} ${em}, open`}>
      <View style={s.top}>
        <Text style={[s.kick, { color: t.kick }]}>{`${lead} ${em}`.toUpperCase()}</Text>
        {note ? <Text style={[s.note, { color: t.mute }]}>{note}</Text> : null}
      </View>
      <Text style={[s.title, { color: t.white }]}>
        {lead} <Text style={{ fontFamily: F.displayItalic, color: t.accent }}>{em}</Text>
      </Text>
      <View style={[s.row, { height: u(H + 14) }]}>
        {hand.map((src, i) => {
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
              <Image source={src} style={s.img} contentFit="cover" transition={0} cachePolicy="memory" />
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
