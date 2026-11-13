import { useState } from 'react';
import { Image } from 'expo-image';
import { FlatList, type ImageSourcePropType, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/AppText';

import { Back } from '@/components/Back';
import { Fade } from '@/components/Fade';
import { PulseStar } from '@/components/PulseStar';
import { useLike } from '@/features/community/likes';
import { saveWallpaper, type SaveResult } from '@/features/community/save';
import { WALLPAPER_IDS, WALLPAPERS } from '@/features/community/Shelf';
import { tapped } from '@/lib/sound';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';
import { tr } from '@/i18n';

function WallPost({ src, id }: { src: ImageSourcePropType; id: string }) {
  const t = useTheme();
  const like = useLike(`wall:${id}`);
  const liked = like.mine;
  const [saved, setSaved] = useState<SaveResult | 'saving' | null>(null);
  const save = tapped(async () => {
    if (saved === 'saving') return;
    setSaved('saving');
    setSaved(await saveWallpaper(src, `mednova-wallpaper-${id.slice(1)}`));
  });
  const saveLabel = saved === 'saving' ? tr('Saving…') : saved === 'saved' ? tr('Saved') : saved === 'denied' ? tr('Allow photos to save') : saved === 'error' ? tr('Try again') : tr('Save');
  return (
    <View style={[s.post, { backgroundColor: t.panel, borderColor: t.panelLine }]}>
      <View style={s.by}>
        <PulseStar width={u(18)} height={u(18)} glow={0.3} />
        <Text style={[s.who, { color: t.fg }]}>{tr('MedNova')}</Text>
      </View>
      {/* The frame sets the shape; a bare Image takes the file's own height on web. */}
      <View style={s.photo}>
        <Image source={src} style={s.fill} contentFit="cover" transition={0} cachePolicy="disk" recyclingKey={id} accessibilityLabel={tr('Wallpaper {Number}', { Number: Number(id.slice(1)) })} />
      </View>
      <View style={s.acts}>
        <Pressable onPress={tapped(like.toggle)} style={[s.act, { borderColor: liked ? t.accent : t.chipLine, backgroundColor: t.chip }]} accessibilityRole="button" accessibilityState={{ selected: liked }} accessibilityLabel={liked ? tr('Unlike') : tr('Like')}>
          <Text style={[s.ico, { color: liked ? t.accent : t.mute }]}>{liked ? '♥' : '♡'}</Text>
          <Text style={[s.actT, { color: liked ? t.accent : t.fg }]}>{like.n}</Text>
        </Pressable>
        <Pressable onPress={save} style={[s.act, { borderColor: saved === 'saved' ? t.accent : t.chipLine, backgroundColor: t.chip }]} accessibilityRole="button" accessibilityLabel={tr('Save to photos')}>
          <Text style={[s.ico, { color: saved === 'saved' ? t.accent : t.mute }]}>⤓</Text>
          <Text style={[s.actT, { color: saved === 'saved' ? t.accent : t.fg }]}>{saveLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Nova Wallpapers (Yazan, 2026-10-13): one scrolling page of photo posts, each with a Like and a Save to photos.
 * 2026-11-02 (lag): a windowed list draws only the posts near the screen (all 30 full-size photos at once used
 * about 120 MB), and the edge fade is a still veil instead of a mask over the moving list.
 */
export function Wallpapers() {
  const t = useTheme();
  return (
    <Fade veil stops={[[0, 1], [0.86, 1], [1, 0]]} style={s.area}>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        data={WALLPAPER_IDS}
        keyExtractor={(id) => id}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        removeClippedSubviews
        ListHeaderComponent={
          <View style={{ gap: u(14), paddingBottom: u(14) }}>
            <Back label={tr('Community')} fallback="/community" />
            <View>
              <Text style={[s.kick, { color: t.kick }]}>{tr('NOVA COMMUNITY')}</Text>
              <Text style={[s.h2, { color: t.white }]}>
                {tr('Nova')} <Text style={{ fontFamily: F.displayItalic, color: t.accent }}>{tr('Wallpapers')}</Text>
              </Text>
            </View>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: u(14) }} />}
        renderItem={({ item, index }) => <WallPost src={WALLPAPERS[index]} id={item} />}
      />
    </Fade>
  );
}

const s = StyleSheet.create({
  area: { flex: 1, marginTop: u(16) },
  list: { paddingHorizontal: u(14), paddingBottom: u(90) },
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
