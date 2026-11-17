import type { ReactNode } from 'react';
import { safeEnter } from '@/lib/enter';
import { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBack } from '@/lib/useBack';
import { useKeyboardHeight } from '@/lib/useKeyboard';
import { useTheme } from '@/state/app';
import { DESIGN_W, FRAME_W, TABLET, u, useBleed } from '@/theme/scale';
import { tr } from '@/i18n';

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
  // The space the sheet really has (Yazan 2026-11-18, the character pop-up ran over the header on a short phone): a
  // sheet sits inside its page, under the app header, so the window's height is too tall a limit. Measured in the
  // window, so a sheet in a full-screen Modal still keeps clear of the status bar.
  const area = useRef<View>(null);
  const [room, setRoom] = useState<{ top: number; h: number } | null>(null);
  const bleed = useBleed();
  if (!open) return null;
  const up = kb ? Math.max(0, kb - (Platform.OS === 'web' ? 0 : ins.bottom)) : 0;
  const bar = Platform.OS === 'web' ? 0 : ins.top;
  // u(28) of the page stays in view above a tall sheet, so it reads as a pop-up, not a new page.
  const maxHeight = (room ? room.h - Math.max(0, bar - room.top) : height - bar) - up - u(28);
  const measure = () =>
    area.current?.measureInWindow((_x, top, _w, h) => {
      if (h > 0) setRoom((r) => (r && r.top === top && r.h === h ? r : { top, h }));
    });
  return (
    // zIndex 35: above a pass-the-phone curtain (30), a countdown (30) and the chat (25). The pause menu hid under the
    // Sketch It curtain after the app came back, so "I'm ready" seemed dead (Yazan 2026-11-15).
    <View ref={area} onLayout={measure} style={[StyleSheet.absoluteFill, { zIndex: 35, start: -bleed, end: -bleed }]}>
      <Animated.View entering={still ? undefined : FadeIn.duration(250)} exiting={still ? undefined : FadeOut.duration(200)} style={StyleSheet.absoluteFill}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,6,16,0.55)' }]} onPress={onClose} accessibilityLabel={tr('Close')} />
      </Animated.View>
      {/* Drawn once its room is known, so it never opens too tall for a frame. */}
      {room ? (
      <Animated.View
        entering={still ? undefined : safeEnter(SlideInDown.duration(380))}
        exiting={still ? undefined : SlideOutDown.duration(250)}
        style={[s.sheet, { bottom: up, maxHeight, start: SIDE, end: SIDE, paddingBottom: u(22) + (Platform.OS === 'web' ? 0 : ins.bottom) }, { backgroundColor: tone?.bg ?? t.panel, borderColor: tone?.line ?? t.panelLine, shadowColor: '#000' }]}>
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
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  sheet: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    borderTopStartRadius: u(28),
    borderTopEndRadius: u(28),
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
