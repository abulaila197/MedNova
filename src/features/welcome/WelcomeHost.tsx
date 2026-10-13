import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { create } from 'zustand';

import { defaultKV } from '@/games/engine/storage';
import { useSession } from '@/games/shell/session';
import { useStart } from '@/state/start';

import { WelcomeTour } from './WelcomeTour';

const kv = defaultKV();
const SEEN = 'welcome:seen';

/** 'unknown' until the phone says whether the tour was seen; the daily reward waits for 'done'. */
export const useWelcome = create<{ state: 'unknown' | 'open' | 'done' }>(() => ({ state: 'unknown' }));

/** Shows the welcome tour once per phone, on the first Games page visit after the intro, before the daily reward. */
export function WelcomeHost() {
  const path = usePathname();
  const intro = useStart((s) => s.intro);
  const known = useSession((s) => s.known);
  const state = useWelcome((s) => s.state);

  useEffect(() => {
    if (state !== 'unknown' || !known || intro || path !== '/games') return;
    void kv
      .get<boolean>(SEEN)
      .catch(() => null)
      .then((seen) => useWelcome.setState({ state: seen ? 'done' : 'open' }));
  }, [state, known, intro, path]);

  if (state !== 'open') return null;
  return (
    <WelcomeTour
      onClose={() => {
        kv.set(SEEN, true).catch(() => {});
        useWelcome.setState({ state: 'done' });
      }}
    />
  );
}
