import { create } from 'zustand';

/**
 * Whether the phone has gone past the Games entrance page ("The programme", Yazan 2026-11-11) into the swipe pages.
 * Shut on every app start, so the entrance shows first; Start opens it, and Back or the Games tab shuts it again.
 */
export const useGamesGate = create<{ open: boolean }>(() => ({ open: false }));

export const openGames = () => useGamesGate.setState({ open: true });
export const shutGames = () => useGamesGate.setState({ open: false });
