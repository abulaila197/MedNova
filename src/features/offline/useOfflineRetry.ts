// While any page shows its saved copy (offline, #59), try the server again every 5 s (Yazan 2026-10-26), so buttons
// light up and the offline line goes away within seconds of being back online, without reopening the page.
import { useEffect } from 'react';

import { loadHunt, useHunt } from '@/features/cards/hunt';
import { loadChallenges, useChests } from '@/features/chests/useChests';
import { loadCases, useCases } from '@/features/learn/cases';
import { loadRounds, useRoundsStore } from '@/features/rounds/useRounds';
import { loadFree, useFree } from '@/features/store/FreeTokens';
import { loadStyle, useStyle } from '@/features/style/useStyle';
import { useSession } from '@/games/shell/session';
import { loadFriends, useFriends } from '@/state/friends';

const EVERY_MS = 5000;
let trying = false;

export function useOfflineRetry() {
  const userId = useSession((s) => s.userId);
  useEffect(() => {
    if (!userId) return;
    const id = setInterval(() => {
      // On a weak signal a try can take longer than 5 s: the next one waits for it instead of piling up.
      if (trying) return;
      const jobs: Promise<unknown>[] = [];
      if (useStyle.getState().savedAt != null) jobs.push(loadStyle());
      if (useFriends.getState().savedAt != null) jobs.push(loadFriends());
      if (useHunt.getState().savedAt != null) jobs.push(loadHunt());
      if (useChests.getState().savedAt != null) jobs.push(loadChallenges(true));
      if (useRoundsStore.getState().savedAt != null) jobs.push(loadRounds(true));
      if (useFree.getState().savedAt != null) jobs.push(loadFree());
      if (useCases.getState().savedAt != null) jobs.push(loadCases());
      if (!jobs.length) return;
      trying = true;
      void Promise.allSettled(jobs).finally(() => (trying = false));
    }, EVERY_MS);
    return () => clearInterval(id);
  }, [userId]);
}
