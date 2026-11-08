import type { ReactNode } from 'react';
import { create } from 'zustand';

/**
 * #12 (Yazan 2026-11-01): a page with its own design (a game's own room, stage or office) shows that same
 * background beside the centred column on wide screens, mirrored (components/SideSky.tsx). `header` is the height of
 * the plain navy header band at the top of such a page, so the band runs on across the sides too.
 */
export type SideBg = { id: string; node: ReactNode; header: number };
export const useSideBg = create<{ bg: SideBg | null }>(() => ({ bg: null }));
export const setSideBg = (bg: SideBg) => useSideBg.setState({ bg });
export const clearSideBg = (id: string) => useSideBg.setState((s) => (s.bg?.id === id ? { bg: null } : s));
