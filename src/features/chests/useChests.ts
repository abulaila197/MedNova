// Daily challenges and chests (Yazan 2026-10-18): the server counts games, ads, shares and review cards,
// files the chests and rolls what's inside; the phone only reads and asks.
import { create } from 'zustand';

import { useSession } from '@/games/shell/session';
import { supabase } from '@/lib/supabase';
import { syncAccount } from '@/lib/sync';
import { loadStyle } from '@/features/style/useStyle';

import type { ChestKind, Rarity } from './data';

export type TaskKey = 'games' | 'ads' | 'shares' | 'review';
export type Task = { k: TaskKey; n: number; of: number };

export type Challenges = {
  signed_in: boolean;
  day: string;
  /** 1-3 = the challenge now counting, 4 = all done today. */
  step: 1 | 2 | 3 | 4;
  /** Days in a row with all 3 done (0-5). */
  streak: number;
  /** When the day resets (ms). */
  resets: number;
  chests: Record<ChestKind, number>;
  tasks: Task[][];
};

export type Won = { key: string; rarity: Rarity; dupe: boolean; tokens: number };
export type OpenResult = { ok: true; items: Won[]; prize: number } | { ok: false; why: string };

const NONE: Record<ChestKind, number> = { wooden: 0, golden: 0, diamond: 0, epic: 0 };

type State = { c: Challenges | null; at: number };
export const useChests = create<State>(() => ({ c: null, at: 0 }));

export const chestsOwned = (c: Challenges | null) => (c ? c.chests : NONE);
export const chestCount = (c: Challenges | null) => Object.values(chestsOwned(c)).reduce((a, n) => a + n, 0);

/** Reads today's challenges and the chests waiting (guests see the challenges with no progress). Skips if read in the last 20 s. */
export async function loadChallenges(force = false) {
  if (!force && Date.now() - useChests.getState().at < 20000) return;
  useChests.setState({ at: Date.now() });
  const userId = useSession.getState().userId;
  if (userId) await syncAccount(userId).catch(() => {});
  const { data } = await supabase.rpc('challenges_status', { tz_min: -new Date().getTimezoneOffset() });
  const c = data as Challenges | null;
  if (c && Array.isArray(c.tasks)) useChests.setState({ c });
}

/** Opens one chest. Tokens and duplicates are paid on the server. */
export async function openChest(kind: ChestKind): Promise<OpenResult> {
  const { data, error } = await supabase.rpc('chest_open', { kind });
  if (error || !data) return { ok: false, why: 'offline' };
  const r = data as { ok: boolean; why?: string; items?: Won[]; prize?: number; chests?: Record<ChestKind, number> };
  if (!r.ok) return { ok: false, why: r.why ?? 'none' };
  const c = useChests.getState().c;
  if (c && r.chests) useChests.setState({ c: { ...c, chests: r.chests } });
  const userId = useSession.getState().userId;
  if (userId) await syncAccount(userId).catch(() => {});
  void loadStyle();
  return { ok: true, items: r.items ?? [], prize: r.prize ?? 0 };
}

/** Counts a finished share or an empty review pile toward today's challenge (signed-in players only). */
export function logChallenge(kind: 'share' | 'review') {
  if (!useSession.getState().userId) return;
  void supabase.rpc('challenge_log', { kind }).then(() => loadChallenges(true));
}
