// Rule 4: when the app goes to the background the clock pauses, the case is hidden
// until the player resumes, and the pause is logged on the play.
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export function usePauseHide(onPause: () => void, onResume?: () => void) {
  const [hidden, setHidden] = useState(false);
  const pauseRef = useRef(onPause);
  pauseRef.current = onPause;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') {
        setHidden((h) => {
          if (!h) pauseRef.current();
          return true;
        });
      }
    });
    return () => sub.remove();
  }, []);
  const resume = () => {
    setHidden(false);
    onResume?.();
  };
  return { hidden, resume };
}
