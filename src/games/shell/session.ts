import { create } from 'zustand';

/** Sign-in is design-only in v0.1 (wire-later list), so the games treat everyone as a guest until auth lands. */
type Session = { userId: string | null; setUser: (id: string | null) => void };

export const useSession = create<Session>((set) => ({
  userId: null,
  setUser: (userId) => set({ userId }),
}));
