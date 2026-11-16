import { create } from 'zustand';

import { THEMES } from '@/theme/tokens';

type AppState = {
  menuOpen: boolean;
  /** When the side menu last closed (ms): the page card is still sliding back and growing for MENU_SETTLE_MS. */
  menuClosedAt: number;
  reportOpen: boolean;
  setMenu: (open: boolean) => void;
  setReport: (open: boolean) => void;
};

/** How long the page card takes to come back to full size after the menu closes (450 ms animation + margin). */
export const MENU_SETTLE_MS = 520;

export const useApp = create<AppState>((set) => ({
  menuOpen: false,
  menuClosedAt: 0,
  reportOpen: false,
  setMenu: (menuOpen) => set(menuOpen ? { menuOpen } : { menuOpen, menuClosedAt: Date.now() }),
  setReport: (reportOpen) => set({ reportOpen }),
}));

/** The app has one theme (dark only). Kept as a hook so screens read it the same way as before. */
export const useTheme = () => THEMES.dark;
