import { create } from 'zustand';

/**
 * Holds the Learn pages still while a finger is on a card that scrolls (Yazan 2026-11-24: a long answer stopped
 * scrolling before its end). On Android the sideways pager takes the finger as soon as a swipe drifts a little to the
 * side, which cut the card's scroll short; while this is on, only the card moves. Swiping anywhere else turns pages.
 */
export const usePagerLock = create<{ locked: boolean }>(() => ({ locked: false }));
export function lockPager(locked: boolean) {
  if (usePagerLock.getState().locked !== locked) usePagerLock.setState({ locked });
}
