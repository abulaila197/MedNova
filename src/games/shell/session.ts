import { create } from 'zustand';

/** Who is signed in (set by state/account.ts from the Supabase session); null = guest. */
type Session = { userId: string | null; setUser: (id: string | null) => void };

export const useSession = create<Session>((set) => ({
  userId: null,
  setUser: (userId) => set({ userId }),
}));
