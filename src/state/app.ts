import { create } from 'zustand';

import { THEMES } from '@/theme/tokens';

type AppState = {
  menuOpen: boolean;
  reportOpen: boolean;
  setMenu: (open: boolean) => void;
  setReport: (open: boolean) => void;
};

export const useApp = create<AppState>((set) => ({
  menuOpen: false,
  reportOpen: false,
  setMenu: (menuOpen) => set({ menuOpen }),
  setReport: (reportOpen) => set({ reportOpen }),
}));

/** The app has one theme (dark only). Kept as a hook so screens read it the same way as before. */
export const useTheme = () => THEMES.dark;
