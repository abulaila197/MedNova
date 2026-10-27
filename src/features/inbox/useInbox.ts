import { create } from 'zustand';

import type { ChestKind } from '@/features/chests/data';
import { loadChallenges } from '@/features/chests/useChests';
import { refreshSparks } from '@/features/sparks/sparks';
import { useSession } from '@/games/shell/session';
import { supabase } from '@/lib/supabase';
import { syncAccount } from '@/lib/sync';

/** One Inbox message from the MedNova team (Yazan 2026-10-27), with its gifts. */
export type Message = { id: string; title: string; body: string; tokens: number; sparks: number; chest: ChestKind | null; at: string; read: boolean; collected: boolean };

type State = { list: Message[] | null; waiting: number; failed: boolean };

/** The signed-in player's Inbox; `waiting` (unopened, or a gift not collected) drives the red dot. */
export const useInbox = create<State>(() => ({ list: null, waiting: 0, failed: false }));

export const hasGift = (m: Message) => m.tokens > 0 || m.sparks > 0 || !!m.chest;
const waitingIn = (list: Message[]) => list.filter((m) => !m.read || (hasGift(m) && !m.collected)).length;

/** The red dot count only (Games page). Guests have no Inbox. */
export async function loadWaiting() {
  if (!useSession.getState().userId) return useInbox.setState({ waiting: 0 });
  const { data, error } = await supabase.rpc('inbox_waiting');
  if (!error && typeof data === 'number') useInbox.setState({ waiting: data });
}

export async function loadInbox() {
  if (!useSession.getState().userId) return useInbox.setState({ list: [], waiting: 0, failed: false });
  const { data, error } = await supabase.rpc('inbox_list');
  if (error || !Array.isArray(data)) return useInbox.setState({ failed: true });
  const list = data as Message[];
  useInbox.setState({ list, waiting: waitingIn(list), failed: false });
}

/** Opening the page marks every message shown as read (gifts still wait for Collect). */
export async function readAll() {
  const list = useInbox.getState().list ?? [];
  const unread = list.filter((m) => !m.read);
  if (!unread.length) return;
  const next = list.map((m) => ({ ...m, read: true }));
  useInbox.setState({ list: next, waiting: waitingIn(next) });
  await Promise.all(unread.map((m) => supabase.rpc('inbox_read', { msg: m.id })));
}

/** Collects a message's gifts on the server, then brings the wallet, Sparks and chests up to date. */
export async function collect(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('inbox_collect', { msg: id });
  const r = (data ?? {}) as { ok?: boolean; why?: string };
  if (error || (!r.ok && r.why !== 'done')) return false;
  const next = (useInbox.getState().list ?? []).map((m) => (m.id === id ? { ...m, read: true, collected: true } : m));
  useInbox.setState({ list: next, waiting: waitingIn(next) });
  const uid = useSession.getState().userId;
  if (uid) await syncAccount(uid).catch(() => {});
  await Promise.all([refreshSparks().catch(() => {}), loadChallenges(true).catch(() => {})]);
  return true;
}
