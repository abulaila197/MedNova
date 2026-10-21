import { router, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { type ImageSourcePropType, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { tapped } from '@/lib/sound';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

// Yazan's wallpapers and merch photos (2026-10-13). Merch 05-06 are the printed mug cut from his two-mug shots.
export const WALLPAPERS: ImageSourcePropType[] = [
  require('@/assets/community/wallpapers/w01.jpg'),
  require('@/assets/community/wallpapers/w02.jpg'),
  require('@/assets/community/wallpapers/w03.jpg'),
  require('@/assets/community/wallpapers/w04.jpg'),
  require('@/assets/community/wallpapers/w05.jpg'),
  require('@/assets/community/wallpapers/w06.jpg'),
  require('@/assets/community/wallpapers/w07.jpg'),
  require('@/assets/community/wallpapers/w08.jpg'),
  require('@/assets/community/wallpapers/w09.jpg'),
  require('@/assets/community/wallpapers/w10.jpg'),
];
export const MERCH: ImageSourcePropType[] = [
  require('@/assets/community/merch/m01.jpg'),
  require('@/assets/community/merch/m02.jpg'),
  require('@/assets/community/merch/m03.jpg'),
  require('@/assets/community/merch/m04.jpg'),
  require('@/assets/community/merch/m05.jpg'),
  require('@/assets/community/merch/m06.jpg'),
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
