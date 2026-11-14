// Rule 4: when the app goes to the background the clock pauses, the case is hidden
// until the player resumes, and the pause is logged on the play. The same happens when another page opens over
// the game (the menu's pages, the Store from the coin, Sign in): the game waits paused underneath (Yazan, 2026-10-13).
import { useNavigation } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useApp } from '@/state/app';

/**
 * `backResumes` (Vs rivals, Yazan 2026-11-15): leaving the app stops the match without the pause menu, and coming
 * back carries on by itself. A page opened over the game or the side menu still pauses with the menu as before.
 */
export function usePauseHide(onPause: (why: 'away' | 'page') => void, onResume?: () => void, { backResumes = false }: { backResumes?: boolean } = {}) {
  const [hidden, setHidden] = useState(false);
  const hiddenRef = useRef(false);
  const awayRef = useRef(false);
  const pause = useEffectEvent((why: 'away' | 'page') => onPause(why));
  const back = useEffectEvent(() => {
    hiddenRef.current = false;
    setHidden(false);
    onResume?.();
  });
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      // Back in the app: arm again, so every later trip away pauses too (Yazan 2026-10-13).
      if (s === 'active') {
        if (backResumes && awayRef.current) {
          awayRef.current = false;
          back();
          return;
        }
        hiddenRef.current = false;
        return;
      }
      if (hiddenRef.current) return;
      hiddenRef.current = true;
      awayRef.current = true;
      setHidden(true);
      pause('away');
    });
    return () => sub.remove();
  }, []);
  // Covered by another page. Leaving for good (results, quitting) unmounts the game instead: that is not a pause.
  const nav = useNavigation();
  useEffect(() => {
    let mounted = true;
    const off = nav.addListener('blur', () => {
      setTimeout(() => {
        if (!mounted || hiddenRef.current) return;
        hiddenRef.current = true;
        setHidden(true);
        pause('page');
      }, 0);
    });
    return () => {
      mounted = false;
      off();
    };
  }, [nav]);
  // Opening the side menu from the game's header pauses it as well.
  useEffect(
    () =>
      useApp.subscribe((a, b) => {
        if (!a.menuOpen || b.menuOpen || hiddenRef.current) return;
        hiddenRef.current = true;
        setHidden(true);
        pause('page');
      }),
    [],
  );
  const resume = () => {
    hiddenRef.current = false;
    awayRef.current = false;
    setHidden(false);
    onResume?.();
  };
  return { hidden, resume };
}
