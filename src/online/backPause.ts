import type { Dispatch, SetStateAction } from 'react';

import { useBack } from '@/lib/useBack';

/**
 * Android back in a live online match opens the game's own pause menu, in that game's look, and a second press
 * closes it (Yazan, 2026-10-19). Leaving the room stays a choice inside the pause menu. Registered by the game's
 * screen, so it runs before the live page's listener.
 */
export function useBackPause(open: boolean, setOpen: Dispatch<SetStateAction<boolean>>) {
  useBack(true, () => setOpen(!open));
}
