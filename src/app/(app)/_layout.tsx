import { Stack, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Menu } from '@/components/Menu';
import { ReportSheet } from '@/components/ReportSheet';
import { LoadingHost } from '@/features/loading/LoadingHost';
import { pageCard } from '@/features/loading/snapshot';
import { closeFriendSheet, FriendSheets } from '@/features/profile/FriendSheets';
import { InviteBanner } from '@/online/InviteBanner';
import { DailyHost } from '@/features/daily/DailyHost';
import { WelcomeHost } from '@/features/welcome/WelcomeHost';
import { HelpHost } from '@/features/welcome/HelpHost';
import { StyleHost } from '@/features/style/StyleHost';
import { RoundsHost } from '@/features/rounds/RoundsHost';
import { CardHost } from '@/features/cards/CardHost';
import { markVisited } from '@/features/achievements/useAchievements';
import { RechargeSheet } from '@/features/sparks/RechargeSheet';
import { cancelRecharge, watchSparks } from '@/features/sparks/sparks';
import { useStopSoundsOnLeave } from '@/lib/sound';
import { useBack } from '@/lib/useBack';
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
  useStopSoundsOnLeave();
  // Android back closes the open menu first (PB3).
  useBack(open, () => setMenu(false));
  // A sheet belongs to the page it opened on: going to another page (Android back included) closes it.
  const path = usePathname();
  const was = useRef(path);
  useEffect(() => {
    if (was.current === path) return;
    was.current = path;
    cancelRecharge();
    useApp.getState().setReport(false);
    closeFriendSheet();
  }, [path]);
  useEffect(watchSparks, []);
  // "Get to Know MedNova": each page outside the games counts once.
  useEffect(() => {
    void markVisited(path);
  }, [path]);
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
      <WelcomeHost />
      <HelpHost />
      <DailyHost />
      <RechargeSheet />
      <StyleHost />
      <RoundsHost />
      <CardHost />
    </View>
  );
}

const s = StyleSheet.create({
  card: { ...StyleSheet.absoluteFill, overflow: 'hidden', zIndex: 2, shadowColor: '#000', shadowOffset: { width: -12, height: 12 }, shadowRadius: 24, shadowOpacity: 0.1 },
  catch: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8,10,25,0.04)' },
});
