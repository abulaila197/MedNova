import { create } from 'zustand';

/**
 * Who is signed in: the one place the app asks (set by state/account.ts from the Supabase session); null = guest.
 * `known` turns true once the saved session has been read at launch, so the first page can be picked.
 */
type Session = { userId: string | null; known: boolean; setUser: (id: string | null) => void };

export const useSession = create<Session>((set) => ({
  userId: null,
  known: false,
  setUser: (userId) => set({ userId, known: true }),
}));
