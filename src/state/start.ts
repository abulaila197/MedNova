import { create } from 'zustand';

import { defaultKV } from '@/games/engine/storage';
import { supabase } from '@/lib/supabase';

// Where the app opens (Yazan, 2026-10-10):
//   first time            -> intro + onboarding slides -> sign-in
//   seen onboarding, signed in -> intro -> Games page
//   seen onboarding, not signed in (signed out or guest) -> intro -> sign-in
const kv = defaultKV();
const SEEN = 'onboarding_seen';

type Start = {
  /** the saved state has been read, so the first page can be picked */
  ready: boolean;
  onboarded: boolean;
  signedIn: boolean;
  /** the returning-user intro is still playing over the first page */
  intro: boolean;
};

export const useStart = create<Start>(() => ({ ready: false, onboarded: false, signedIn: false, intro: false }));

let booted = false;
/** Reads the saved state once at launch (from the root layout). Never throws. */
export function bootStart() {
  if (booted) return;
  booted = true;
  const seen = kv.get<boolean>(SEEN).catch(() => null);
  const session = supabase.auth
    .getSession()
    .then(({ data }) => !!data.session)
    .catch(() => false);
  void Promise.all([seen, session]).then(([s, signedIn]) => {
    const onboarded = s === true;
    useStart.setState({ ready: true, onboarded, signedIn, intro: onboarded });
  });
}

/** The first page after launch. */
export function firstRoute() {
  const { onboarded, signedIn } = useStart.getState();
  if (!onboarded) return '/onboarding' as const;
  return signedIn ? ('/games' as const) : ('/auth' as const);
}

/** Called when the slides hand over to sign-in, so the next launch skips them. */
export function markOnboarded() {
  useStart.setState({ onboarded: true });
  void kv.set(SEEN, true);
}

export const endIntro = () => useStart.setState({ intro: false });
