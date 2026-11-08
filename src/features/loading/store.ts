import { create } from 'zustand';

import { dropShot, snapPage } from './snapshot';

/** A loading page run: which game, where its Play button sat (window y) and the picture the doors are cut from. */
export type LoadRun = { key: string; y: number; shot: string | null; id: number };

type Loading = { run: LoadRun | null; busy: boolean; start: (key: string, y: number) => void; end: () => void };

export const useLoading = create<Loading>((set, get) => ({
  run: null,
  busy: false,
  start: (key, y) => {
    if (get().run || get().busy) return;
    set({ busy: true });
    // The doors are a picture of the page at the tap, so they look exactly like it and cost nothing to move.
    void snapPage().then((shot) => set({ run: { key, y, shot, id: Date.now() }, busy: false }));
  },
  end: () => {
    const shot = get().run?.shot ?? null;
    set({ run: null });
    dropShot(shot);
  },
}));
