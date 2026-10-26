// Daily missions and chests: the server counts games, ads, shares and the review pile and pays the missions'
// tokens (Yazan 2026-10-26); it also rolls what's inside a chest. The phone only reads and asks.
import { create } from 'zustand';

import { useSession } from '@/games/shell/session';
import { supabase } from '@/lib/supabase';
import { syncAccount } from '@/lib/sync';
import { loadStyle } from '@/features/style/useStyle';

import type { ChestKind, Rarity } from './data';
import { onAccountSwitch } from '@/state/accountSwitch';

export type TaskKey = 'games' | 'ads' | 'shares' | 'review';
export type Task = { k: TaskKey; n: number; of: number };

export type Challenges = {
  signed_in: boolean;
  day: string;
  /** 1-3 = the challenge now counting, 4 = all done today. */
  step: 1 | 2 | 3 | 4;
  /** Mission names (Warm-up, Full Shift, Overtime) and their token prizes (10 / 30 / 50). */
  names: string[];
  prizes: number[];
  /** When the day resets (ms). */
  resets: number;
  chests: Record<ChestKind, number>;
  tasks: Task[][];
};

export type Won = { key: string; rarity: Rarity; dupe: boolean; tokens: number };
export type OpenResult = { ok: true; items: Won[]; prize: number } | { ok: false; why: string };

const NONE: Record<ChestKind, number> = { wooden: 0, golden: 0, diamond: 0, epic: 0 };

/** `failed`: the last read did not reach the server (offline), so the page can say so instead of showing zeros (AP8). */
type State = { c: Challenges | null; at: number; failed: boolean };
export const useChests = create<State>(() => ({ c: null, at: 0, failed: false }));
onAccountSwitch(() => useChests.setState({ c: null, at: 0, failed: false }));

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
  if (c && Array.isArray(c.tasks)) useChests.setState({ c, failed: false });
  else useChests.setState({ failed: true });
  if (c && c.signed_in && c.step === 3 && c.tasks[2]?.some((k) => k.k === 'review' && k.n < k.of)) void reviewIfEmpty();
}

/** Overtime asks for an empty review pile: a player with nothing to review (no mistakes) has it done already. */
async function reviewIfEmpty() {
  const { loadLearn, pileOf, reviewState } = await import('@/features/learn/library');
  const [{ cards }, st] = await Promise.all([loadLearn(), reviewState()]);
  if (!pileOf(cards, st).length) logChallenge('review');
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
