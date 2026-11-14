import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useScreen } from '@/theme/scale';

/**
 * Keeps the bottom of a game board (the answer box) just above the on-screen keyboard (Yazan 2026-11-13: the player
 * must see what they type). 2026-11-15: the keyboard's height now comes from Reanimated, which reads it from the
 * window insets on Android (edge-to-edge apps never shrink their window, and the old screenY maths left the box under
 * the keyboard on Yazan's phone). The wrapper's bottom is measured once; the content lifts by the overlap, on the
 * UI thread, following the keyboard as it slides. With the keyboard closed it is a plain view.
 * `behavior` is kept for old callers.
 */
export function KeyboardLift({ style, children }: { style?: StyleProp<ViewStyle>; behavior?: 'padding' | 'height'; children: ReactNode }) {
  const ref = useRef<View>(null);
  const kb = useAnimatedKeyboard();
  const { height: H } = useScreen();
  // How far the wrapper's bottom sits above the screen's bottom (the dock, the phone's own buttons).
  const below = useSharedValue(0);
  const measure = () => ref.current?.measureInWindow((_x, y, _w, h) => (below.value = Math.max(0, H - (y + h))));
  const lift = useAnimatedStyle(() => ({ marginBottom: Math.max(0, kb.height.value - below.value) }));
  if (Platform.OS === 'web') return <View style={[s.fill, style]}>{children}</View>;
  return (
    <View ref={ref} style={s.fill} collapsable={false} onLayout={measure}>
      <Animated.View style={[style ?? s.fill, lift]}>{children}</Animated.View>
    </View>
  );
}

/** True while the on-screen keyboard is open (to tuck away what isn't needed while typing). */
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const subs = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setOpen(true)),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setOpen(false)),
    ];
    return () => subs.forEach((x) => x.remove());
  }, []);
  return open;
}

const s = StyleSheet.create({ fill: { flex: 1 } });
