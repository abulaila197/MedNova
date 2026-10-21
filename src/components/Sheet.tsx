import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBack } from '@/lib/useBack';
import { useKeyboardHeight } from '@/lib/useKeyboard';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';

/** Bottom sheet over a dimmed page (used by Report and Play). */
// `still`: no slide or fade of its own. Inside an Android Modal the slide-in left taps landing off target, so small
// buttons like the story topics did nothing (2026-10-21); the Modal fades it in instead.
export function Sheet({ open, onClose, children, tone, lift = true, still = false }: { open: boolean; onClose: () => void; children: ReactNode; tone?: { bg: string; line: string }; lift?: boolean; still?: boolean }) {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  // Android back closes the sheet instead of leaving the page under it.
  useBack(open, onClose);
  // The sheet rides on top of the keyboard, so a text box inside it stays visible (PB10). `lift={false}` for a
  // sheet inside a window that already resizes for the keyboard (an Android Modal).
  const kb = useKeyboardHeight(open && lift);
  if (!open) return null;
  const up = kb ? Math.max(0, kb - (Platform.OS === 'web' ? 0 : ins.bottom)) : 0;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 20 }]}>
      <Animated.View entering={still ? undefined : FadeIn.duration(250)} exiting={still ? undefined : FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,6,16,0.55)' }]} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View
        entering={still ? undefined : SlideInDown.duration(380)}
        exiting={still ? undefined : SlideOutDown.duration(250)}
        style={[s.sheet, { bottom: up, paddingBottom: u(22) + (Platform.OS === 'web' ? 0 : ins.bottom) }, { backgroundColor: tone?.bg ?? t.panel, borderColor: tone?.line ?? t.panelLine, shadowColor: '#000' }]}>
        <View style={[s.grab, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
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
