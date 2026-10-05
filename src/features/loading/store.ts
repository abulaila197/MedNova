import { create } from 'zustand';

/** A loading page run: which game, where its Play button sat (window y) and which Games page was showing. */
export type LoadRun = { key: string; y: number; at: number; id: number };

export const useLoading = create<{ run: LoadRun | null; start: (key: string, y: number, at: number) => void; end: () => void }>((set, get) => ({
  run: null,
  start: (key, y, at) => {
    if (!get().run) set({ run: { key, y, at, id: Date.now() } });
  },
  end: () => set({ run: null }),
}));
