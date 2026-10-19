import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * The on-screen keyboard's height (0 when closed). SDK 57 Android apps are always edge-to-edge, so the window no
 * longer shrinks for the keyboard and anything anchored to the bottom must move itself (PB10).
 */
export function useKeyboardHeight(on = true) {
  const [h, setH] = useState(0);
  useEffect(() => {
    if (!on || Platform.OS === 'web') return;
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setH(e.endCoordinates.height));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setH(0));
    return () => {
      show.remove();
      hide.remove();
      setH(0);
    };
  }, [on]);
  return h;
}
