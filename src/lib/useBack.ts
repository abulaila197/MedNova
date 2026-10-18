import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Android back button / back gesture (PB3). While `on`, a press calls `onBack` and is consumed, so the page under a
 * sheet, the menu or an online room isn't popped. The newest listener runs first, so a sheet opened over a room page
 * closes before the room's own guard sees the press.
 */
export function useBack(on: boolean, onBack: () => void) {
  const fn = useRef(onBack);
  useEffect(() => {
    fn.current = onBack;
  });
  useEffect(() => {
    if (!on || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      fn.current();
      return true;
    });
    return () => sub.remove();
  }, [on]);
}
