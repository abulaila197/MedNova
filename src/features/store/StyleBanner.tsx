import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/AppText';
import { DEAL_OFF, FRAMES, TITLES } from '@/features/style/catalog';
import { Framed, type FrameKey } from '@/features/style/Frame';
import { loadStyle, useStyle } from '@/features/style/useStyle';
import { useAccount } from '@/state/account';
import { u } from '@/theme/scale';
import type { Theme } from '@/theme/tokens';
import { F } from '@/theme/tokens';

/**
 * The way into the Style shop on Nova Shop (#48, Yazan 2026-10-31: more unique and eye-catching).
 * Yazan's pick (2026-11-01): "Spotlight", you, big, wearing this week's deal frame in a glow, with the deal and a button.
 */
export function StyleBanner({ t }: { t: Theme }) {
  const deal = useStyle((x) => x.deal);
  const avatar = useAccount((a) => a.profile?.avatar ?? 'yara');
  useEffect(() => {
    void loadStyle();
  }, []);
  const frame = FRAMES.find((x) => x.id === deal[0]);
  const title = TITLES.find((x) => x.id === deal[1]);
  const dealKey = (frame?.key ?? 'nova') as FrameKey;
  const dealLine = [frame && `${frame.name} frame`, title && `${title.name} title`].filter(Boolean).join(' + ');
  const open = () => router.navigate('/style' as never);

  return (
    <Pressable onPress={open} accessibilityRole="link" accessibilityLabel="Open the Style shop">
      <LinearGradient colors={['#2a1c6b', '#16245e', '#0d3a5c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.spot, { borderColor: 'rgba(164,139,255,0.45)' }]}>
        <View style={s.glow} />
        <View style={s.spotL}>
          <Text style={[s.k, { color: t.kick }]}>STYLE SHOP</Text>
          <Text style={[s.h, { color: t.white }]}>
            {'Dress your '}
            <Text style={[s.h, { color: t.accent, fontFamily: F.displayItalic }]}>name</Text>
          </Text>
          <Text style={[s.p, { color: 'rgba(255,255,255,0.75)' }]}>Frames, titles, win effects and stickers</Text>
          {dealLine ? (
            <View style={[s.badge, { backgroundColor: '#ffd45a' }]}>
              <Text style={[s.badgeT, { color: '#2a1600' }]}>{`${DEAL_OFF}% OFF · ${dealLine}`}</Text>
            </View>
          ) : null}
          <LinearGradient colors={[t.gradA, t.gradB]} start={{ x: 0, y: 0.4 }} end={{ x: 1, y: 0.6 }} style={s.cta}>
            <Text style={[s.ctaT, { color: t.onGrad }]} numberOfLines={1}>Open the shop</Text>
          </LinearGradient>
        </View>
        <View style={s.spotR}>
          <Framed slug={avatar} size={u(80)} frame={dealKey} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const s = StyleSheet.create({
  spot: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: u(20), padding: u(14), marginTop: u(6), overflow: 'hidden', minHeight: u(170) },
  glow: { position: 'absolute', right: -u(30), top: u(10), width: u(170), height: u(170), borderRadius: u(85), backgroundColor: 'rgba(111,214,255,0.22)', boxShadow: '0px 0px 60px rgba(111,214,255,0.55)' },
  spotL: { flex: 1, gap: u(4) },
  spotR: { width: u(100), alignItems: 'center', justifyContent: 'center' },
  k: { fontFamily: F.mono, fontSize: u(7.5), letterSpacing: u(1.4) },
  h: { fontFamily: F.display, fontSize: u(19), lineHeight: u(22) },
  p: { fontFamily: F.body, fontSize: u(10) },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingVertical: u(3), paddingHorizontal: u(8), marginTop: u(4) },
  badgeT: { fontFamily: F.bodyBold, fontSize: u(8.5) },
  cta: { alignSelf: 'flex-start', borderRadius: 999, paddingVertical: u(6), paddingHorizontal: u(13), marginTop: u(6) },
  ctaT: { fontFamily: F.bodyBold, fontSize: u(10.5) },
});
