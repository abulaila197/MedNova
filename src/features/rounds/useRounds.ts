// Grand Rounds (Yazan 2026-10-13): one weekly goal on a 13-week cycle, counted on the server from synced plays.
import { create } from 'zustand';

import { GAMES } from '@/data/games';
import { useSession } from '@/games/shell/session';
import { supabase } from '@/lib/supabase';
import { syncAccount } from '@/lib/sync';
import { onAccountSwitch } from '@/state/accountSwitch';

export type Week = { kind: 'game'; slot: number; game: string } | { kind: 'mode'; slot: number; mode: 'online' | 'solo' | 'offline' };
// 'local' = Solo or Pass the phone together (Yazan 2026-10-21).
export type Part = { k: 'solo' | 'online' | 'offline' | 'local'; n?: number; of: number };

export type Rounds = {
  week: number;
  this: Week;
  next: Week;
  ends: number;
  prize: number;
  parts: Part[];
  claimed: boolean;
  stamps: number[];
  boosted: number;
};

export const PART_NAME: Record<Part['k'], string> = { solo: 'Solo', online: 'Online', offline: 'Pass the phone', local: 'Solo or Pass the phone' };
const MODE_WEEK: Record<string, string> = { online: 'Online week', solo: 'Solo week', offline: 'Pass the phone week' };

/** "Diagnostic Pursuit", or "Online week" for the three mode weeks. */
export const weekName = (w: Week) => (w.kind === 'mode' ? MODE_WEEK[w.mode] : (() => {
  const g = GAMES.find((x) => x.key === w.game);
  return g ? `${g.lead.replace(/^The /, '')} ${g.em}`.trim() : w.game;
})());

/** What counts this week, in words. */
export const weekGoal = (w: Week) => (w.kind === 'mode' ? `Win 60 ${w.mode === 'offline' ? 'Pass the phone' : w.mode === 'solo' ? 'Solo' : 'Online'} games of any kind` : 'Finish games of this week’s game');

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
  if (r?.this && Array.isArray(r.parts)) useRoundsStore.setState({ r, failed: false });
  else useRoundsStore.setState({ failed: true });
}

export const doneOf = (r: Rounds | null) => {
  if (!r) return 0;
  const total = r.parts.reduce((a, p) => a + p.of, 0);
  return total ? r.parts.reduce((a, p) => a + (p.n ?? 0), 0) / total : 0;
};

export const isComplete = (r: Rounds | null) => !!r && r.parts.every((p) => (p.n ?? 0) >= p.of);

/** Collects the week's prize (30 tokens and a stamp). */
export async function claimRounds() {
  const { data, error } = await supabase.rpc('rounds_claim');
  if (error || !data) return { ok: false, why: 'offline' } as const;
  const userId = useSession.getState().userId;
  if (userId) await syncAccount(userId).catch(() => {});
  await loadRounds(true);
  return data as { ok: boolean; why?: string; tokens?: number };
}
