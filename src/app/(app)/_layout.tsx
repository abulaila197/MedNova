import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Menu } from '@/components/Menu';
import { PlaySheet } from '@/components/PlaySheet';
import { ReportSheet } from '@/components/ReportSheet';
import { LoadingHost } from '@/features/loading/LoadingHost';
import { FriendSheets } from '@/features/profile/FriendSheets';
import { InviteBanner } from '@/online/InviteBanner';
import { useApp, useTheme } from '@/state/app';
import { u } from '@/theme/scale';

/** The app: pages stack inside a card that the side menu pushes aside (locked "Journal index" menu). */
export default function AppLayout() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const open = useApp((s) => s.menuOpen);
  const setMenu = useApp((s) => s.setMenu);
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(open ? 1 : 0, { duration: 450, easing: Easing.bezier(0.3, 0.7, 0.2, 1) });
  }, [open, p]);
  const card = useAnimatedStyle(() => ({
    borderRadius: u(34) * p.value,
    shadowOpacity: 0.85 * p.value,
    transform: [{ perspective: 700 }, { translateX: width * 0.66 * p.value }, { rotateY: `${-22 * p.value}deg` }, { scale: 1 - 0.2 * p.value }],
  }));
  return (
    <View style={{ flex: 1, backgroundColor: t.sky }}>
      <Menu />
      <Animated.View style={[s.card, { transformOrigin: 'left center' }, card]}>
        <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: t.sky } }} />
        {open ? <Pressable style={s.catch} onPress={() => setMenu(false)} accessibilityLabel="Close menu" /> : null}
      </Animated.View>
      <LoadingHost />
      <ReportSheet />
      <PlaySheet />
      <FriendSheets />
      <InviteBanner />
    </View>
  );
}

const s = StyleSheet.create({
  card: { ...StyleSheet.absoluteFill, overflow: 'hidden', zIndex: 2, shadowColor: '#000', shadowOffset: { width: -30, height: 30 }, shadowRadius: 35 },
  catch: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8,10,25,0.25)' },
});
