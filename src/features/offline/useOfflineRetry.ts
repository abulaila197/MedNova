// While any page shows its saved copy (offline, #59), try the server again (Yazan 2026-10-26), so buttons light up
// and the offline line goes away soon after being back online, without reopening the page. The wait doubles after each
// try that still fails (5 s, 10 s, 20 s ... 2 min, Yazan 2026-11-16): a load that keeps failing with the server
// reachable no longer asks every 5 s for as long as the app is open. Coming back to the app tries at once.
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
      if (Date.now() < nextAt) return;
      trying = true;
      void Promise.allSettled(jobs.map((j) => j())).finally(() => {
        trying = false;
        wait = pending().length ? Math.min(wait * 2, MAX_MS) : FIRST_MS;
        nextAt = Date.now() + wait;
      });
    }, FIRST_MS);
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      wait = FIRST_MS;
      nextAt = 0;
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [userId]);
}
