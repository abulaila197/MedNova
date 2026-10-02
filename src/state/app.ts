import { create } from 'zustand';

import { THEMES, type Mode } from '@/theme/tokens';

type AppState = {
  mode: Mode;
  menuOpen: boolean;
  reportOpen: boolean;
  playing: string | null;
  setMode: (m: Mode) => void;
  setMenu: (open: boolean) => void;
  setReport: (open: boolean) => void;
  setPlaying: (name: string | null) => void;
};

export const useApp = create<AppState>((set) => ({
  mode: 'dark',
  menuOpen: false,
  reportOpen: false,
  playing: null,
  setMode: (mode) => set({ mode }),
  setMenu: (menuOpen) => set({ menuOpen }),
  setReport: (reportOpen) => set({ reportOpen }),
  setPlaying: (playing) => set({ playing }),
}));

export const useTheme = () => THEMES[useApp((s) => s.mode)];
