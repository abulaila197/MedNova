import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { onlineStatus } from './api';

/** Why a game's Online card is locked: the Admin page locked it ('admin'), or this week's online share is used up ('resting'). */
export type OnlineLock = { why: 'admin' | 'resting'; day?: string } | null;

/**
 * Online lock (Yazan 2026-11-02): read on every visit to a game's page. Locked games show a lock on their Online card and
 * can't be picked; the server refuses them too (online_locked / online_resting), so an old phone can't get round it.
 * A failed check never locks anything.
 */
export function useOnlineLock(game: string): OnlineLock {
  const [lock, setLock] = useState<OnlineLock>(null);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      onlineStatus()
        .then((r) => {
          if (!live) return;
          const locked = r.locked ?? [];
          if (locked.includes('*') || locked.includes(game)) setLock({ why: 'admin' });
          else if (!r.open) setLock({ why: 'resting', day: r.day ?? undefined });
          else setLock(null);
        })
        .catch(() => {});
      return () => {
        live = false;
      };
    }, [game]),
  );
  return lock;
}
