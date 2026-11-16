// While any page shows its saved copy (offline, #59), the page refreshes by itself once the server answers again
// (Yazan 2026-10-26), the way big apps do it (Yazan 2026-11-16):
// - It listens to the phone: with no internet it never asks the server; the moment the internet comes back it asks.
// - With internet, a load that still fails is a server-side failure that asking again soon won't fix: it waits
//   2 minutes between tries instead of 5 s.
// - A weak signal that the phone calls "online" gets the growing wait (5 s, 10 s, 20 s ... 2 min), with a small random
//   spread so phones don't all ask in the same second after an outage. Coming back to the app asks at once.
import * as Network from 'expo-network';
import { isOnline, onBackOnline } from '@/lib/net';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { loadHunt, useHunt } from '@/features/cards/hunt';
import { loadChallenges, useChests } from '@/features/chests/useChests';
import { loadCases, useCases } from '@/features/learn/cases';
import { loadRounds, useRoundsStore } from '@/features/rounds/useRounds';
import { loadFree, useFree } from '@/features/store/FreeTokens';
import { loadStyle, useStyle } from '@/features/style/useStyle';
import { useSession } from '@/games/shell/session';
import { loadFriends, useFriends } from '@/state/friends';

const FIRST_MS = 5000;
const MAX_MS = 120000;
let trying = false;

/** The loads whose page shows a saved copy right now. */
function pending(): (() => Promise<unknown>)[] {
  const jobs: (() => Promise<unknown>)[] = [];
  if (useStyle.getState().savedAt != null) jobs.push(() => loadStyle(true));
  if (useFriends.getState().savedAt != null) jobs.push(() => loadFriends());
  if (useHunt.getState().savedAt != null) jobs.push(() => loadHunt());
  if (useChests.getState().savedAt != null) jobs.push(() => loadChallenges(true));
  if (useRoundsStore.getState().savedAt != null) jobs.push(() => loadRounds(true));
  if (useFree.getState().savedAt != null) jobs.push(() => loadFree());
  if (useCases.getState().savedAt != null) jobs.push(() => loadCases());
  return jobs;
}

export function useOfflineRetry() {
  const userId = useSession((s) => s.userId);
  useEffect(() => {
    if (!userId) return;
    let wait = FIRST_MS;
    let nextAt = 0;
    const now = () => {
      wait = FIRST_MS;
      nextAt = 0;
    };
    const offBack = onBackOnline(now);
    // Looks every 5 s (on the phone only, no server call) whether a page waits; asks the server only when its turn comes.
    const id = setInterval(() => {
      // On a weak signal a try can take longer than the wait: the next one waits for it instead of piling up.
      if (trying) return;
      const jobs = pending();
      if (!jobs.length) {
        wait = FIRST_MS;
        nextAt = 0;
        return;
      }
      if (!isOnline() || Date.now() < nextAt) return;
      trying = true;
      void Promise.allSettled(jobs.map((j) => j()))
        .then(async () => {
          if (!pending().length) return (wait = FIRST_MS);
          // Still failing: with a solid connection the server itself is failing, so wait the longest; else keep growing.
          const st = await Network.getNetworkStateAsync().catch(() => null);
          wait = st?.isInternetReachable === true ? MAX_MS : Math.min(wait * 2, MAX_MS);
        })
        .finally(() => {
          trying = false;
          nextAt = Date.now() + wait * (0.85 + Math.random() * 0.3);
        });
    }, FIRST_MS);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && now());
    return () => {
      clearInterval(id);
      sub.remove();
      offBack();
    };
  }, [userId]);
}
