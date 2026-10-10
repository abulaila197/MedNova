import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Menu } from '@/components/Menu';
import { ReportSheet } from '@/components/ReportSheet';
import { LoadingHost } from '@/features/loading/LoadingHost';
import { pageCard } from '@/features/loading/snapshot';
import { FriendSheets } from '@/features/profile/FriendSheets';
import { InviteBanner } from '@/online/InviteBanner';
import { useApp, useTheme } from '@/state/app';
import { u, useScreen } from '@/theme/scale';

export { CrashScreen as ErrorBoundary } from '@/components/CrashScreen';

/** The app: pages stack inside a card that the side menu pushes aside (locked "Journal index" menu). */
export default function AppLayout() {
  const t = useTheme();
  const { width } = useScreen();
  const open = useApp((s) => s.menuOpen);
  const setMenu = useApp((s) => s.setMenu);
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(open ? 1 : 0, { duration: 450, easing: Easing.bezier(0.3, 0.7, 0.2, 1) });
  }, [open, p]);
  // The page slides and shrinks flat (Yazan, 2026-10-10): a 3D-tilted, round-clipped page is redrawn
  // every frame on phones, which stutters and tears.
  const card = useAnimatedStyle(() => ({ transform: [{ translateX: width * 0.66 * p.value }, { scale: 1 - 0.2 * p.value }] }));
  return (
    <View style={{ flex: 1, backgroundColor: t.sky }}>
      <Menu />
      <Animated.View ref={pageCard} collapsable={false} style={[s.card, { transformOrigin: 'left center' }, open && { borderRadius: u(34) }, card]} renderToHardwareTextureAndroid={open}>
        <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: t.sky } }} />
        {open ? <Pressable style={s.catch} onPress={() => setMenu(false)} accessibilityLabel="Close menu" /> : null}
      </Animated.View>
      <LoadingHost />
      <ReportSheet />
      <FriendSheets />
      <InviteBanner />
    </View>
  );
}

const s = StyleSheet.create({
  card: { ...StyleSheet.absoluteFill, overflow: 'hidden', zIndex: 2, shadowColor: '#000', shadowOffset: { width: -30, height: 30 }, shadowRadius: 35 },
  catch: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8,10,25,0.25)' },
});
