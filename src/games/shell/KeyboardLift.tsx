import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Platform, StyleSheet, View, type KeyboardEvent, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Keeps the bottom of a game board (the answer box) just above the on-screen keyboard (Yazan 2026-11-13: the player
 * must see what they type). SDK 57 Android apps are edge-to-edge, so the window no longer shrinks for the keyboard
 * and RN's KeyboardAvoidingView lifted too little on some phones. This measures where the wrapper's bottom sits in
 * the window and where the keyboard's top is, and lifts the content by exactly the overlap. If the window did
 * shrink (older Android), the overlap is 0 and nothing moves twice. With the keyboard closed it is a plain view.
 * `behavior` is kept for old callers; both lift the same way now.
 */
export function KeyboardLift({ style, children }: { style?: StyleProp<ViewStyle>; behavior?: 'padding' | 'height'; children: ReactNode }) {
  const [ref, by] = useKeyboardLift();
  return (
    <View ref={ref} style={s.fill} collapsable={false}>
      <View style={[style ?? s.fill, by ? { marginBottom: by } : null]}>{children}</View>
    </View>
  );
}

/** How far a view must lift so its bottom clears the keyboard. Attach `ref` to the view that fills the board. */
export function useKeyboardLift() {
  const ref = useRef<View>(null);
  const [by, setBy] = useState(0);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const ios = Platform.OS === 'ios';
    const place = (e: KeyboardEvent) => {
      const kbTop = e.endCoordinates.screenY;
      ref.current?.measureInWindow((_x, y, _w, h) => setBy(Math.max(0, Math.round(y + h - kbTop))));
    };
    const subs = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', place),
      Keyboard.addListener(ios ? 'keyboardWillChangeFrame' : 'keyboardDidChangeFrame', place),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setBy(0)),
    ];
    return () => subs.forEach((x) => x.remove());
  }, []);
  return [ref, by] as const;
}

const s = StyleSheet.create({ fill: { flex: 1 } });
