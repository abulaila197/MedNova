import type { ReactNode } from 'react';
import { safeEnter } from '@/lib/enter';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBack } from '@/lib/useBack';
import { useKeyboardHeight } from '@/lib/useKeyboard';
import { useTheme } from '@/state/app';
import { DESIGN_W, FRAME_W, TABLET, u, useBleed } from '@/theme/scale';

/** On a tablet a sheet is a phone-wide card centred at the bottom, not a strip across the whole screen. */
const SIDE = TABLET ? Math.max(0, (FRAME_W - u(DESIGN_W + 40)) / 2) : 0;

/** Bottom sheet over a dimmed page (used by Report and Play). */
// `still`: no slide or fade of its own. Inside an Android Modal the slide-in left taps landing off target, so small
// buttons like the story topics did nothing (2026-10-21); the Modal fades it in instead.
// Group 2 (Yazan 2026-11-07, the locked-online pop-up opened cut off): a sheet is never taller than the screen. When
// its content doesn't fit (big phone text, small screens), the content scrolls and `foot` (e.g. "Not now") stays
// visible at the bottom.
export function Sheet({ open, onClose, children, tone, lift = true, still = false, foot }: { open: boolean; onClose: () => void; children: ReactNode; tone?: { bg: string; line: string }; lift?: boolean; still?: boolean; foot?: ReactNode }) {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  // Android back closes the sheet instead of leaving the page under it.
  useBack(open, onClose);
  // The sheet rides on top of the keyboard, so a text box inside it stays visible (PB10). `lift={false}` for a
  // sheet inside a window that already resizes for the keyboard (an Android Modal).
  const kb = useKeyboardHeight(open && lift);
  const { height } = useWindowDimensions();
  const [box, setBox] = useState(0);
  const [inner, setInner] = useState(0);
  const bleed = useBleed();
  if (!open) return null;
  const up = kb ? Math.max(0, kb - (Platform.OS === 'web' ? 0 : ins.bottom)) : 0;
  const maxHeight = height - up - (Platform.OS === 'web' ? 0 : ins.top) - u(12);
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 20, left: -bleed, right: -bleed }]}>
      <Animated.View entering={still ? undefined : FadeIn.duration(250)} exiting={still ? undefined : FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,6,16,0.55)' }]} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View
        entering={still ? undefined : safeEnter(SlideInDown.duration(380))}
        exiting={still ? undefined : SlideOutDown.duration(250)}
        style={[s.sheet, { bottom: up, maxHeight, left: SIDE, right: SIDE, paddingBottom: u(22) + (Platform.OS === 'web' ? 0 : ins.bottom) }, { backgroundColor: tone?.bg ?? t.panel, borderColor: tone?.line ?? t.panelLine, shadowColor: '#000' }]}>
        <View style={[s.grab, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.inner}
          scrollEnabled={inner > box + 1}
          showsVerticalScrollIndicator={inner > box + 1}
          bounces={false}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          onLayout={(e) => setBox(e.nativeEvent.layout.height)}
          onContentSizeChange={(_, h) => setInner(h)}>
          {children}
        </ScrollView>
        {foot}
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
  scroll: { flexGrow: 0, flexShrink: 1 },
  inner: { gap: u(10) },
  grab: { alignSelf: 'center', width: u(36), height: u(4), borderRadius: u(4), marginBottom: u(2) },
});
