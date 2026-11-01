import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { BAKED } from '@/features/start/baked';
import { NAVY } from '@/features/start/Sky';
import { useSideArt } from '@/state/sideArt';
import { FRAME_W } from '@/theme/scale';
import { THEMES } from '@/theme/tokens';

const PAGE = require('@/assets/images/backdrop/page.png');
/** The start flow (intro, onboarding, sign-in) draws the nebula sky; every other page draws the page backdrop. */
const START = ['/auth', '/onboarding'];
const LOOK = {
  page: { art: PAGE, base: THEMES.dark.sky },
  start: { art: BAKED.sky, base: NAVY },
};

/**
 * #12 (Yazan 2026-11-01, option A): on tablets and short phones the app is a centred column. Each side shows the
 * column's own sky mirrored, so the colours run on from the column's edge with no seam and no plain bars, and a
 * soft shade darkens them towards the screen's edge so the eye stays on the page. Nothing is drawn when the column
 * fills the screen.
 */
export function SideSky() {
  const { width } = useWindowDimensions();
  const path = usePathname();
  const art = useSideArt((s) => s.art);
  const side = (width - FRAME_W) / 2;
  if (side < 1) return null;
  const look = START.some((p) => path.startsWith(p)) ? LOOK.start : LOOK.page;
  const mirror = (left: number) => (
    <View style={[s.edge, { left, width: FRAME_W, transform: [{ scaleX: -1 }] }]}>
      <Image source={look.art} contentFit="fill" transition={0} accessibilityIgnoresInvertColors style={StyleSheet.absoluteFill} />
      {/* the page's own drawing (the Games page's game), mirrored at the same place, so its light runs on */}
      {art ? <Image source={art.src} contentFit="fill" transition={150} blurRadius={4} style={{ position: 'absolute', left: 0, top: art.top, width: FRAME_W, height: art.height, opacity: 0.9 }} /> : null}
    </View>
  );
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: look.base, overflow: 'hidden' }]}>
      {mirror(side - FRAME_W + 1)}
      {mirror(side + FRAME_W - 1)}
      <LinearGradient colors={[SHADE, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.edge, { left: 0, width: side }]} />
      <LinearGradient colors={['transparent', SHADE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.edge, { left: side + FRAME_W, width: side }]} />
    </View>
  );
}

const SHADE = 'rgba(5,8,22,0.55)';
const s = StyleSheet.create({ edge: { position: 'absolute', top: 0, bottom: 0 } });
