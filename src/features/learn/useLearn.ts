import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { type Card, loadLearn, pileOf, reviewState } from './library';

type Learn = { missed: Map<string, { count: number; last: number }>; pile: Card[] };

/** Learn's data, reloaded whenever a Learn page comes into view (a game may have just added misses). */
export function useLearn() {
  const [data, setData] = useState<Learn | null>(null);
  const reload = useCallback(async () => {
    const [{ missed, cards }, st] = await Promise.all([loadLearn(), reviewState()]);
    setData({ missed, pile: pileOf(cards, st) });
  }, []);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  return { data, reload };
}
