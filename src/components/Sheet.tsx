import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';

/** Bottom sheet over a dimmed page (used by Report and Play). */
export function Sheet({ open, onClose, children, tone }: { open: boolean; onClose: () => void; children: ReactNode; tone?: { bg: string; line: string } }) {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  if (!open) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 20 }]}>
      <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,6,16,0.55)' }]} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View
        entering={SlideInDown.duration(380)}
        exiting={SlideOutDown.duration(250)}
        style={[s.sheet, { paddingBottom: u(22) + (Platform.OS === 'web' ? 0 : ins.bottom) }, { backgroundColor: tone?.bg ?? t.panel, borderColor: tone?.line ?? t.panelLine, shadowColor: t.mode === 'light' ? 'rgba(60,50,30,0.5)' : '#000' }]}>
        <View style={[s.grab, { backgroundColor: t.mode === 'light' ? 'rgba(40,36,28,0.15)' : 'rgba(255,255,255,0.2)' }]} />
        {children}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: u(28),
    borderTopRightRadius: u(28),
    borderTopWidth: 1,
    paddingTop: u(10),
    paddingHorizontal: u(18),
    paddingBottom: u(22),
    gap: u(10),
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 1,
    shadowRadius: 20,
  },
  grab: { alignSelf: 'center', width: u(36), height: u(4), borderRadius: u(4), marginBottom: u(2) },
});
