import { useFocusEffect } from 'expo-router';
import { Platform } from 'react-native';
import { useCallback } from 'react';

import { LINKS } from '@/features/store/links';
import { useStyle } from '@/features/style/useStyle';
import { shareText } from '@/lib/share';

import { ChallengesPage, type Task as TaskView } from './ChallengesPage';
import { ChestsPage } from './ChestsPage';
import { CHEST_NAME, loadRounds, useRoundsStore, weekName, type Rounds } from '@/features/rounds/useRounds';

import { chestsOwned, loadChallenges, openChest, useChests, type Task } from './useChests';
import { useSecond } from '@/lib/useSecond';

const ROW: Record<Task['k'], (of: number) => { label: string; say: string }> = {
  games: (of) => ({ label: 'Play different games', say: `play ${of} different games` }),
  ads: (of) => ({ label: 'Watch ads', say: `watch ${of} ads` }),
  shares: (of) => ({ label: 'Share the app link', say: `share the link ${of} times` }),
  review: () => ({ label: 'Finish all reviews on the Review page', say: 'finish all your reviews' }),
};

// Daily missions (Yazan 2026-10-26): what a guest sees, and the names and prizes if the server sends none.
const EMPTY: Task[][] = [
  [{ k: 'games', n: 0, of: 3 }],
  [{ k: 'games', n: 0, of: 5 }, { k: 'ads', n: 0, of: 5 }],
  [{ k: 'games', n: 0, of: 7 }, { k: 'shares', n: 0, of: 5 }, { k: 'review', n: 0, of: 1 }],
];
const NAMES = ['Warm-up', 'Full Shift', 'Overtime'];
const PRIZES = [10, 30, 50];

const useLoad = () =>
  useFocusEffect(
    useCallback(() => {
      void loadChallenges(true);
    }, []),
  );

function resetIn(ms: number, now: number) {
  const left = Math.max(0, ms - now);
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  return h ? `${h} h ${m} min` : `${m} min`;
}

/** "120 of 400 Sparks for the golden chest" for the Grand Rounds link card. */
function roundsLine(r: Rounds | null) {
  if (!r) return 'Use Sparks on the week\u2019s game to earn chests';
  if (r.claimed) return 'All 3 chests earned this week';
  const m = r.missions.find((x) => !x.claimed && r.used < x.of) ?? r.missions.find((x) => !x.claimed);
  return m ? `${Math.min(r.used, m.of)} of ${m.of} Sparks for the ${CHEST_NAME[m.chest].toLowerCase()}` : 'All 3 chests earned this week';
}

export function ChestsScreen() {
  useLoad();
  useFocusEffect(
    useCallback(() => {
      void loadRounds();
    }, []),
  );
  const c = useChests((x) => x.c);
  const r = useRoundsStore((x) => x.r);
  const have = useStyle((x) => x.owned);
  const rounds = { kick: r ? `GRAND ROUNDS · ${weekName(r.this).toUpperCase()}` : 'GRAND ROUNDS', line: roundsLine(r), run: r?.run ?? 0 };
  return <ChestsPage v={{ owned: chestsOwned(c), have, rounds, open: openChest }} />;
}

const shareApp = () => {
  const link = Platform.OS === 'android' ? LINKS.listingAndroid : LINKS.listing;
  return shareText(link ? `Learn medicine through games with me on MedNova: ${link}` : 'Learn medicine through games with me on MedNova!');
};

export function ChallengesScreen() {
  useLoad();
  const c = useChests((x) => x.c);
  const failed = useChests((x) => x.failed);
  // The "new challenges in" line ticks instead of keeping the time it was first drawn at (AP12b).
  const now = useSecond(!!c);
  const tasks = (c?.tasks ?? EMPTY).map((list) => list.map((x): TaskView => ({ ...ROW[x.k](x.of), n: x.n, of: x.of, share: x.k === 'shares' }))) as [TaskView[], TaskView[], TaskView[]];
  return (
    <ChallengesPage
      v={{
        step: c?.step ?? 1,
        tasks,
        names: c?.names ?? NAMES,
        prizes: c?.prizes ?? PRIZES,
        resetIn: c ? resetIn(c.resets, now) : '',
        guest: c ? !c.signed_in : false,
        offline: !c && failed,
        onShare: shareApp,
      }}
    />
  );
}
