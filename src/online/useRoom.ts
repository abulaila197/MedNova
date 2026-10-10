import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { roomState, type RoomState } from './api';
import { keepSame, oneAtATime } from '@/online/poll';

/**
 * Keeps a room's state fresh while the page is open: asks the server every 2 s (which also keeps your seat, rule 11).
 * Polling instead of live push keeps the pilot simple and works the same on web and phones.
 */
export function useRoom(roomId: string | undefined, every = 2000) {
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState(false);
  const live = useRef(true);
  const load = useCallback(async () => {
    if (!roomId) return;
    try {
      const s = await roomState(roomId);
      if (live.current) {
        setState((prev) => keepSame(prev, s));
        setError(false);
      }
    } catch {
      if (live.current) setError(true);
    }
  }, [roomId]);
  useFocusEffect(
    useCallback(() => {
      live.current = true;
      load();
      const poll = oneAtATime(load);
      const id = setInterval(() => AppState.currentState === 'active' && poll(), every);
      return () => {
        live.current = false;
        clearInterval(id);
      };
    }, [load, every]),
  );
  return { state, error, reload: load };
}
