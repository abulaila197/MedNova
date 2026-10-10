import { create } from 'zustand';

import { defaultKV } from '@/games/engine/storage';
import { useSession } from '@/games/shell/session';

// Where the app opens (Yazan, 2026-10-10):
//   first time            -> intro + onboarding slides -> sign-in
//   seen onboarding, signed in -> intro -> Games page
//   seen onboarding, not signed in (signed out or guest) -> intro -> sign-in
// Who is signed in comes from useSession (state/account.ts reads the saved session); this file only adds the slides.
const kv = defaultKV();
const SEEN = 'onboarding_seen';

type Start = {
  /** "seen the slides" has been read */
  seenRead: boolean;
  onboarded: boolean;
  /** the returning-user intro is still playing over the first page */
  intro: boolean;
};

export const useStart = create<Start>(() => ({ seenRead: false, onboarded: false, intro: false }));

/** The first page can be picked once both the slides flag and the saved session are known. */
export const useStartReady = () => {
  const seen = useStart((s) => s.seenRead);
  const known = useSession((s) => s.known);
  return seen && known;
};

let booted = false;
/** Reads the saved slides flag once at launch (from the root layout). Never throws. */
export function bootStart() {
  if (booted) return;
  booted = true;
  void kv
    .get<boolean>(SEEN)
    .catch(() => null)
    .then((s) => {
      const onboarded = s === true;
      useStart.setState({ seenRead: true, onboarded, intro: onboarded });
    });
}

/** The first page after launch. */
export function firstRoute() {
  if (!useStart.getState().onboarded) return '/onboarding' as const;
  return useSession.getState().userId ? ('/games' as const) : ('/auth' as const);
}

/** Called when the slides hand over to sign-in, so the next launch skips them. */
export function markOnboarded() {
  useStart.setState({ onboarded: true });
  void kv.set(SEEN, true);
}

export const endIntro = () => useStart.setState({ intro: false });
