// Offline saving (#57, #59, #60, Yazan 2026-10-26). One rule for every page: the server is the truth for what is
// earned and spent. The phone keeps the last copy it read, per account, and shows it while the server can't be
// reached, plus any changes still waiting to go up. Back online, waiting changes go up first, then the server's
// copy replaces the phone's.
import { engine } from '@/games/engine';

export const COPIES = ['style', 'friends', 'hunt', 'challenges', 'rounds', 'social', 'leaderboard', 'cases', 'free', 'profiles', 'daily', 'inbox'] as const;
export type CopyName = (typeof COPIES)[number];

/** A saved copy and when it was read from the server (ms). */
export type Copy<T> = { at: number; v: T };

const key = (name: CopyName, uid: string) => `copy:${name}:${uid}`;

/** Saves what the server just sent. */
export const keepCopy = <T>(name: CopyName, uid: string, v: T) => engine.kv.set(key(name, uid), { at: Date.now(), v } satisfies Copy<T>).catch(() => {});

/** The last copy saved for this account, or null. */
export const copyOf = <T>(name: CopyName, uid: string) => engine.kv.get<Copy<T>>(key(name, uid)).catch(() => null);

/** Sign-out leaves a clean phone: this account's copies go (they come back from the server at its next sign-in). */
export const dropCopies = (uid: string) => Promise.all(COPIES.map((n) => engine.kv.remove(key(n, uid)))).catch(() => {});

/** "5 min ago" for the offline line. */
export function agoText(at: number, now = Date.now()) {
  const m = Math.max(0, Math.floor((now - at) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
