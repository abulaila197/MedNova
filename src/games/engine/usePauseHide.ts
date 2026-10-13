// Rule 4: when the app goes to the background the clock pauses, the case is hidden
// until the player resumes, and the pause is logged on the play.
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AppState } from 'react-native';

export function usePauseHide(onPause: () => void, onResume?: () => void) {
  const [hidden, setHidden] = useState(false);
  const hiddenRef = useRef(false);
  const pause = useEffectEvent(() => onPause());
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      // Back in the app: arm again, so every later trip away pauses too (Yazan 2026-10-13).
      if (s === 'active') {
        hiddenRef.current = false;
        return;
      }
      if (hiddenRef.current) return;
      hiddenRef.current = true;
      setHidden(true);
      pause();
    });
    return () => sub.remove();
  }, []);
  const resume = () => {
    hiddenRef.current = false;
    setHidden(false);
    onResume?.();
  };
  return { hidden, resume };
}
