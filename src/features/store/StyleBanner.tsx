import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { Image } from 'expo-image';

import { DEAL_OFF, FRAMES, TITLES } from '@/features/style/catalog';
import { Framed, type FrameKey } from '@/features/style/Frame';
import { loadStyle, useStyle } from '@/features/style/useStyle';
import { useAccount } from '@/state/account';
import { u } from '@/theme/scale';
import type { Theme } from '@/theme/tokens';
import { F } from '@/theme/tokens';
import { tr } from '@/i18n';

const GOLD = '#e7c25a';
const GOLD_T = '#f3d98a';
const STICKER = require('../../../assets/stickers/text/comic-01.webp');

/**
 * The Style shop entry, first on Nova Store (Yazan 2026-11-15: "Wardrobe" boxes in the gold-and-velvet look of the
 * Showcase preview): one box per kind (frame, title, win effect, sticker), each showing a real item.
 */
export function StyleWardrobe({ t }: { t: Theme }) {
  const deal = useStyle((x) => x.deal);
  const avatar = useAccount((a) => a.profile?.avatar ?? 'yara');
  useEffect(() => {
    void loadStyle();
  }, []);
  const frame = FRAMES.find((x) => x.id === deal[0]);
  const title = TITLES.find((x) => x.id === deal[1]);
  const tile = (label: string, child: React.ReactNode) => (
    <View style={[b.tile, { borderColor: 'rgba(243,217,138,0.4)' }]}>
      <View style={b.tileArt}>{child}</View>
      <Text style={[b.tileT, { color: t.fg }]} numberOfLines={2}>{label}</Text>
    </View>
  );
  return (
    <Pressable onPress={() => router.navigate('/style' as never)} accessibilityRole="link" accessibilityLabel={tr('Open the Style shop')}>
      <LinearGradient colors={['#3a1458', '#1b1446', '#0c1638']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={[b.card, { borderColor: GOLD }]}>
        <View style={a.beam} />
        {/* Yazan 2026-11-15: the deal badge sits on the kicker's row, so "Dress your name" gets the whole width on one line. */}
        <View style={[b.top, { alignItems: 'center' }]}>
          <Text style={[a.k, { color: GOLD_T, flex: 1 }]}>{tr('STYLE SHOP')}</Text>
          {frame || title ? (
            <View style={[a.badge, { backgroundColor: '#ffd45a' }]}>
              <Text style={[a.badgeT, { color: '#2a1600' }]} numberOfLines={1}>{tr('{DEAL_OFF}% OFF THIS WEEK', { DEAL_OFF })}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[a.h, { color: t.white, textAlign: 'auto', alignSelf: 'stretch' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {tr('Dress your ')}
          <Text style={[a.h, { color: GOLD_T, fontFamily: F.displayItalic }]}>{tr('name')}</Text>
        </Text>
        <View style={b.grid}>
          {tile(tr('Frames'), <Framed slug={avatar} size={u(46)} frame={(frame?.key ?? 'gold') as FrameKey} />)}
          {tile(
            tr('Titles'),
            <View style={[a.chip, { borderColor: 'rgba(243,217,138,0.6)', marginTop: 0, paddingHorizontal: u(5), maxWidth: '100%' }]}>
              <Text style={[a.chipT, { color: GOLD_T, fontSize: u(9.5) }]} numberOfLines={1}>{title?.name ?? 'Night Owl'}</Text>
            </View>,
          )}
          {tile(tr('Win effects'), <Text style={{ fontSize: u(30) }}>🏆</Text>)}
          {tile(tr('Stickers'), <Image source={STICKER} style={{ width: u(46), height: u(46) }} contentFit="contain" />)}
        </View>
        <LinearGradient colors={['#f7dd8b', '#d39a2c']} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={[a.cta, { alignSelf: 'stretch', alignItems: 'center' }]}>
          <Text style={[a.ctaT, { color: '#2a1600' }]} numberOfLines={1}>{tr('Open the shop')}</Text>
        </LinearGradient>
      </LinearGradient>
    </Pressable>
  );
}

const a = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: u(22), paddingVertical: u(16), paddingHorizontal: u(14), marginTop: u(6), overflow: 'hidden', alignItems: 'center', gap: u(4) },
  beam: { position: 'absolute', top: '50%', marginTop: -u(130), alignSelf: 'center', width: u(220), height: u(260), borderRadius: u(130), backgroundColor: 'rgba(243,217,138,0.12)', boxShadow: '0px 0px 70px rgba(243,217,138,0.35)' },
  k: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.6) },
  h: { fontFamily: F.display, fontSize: u(21), lineHeight: u(25), textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: u(12), marginTop: u(8), direction: 'ltr' },
  sideFace: { opacity: 0.8, marginBottom: u(4) },
  stage: { width: '70%', height: u(10), borderRadius: 999, backgroundColor: 'rgba(243,217,138,0.16)', marginTop: -u(4) },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: u(3), paddingHorizontal: u(10), marginTop: u(4), maxWidth: '90%' },
  chipT: { fontFamily: F.bodyBold, fontSize: u(10), textAlign: 'center' },
  p: { fontFamily: F.body, fontSize: u(10), textAlign: 'center' },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: u(8), marginTop: u(8), flexWrap: 'wrap' },
  badge: { borderRadius: 999, paddingVertical: u(4), paddingHorizontal: u(9) },
  badgeT: { fontFamily: F.bodyBold, fontSize: u(8.5) },
  cta: { borderRadius: 999, paddingVertical: u(8), paddingHorizontal: u(18) },
  ctaT: { fontFamily: F.bodyBold, fontSize: u(11) },
});

const b = StyleSheet.create({
  card: { borderWidth: 1.5, borderRadius: u(22), padding: u(14), marginTop: u(6), overflow: 'hidden', gap: u(12) },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: u(8) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: u(8) },
  tile: { width: '47.5%', flexGrow: 1, borderWidth: 1, borderRadius: u(14), paddingVertical: u(8), paddingHorizontal: u(8), alignItems: 'center', gap: u(4), backgroundColor: 'rgba(255,255,255,0.06)' },
  tileArt: { alignSelf: 'stretch', height: u(50), alignItems: 'center', justifyContent: 'center' },
  tileT: { fontFamily: F.bodySemi, fontSize: u(10.5), textAlign: 'center' },
});
