import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { create } from 'zustand';

import { useSession } from '@/games/shell/session';
import { isHelpSeen, loadHelpSeen, markHelpSeen, useHelpSeen } from '@/state/helpSeen';
import { useStart } from '@/state/start';

import { WelcomeTour } from './WelcomeTour';

/** 'unknown' until the phone says whether the tour was seen; the daily reward waits for 'done'. */
export const useWelcome = create<{ state: 'unknown' | 'open' | 'done' }>(() => ({ state: 'unknown' }));

/** Shows the welcome tour once (per phone and per account, 2026-11-04), on the first Games page visit after the intro, before the daily reward. */
export function WelcomeHost() {
  const path = usePathname();
  const intro = useStart((s) => s.intro);
  const known = useSession((s) => s.known);
  const state = useWelcome((s) => s.state);
  const uid = useSession((s) => s.userId);
  const ready = useHelpSeen((s) => s.ready && s.owner === uid);
  useEffect(() => {
    if (known) loadHelpSeen();
  }, [known, uid]);

  useEffect(() => {
    if (state !== 'unknown' || !known || !ready || intro || path !== '/games') return;
    void isHelpSeen('welcome')
      .catch(() => false)
      .then((seen) => useWelcome.setState({ state: seen ? 'done' : 'open' }));
  }, [state, known, ready, intro, path]);

  if (state !== 'open') return null;
  return (
    <WelcomeTour
      onClose={() => {
        markHelpSeen('welcome');
        useWelcome.setState({ state: 'done' });
      }}
    />
  );
}
