import { router, useFocusEffect } from 'expo-router';
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
import { GAMES } from '@/data/games';
import { rivalOfDay, todayWin } from '@/bots/daily';
import { loadRivals, useRivals } from '@/bots/memory';
import { tr } from '@/i18n';

const ROW: Record<Task['k'], (of: number) => { label: string; say: string }> = {
  games: (of) => ({ label: tr('Play different games'), say: tr('play {of} different games', { of }) }),
  ads: (of) => ({ label: tr('Watch ads'), say: tr('watch {of} ads', { of }) }),
  shares: (of) => ({ label: tr('Share the app link'), say: tr('share the link {of} times', { of }) }),
  review: () => ({ label: tr('Finish all reviews on the Review page'), say: tr('finish all your reviews') }),
};

// Daily missions (Yazan 2026-10-26): what a guest sees, and the names and prizes if the server sends none.
const EMPTY: Task[][] = [
  [{ k: 'games', n: 0, of: 3 }],
  [{ k: 'games', n: 0, of: 5 }, { k: 'ads', n: 0, of: 5 }],
  [{ k: 'games', n: 0, of: 7 }, { k: 'shares', n: 0, of: 5 }, { k: 'review', n: 0, of: 1 }],
];
const NAMES = [tr('Warm-up'), tr('Full Shift'), tr('Overtime')];
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
  return h ? tr('{h} h {m} min', { h, m }) : tr('{m} min', { m });
}

/** "120 of 400 Sparks for the golden chest" for the Grand Rounds link card. */
function roundsLine(r: Rounds | null) {
  if (!r) return tr('Use Sparks on the week’s game to earn chests');
  if (r.claimed) return tr('All 3 chests earned this week');
  const m = r.missions.find((x) => !x.claimed && r.used < x.of) ?? r.missions.find((x) => !x.claimed);
  return m ? tr('{n} of {of} Sparks for the {n2}', { n: Math.min(r.used, m.of), of: m.of, n2: CHEST_NAME[m.chest].toLowerCase() }) : tr('All 3 chests earned this week');
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
  const rounds = { kick: r ? tr('GRAND ROUNDS · {n}', { n: weekName(r.this).toUpperCase() }) : tr('GRAND ROUNDS'), line: roundsLine(r), run: r?.run ?? 0 };
  return <ChestsPage v={{ owned: chestsOwned(c), have, rounds, open: openChest }} />;
}

const shareApp = () => {
  const link = Platform.OS === 'android' ? LINKS.listingAndroid : LINKS.listing;
  return shareText(link ? tr('Learn medicine through games with me on MedNova: {link}', { link }) : tr('Learn medicine through games with me on MedNova!'));
};

export function ChallengesScreen() {
  useLoad();
  const c = useChests((x) => x.c);
  const failed = useChests((x) => x.failed);
  const savedAt = useChests((x) => x.savedAt);
  // The "new challenges in" line ticks instead of keeping the time it was first drawn at (AP12b).
  const now = useSecond(!!c);
  // G6: the rival of the day as a bonus mission; tapping it opens the Nemesis page.
  const day = useRivals((x) => todayWin(x.day));
  useFocusEffect(
    useCallback(() => {
      void loadRivals();
    }, []),
  );
  const boss = rivalOfDay();
  const bg = GAMES.find((g) => g.key === boss.game);
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
        savedAt,
        onShare: shareApp,
        boss: { name: boss.bot.name.split(' ')[0], face: boss.bot.character, game: bg ? `${bg.lead} ${bg.em}` : boss.game, won: !!day?.won, paid: !!day?.paid, onGo: () => router.push('/nemesis' as never) },
      }}
    />
  );
}
