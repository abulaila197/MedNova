// Grand Rounds (Yazan 2026-10-13, missions 2026-10-25): a 16-week cycle; each week has 3 missions counted in Sparks
// used, each paying a chest, counted on the server from synced spends.
import { create } from 'zustand';

import { GAMES } from '@/data/games';
import { loadChallenges } from '@/features/chests/useChests';
import { sparksCost } from '@/features/sparks/costs';
import type { GameKey } from '@/games/engine/types';
import { useSession } from '@/games/shell/session';
import { supabase } from '@/lib/supabase';
import { syncAccount } from '@/lib/sync';
import { onAccountSwitch } from '@/state/accountSwitch';

export type Week = { kind: 'game'; slot: number; game: string } | { kind: 'mode'; slot: number; mode: 'online' | 'solo' | 'offline' };
export type ChestKind = 'wooden' | 'golden' | 'diamond';
/** One of the week's 3 missions (#27, Yazan 2026-10-25): a running total of Sparks used, and its chest. */
export type Mission = { of: number; chest: ChestKind; claimed: boolean };

export type Rounds = {
  week: number;
  this: Week;
  next: Week;
  ends: number;
  /** Sparks used this week on the week's game (or mode). */
  used: number;
  missions: Mission[];
  /** Week 3's mission stamps the week. */
  claimed: boolean;
  stamps: number[];
  /** Different weeks stamped since the last cycle prize. */
  cycle: { have: number; of: number; prize: number };
};

/** 13 game weeks, then an Online, a Solo and a Pass the phone week. */
export const CYCLE_WEEKS = 16;
export const CHEST_NAME: Record<ChestKind, string> = { wooden: 'Wooden chest', golden: 'Golden chest', diamond: 'Diamond chest' };
const MODE_WEEK: Record<string, string> = { online: 'Online week', solo: 'Solo week', offline: 'Pass the phone week' };
const MODE_NAME: Record<string, string> = { online: 'Online', solo: 'Solo', offline: 'Pass the phone' };

/** "Diagnostic Pursuit", or "Online week" for the three mode weeks. */
export const weekName = (w: Week) => (w.kind === 'mode' ? MODE_WEEK[w.mode] : (() => {
  const g = GAMES.find((x) => x.key === w.game);
  return g ? `${g.lead.replace(/^The /, '')} ${g.em}`.trim() : w.game;
})());

/** What counts this week, in words. */
export const weekGoal = (w: Week) =>
  w.kind === 'mode' ? `Use Sparks on any game in ${MODE_NAME[w.mode]}` : 'Use Sparks on this game, in any mode';

/** "about 20 games" for a mission, at the game's usual price (game weeks only). */
export function aboutGames(w: Week, sparks: number) {
  if (w.kind !== 'game') return null;
  const each = sparksCost(w.game as GameKey, 'online', {}) || sparksCost(w.game as GameKey, 'offline', {});
  return each ? `about ${Math.ceil(sparks / each)} games` : null;
}

export const timeLeft = (ends: number) => {
  const h = Math.max(0, Math.floor((ends - Date.now()) / 3600000));
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`;
};

/** `failed`: the last read did not reach the server (offline) (AP8). */
type State = { r: Rounds | null; at: number; failed: boolean };
export const useRoundsStore = create<State>(() => ({ r: null, at: 0, failed: false }));
onAccountSwitch(() => useRoundsStore.setState({ r: null, at: 0, failed: false }));

/** Reads this week's state (guests see the goal with no progress). Cheap: skips if read in the last 20 s unless forced. */
export async function loadRounds(force = false) {
  if (!force && Date.now() - useRoundsStore.getState().at < 20000) return;
  useRoundsStore.setState({ at: Date.now() });
  const userId = useSession.getState().userId;
  if (userId) await syncAccount(userId).catch(() => {});
  const { data } = await supabase.rpc('rounds_status');
  const r = data as Rounds | null;
  if (r?.this && Array.isArray(r.missions)) useRoundsStore.setState({ r, failed: false });
  else useRoundsStore.setState({ failed: true });
}

/** How far along the last mission the week is (0-1). */
export const doneOf = (r: Rounds | null) => {
  const top = r?.missions.at(-1)?.of ?? 0;
  return r && top ? Math.min(1, r.used / top) : 0;
};

/** Missions reached but not yet collected. */
export const readyOf = (r: Rounds | null) => (r ? r.missions.map((m, i) => ({ ...m, tier: i + 1 })).filter((m) => !m.claimed && r.used >= m.of) : []);

/** Collects mission `tier` (1-3): its chest; mission 3 also stamps the week and may pay the cycle prize. */
export async function claimRounds(tier: number) {
  const { data, error } = await supabase.rpc('rounds_claim', { tier });
  if (error || !data) return { ok: false, why: 'offline' } as const;
  const userId = useSession.getState().userId;
  if (userId) await syncAccount(userId).catch(() => {});
  await loadRounds(true);
  void loadChallenges(true);
  return data as { ok: boolean; why?: string; chest?: ChestKind; stamp?: boolean; prize?: number };
}
