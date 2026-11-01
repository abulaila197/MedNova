import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { roomState, type RoomState } from './api';
import { BACKUP_MS, usePushLine } from './push';
import { keepIfSame } from './same';

/**
 * Keeps a room's state fresh while the page is open: asks the server every 2 s (which also keeps your seat, rule 11).
 * A poll is skipped while the previous one is still waiting, and an unchanged answer keeps the old state.
 * Push (Yazan 2026-11-01): with the room's push line open, it asks when the server signals a change and every 10 s as a
 * backup (still well inside the 30 s that keeps a lobby seat); without it, every 2 s as before.
 */
export function useRoom(roomId: string | undefined, every = 2000) {
  const [state, setState] = useState<RoomState | null>(null);
  const [error, setError] = useState(false);
  const live = useRef(true);
  const busy = useRef(false);
  const load = useCallback(async () => {
    if (!roomId) return;
    try {
      const s = await roomState(roomId);
      if (live.current) {
        setState((prev) => keepIfSame(prev, s));
        setError(false);
      }
    } catch {
      if (live.current) setError(true);
    }
  }, [roomId]);
  const again = useRef(false);
  const poll = useCallback(() => {
    const go = () => {
      if (AppState.currentState !== 'active') return;
      if (busy.current) {
        again.current = true; // a push signal during an ask: one more ask follows
        return;
      }
      busy.current = true;
      // A request that never answers must not stop the room from refreshing (#17): give up on it after 3 s.
      const id = setTimeout(() => (busy.current = false), 3000);
      load().finally(() => {
        clearTimeout(id);
        busy.current = false;
        if (again.current) {
          again.current = false;
          go();
        }
      });
    };
    go();
  }, [load]);
  const pushed = usePushLine(roomId ? `room:${roomId}` : null, poll);
  const pace = pushed ? BACKUP_MS : every;
  useFocusEffect(
    useCallback(() => {
      live.current = true;
      poll();
      const id = setInterval(poll, pace);
      return () => {
        live.current = false;
        clearInterval(id);
      };
    }, [poll, pace]),
  );
  return { state, error, reload: load };
}
