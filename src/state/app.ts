import { create } from 'zustand';

import { defaultKV } from '@/games/engine/storage';
import { THEMES, type Mode } from '@/theme/tokens';

// The picked theme is kept on the phone so it survives a reload or restart.
const kv = defaultKV();
const MODE_KEY = 'theme';

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
  setMode: (mode) => {
    set({ mode });
    void kv.set(MODE_KEY, mode);
  },
  setMenu: (menuOpen) => set({ menuOpen }),
  setReport: (reportOpen) => set({ reportOpen }),
  setPlaying: (playing) => set({ playing }),
}));

void kv.get<Mode>(MODE_KEY).then((m) => {
  if (m === 'light' || m === 'dark') useApp.setState({ mode: m });
});

export const useTheme = () => THEMES[useApp((s) => s.mode)];
