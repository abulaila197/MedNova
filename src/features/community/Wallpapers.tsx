import { useState } from 'react';
import { Image, type ImageSourcePropType, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { Back } from '@/components/Back';
import { Fade } from '@/components/Fade';
import { PulseStar } from '@/components/PulseStar';
import { saveWallpaper, type SaveResult } from '@/features/community/save';
import { WALLPAPERS } from '@/features/community/Shelf';
import { tapped } from '@/lib/sound';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

const two = (x: number) => String(x).padStart(2, '0');

function WallPost({ src, i }: { src: ImageSourcePropType; i: number }) {
  const t = useTheme();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState<SaveResult | 'saving' | null>(null);
  const save = tapped(async () => {
    if (saved === 'saving') return;
    setSaved('saving');
    setSaved(await saveWallpaper(src, `mednova-wallpaper-${two(i + 1)}`));
  });
  const saveLabel = saved === 'saving' ? 'Saving…' : saved === 'saved' ? 'Saved' : saved === 'denied' ? 'Allow photos to save' : saved === 'error' ? 'Try again' : 'Save';
  return (
    <View style={[s.post, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
      <View style={s.by}>
        <PulseStar width={u(18)} height={u(18)} glow={0.3} />
        <Text style={[s.who, { color: t.fg }]}>MedNova</Text>
      </View>
      {/* The frame sets the shape; a bare Image takes the file's own height on web. */}
      <View style={s.photo}>
        <Image source={src} style={s.fill} resizeMode="cover" accessibilityLabel={`Wallpaper ${i + 1}`} />
      </View>
      <View style={s.acts}>
        <Pressable onPress={tapped(() => setLiked(!liked))} style={[s.act, { borderColor: liked ? t.accent : t.chipLine, backgroundColor: t.chip }]} accessibilityRole="button" accessibilityState={{ selected: liked }} accessibilityLabel={liked ? 'Unlike' : 'Like'}>
          <Text style={[s.ico, { color: liked ? t.accent : t.mute }]}>{liked ? '♥' : '♡'}</Text>
          <Text style={[s.actT, { color: liked ? t.accent : t.fg }]}>{liked ? 1 : 0}</Text>
        </Pressable>
        <Pressable onPress={save} style={[s.act, { borderColor: saved === 'saved' ? t.accent : t.chipLine, backgroundColor: t.chip }]} accessibilityRole="button" accessibilityLabel="Save to photos">
          <Text style={[s.ico, { color: saved === 'saved' ? t.accent : t.mute }]}>⤓</Text>
          <Text style={[s.actT, { color: saved === 'saved' ? t.accent : t.fg }]}>{saveLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Nova Wallpapers (Yazan, 2026-10-13): one scrolling page of photo posts, each with a Like and a Save to photos. */
export function Wallpapers() {
  const t = useTheme();
  return (
    <Fade stops={[[0, 1], [0.86, 1], [1, 0]]} style={s.area}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
        <Back label="Community" fallback="/community" />
        <View>
          <Text style={[s.kick, { color: t.kick }]}>NOVA COMMUNITY</Text>
          <Text style={[s.h2, { color: t.white }]}>
            Nova <Text style={{ fontFamily: F.displayItalic, color: t.accent }}>Wallpapers</Text>
          </Text>
        </View>
        {WALLPAPERS.map((src, i) => (
          <WallPost key={i} src={src} i={i} />
        ))}
      </ScrollView>
    </Fade>
  );
}

const s = StyleSheet.create({
  area: { flex: 1, marginTop: u(16) },
  list: { paddingHorizontal: u(14), gap: u(14), paddingBottom: u(90) },
  kick: { marginTop: u(4), lineHeight: u(12), fontFamily: F.mono, fontSize: u(8.5), letterSpacing: u(1.7) },
  h2: { marginTop: u(3), fontFamily: F.display, fontSize: u(25), lineHeight: u(28) },
  post: { borderRadius: u(18), borderWidth: 1, overflow: 'hidden' },
  by: { flexDirection: 'row', alignItems: 'center', gap: u(7), paddingHorizontal: u(12), paddingVertical: u(9) },
  who: { fontFamily: F.bodySemi, fontSize: u(11.5), flex: 1 },
  photo: { width: '100%', aspectRatio: 768 / 1376 }, // Yazan's wallpapers are phone-shaped; show them whole
  fill: { width: '100%', height: '100%' },
  acts: { flexDirection: 'row', gap: u(8), padding: u(10) },
  act: { flexDirection: 'row', alignItems: 'center', gap: u(6), borderWidth: 1, borderRadius: 999, paddingHorizontal: u(12), paddingVertical: u(6) },
  ico: { fontSize: u(13) },
  actT: { fontFamily: F.bodySemi, fontSize: u(11.5) },
});
