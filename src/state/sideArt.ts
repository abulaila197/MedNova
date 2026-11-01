import { create } from 'zustand';

/**
 * #12 (Yazan 2026-11-01): what the page shows right now, for the sides of a centred column (components/SideSky.tsx).
 * The Games page sets its current game's drawing and where it sits on screen; null on every other page.
 */
export type SideArt = { src: number; top: number; height: number } | null;
export const useSideArt = create<{ art: SideArt }>(() => ({ art: null }));
export const setSideArt = (art: SideArt) => useSideArt.setState({ art });
