import { useFocusEffect } from 'expo-router';
import { Platform } from 'react-native';
import { useCallback } from 'react';

import { LINKS } from '@/features/store/links';
import { useStyle } from '@/features/style/useStyle';
import { shareText } from '@/lib/share';

import { ChallengesPage, type Task as TaskView } from './ChallengesPage';
import { ChestsPage } from './ChestsPage';
import { chestsOwned, loadChallenges, openChest, useChests, type Challenges, type Task } from './useChests';

const ROW: Record<Task['k'], (of: number) => { label: string; say: string }> = {
  games: (of) => ({ label: 'Play games', say: `play ${of} games` }),
  ads: (of) => ({ label: 'Watch ads', say: `watch ${of} ads` }),
  shares: (of) => ({ label: 'Share the app link', say: `share the link ${of} times` }),
  review: () => ({ label: 'Finish all review cards', say: 'finish all your review cards' }),
};
const UNIT: Record<Task['k'], string> = { games: 'games', ads: 'ads', shares: 'shares', review: 'review' };

const EMPTY: Task[][] = [
  [{ k: 'games', n: 0, of: 5 }],
  [{ k: 'games', n: 0, of: 8 }, { k: 'ads', n: 0, of: 5 }, { k: 'shares', n: 0, of: 5 }],
  [{ k: 'games', n: 0, of: 12 }, { k: 'shares', n: 0, of: 5 }, { k: 'review', n: 0, of: 1 }],
];

const useLoad = () =>
  useFocusEffect(
    useCallback(() => {
      void loadChallenges(true);
    }, []),
  );

/** "3 of 8 games, 1 of 5 ads" for the challenge counting now. */
function todayLine(c: Challenges | null) {
  if (!c) return 'Play 5 games to earn a wooden chest';
  if (c.step > 3) return 'New challenges at midnight';
  return c.tasks[c.step - 1].map((x) => (x.k === 'review' ? `review ${x.n >= x.of ? 'done' : 'to finish'}` : `${x.n} of ${x.of} ${UNIT[x.k]}`)).join(', ');
}

function resetIn(ms: number) {
  const left = Math.max(0, ms - Date.now());
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  return h ? `${h} h ${m} min` : `${m} min`;
}

export function ChestsScreen() {
  useLoad();
  const c = useChests((x) => x.c);
  const have = useStyle((x) => x.owned);
  return <ChestsPage v={{ owned: chestsOwned(c), have, today: { step: c?.step ?? 1, line: todayLine(c), streak: c?.streak ?? 0 }, open: openChest }} />;
}

const shareApp = () => shareText(`Learn medicine through games with me on MedNova: ${Platform.OS === 'android' ? LINKS.listingAndroid : LINKS.listing}`);

export function ChallengesScreen() {
  useLoad();
  const c = useChests((x) => x.c);
  const tasks = (c?.tasks ?? EMPTY).map((list) => list.map((x): TaskView => ({ ...ROW[x.k](x.of), n: x.n, of: x.of, share: x.k === 'shares' }))) as [TaskView[], TaskView[], TaskView[]];
  return (
    <ChallengesPage
      v={{
        step: c?.step ?? 1,
        tasks,
        streak: c?.streak ?? 0,
        resetIn: c ? resetIn(c.resets) : '',
        guest: c ? !c.signed_in : false,
        onShare: shareApp,
      }}
    />
  );
}
