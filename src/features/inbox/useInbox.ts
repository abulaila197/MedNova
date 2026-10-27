import { create } from 'zustand';

import type { ChestKind } from '@/features/chests/data';
import { loadChallenges } from '@/features/chests/useChests';
import { refreshSparks } from '@/features/sparks/sparks';
import { useSession } from '@/games/shell/session';
import { copyOf, keepCopy } from '@/lib/copies';
import { supabase } from '@/lib/supabase';
import { syncAccount } from '@/lib/sync';

/** One Inbox message from the MedNova team (Yazan 2026-10-27), with its gifts. */
export type Message = { id: string; title: string; body: string; tokens: number; sparks: number; chest: ChestKind | null; chests?: number; at: string; read: boolean; collected: boolean };

/** `savedAt`: the list is the saved copy from then, because the server can't be reached. */
type State = { list: Message[] | null; waiting: number; failed: boolean; savedAt?: number | null };

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

/** Offline, the last saved copy shows (Yazan 2026-10-27); Collect still needs the server. */
export async function loadInbox() {
  const uid = useSession.getState().userId;
  if (!uid) return useInbox.setState({ list: [], waiting: 0, failed: false, savedAt: null });
  const { data, error } = await supabase.rpc('inbox_list');
  if (error || !Array.isArray(data)) {
    const copy = await copyOf<Message[]>('inbox', uid);
    if (copy && useSession.getState().userId === uid && !useInbox.getState().list) useInbox.setState({ list: copy.v, waiting: waitingIn(copy.v), savedAt: copy.at });
    return useInbox.setState({ failed: true });
  }
  const list = data as Message[];
  useInbox.setState({ list, waiting: waitingIn(list), failed: false, savedAt: null });
  void keepCopy('inbox', uid, list);
}

const save = (list: Message[]) => {
  const uid = useSession.getState().userId;
  if (uid) void keepCopy('inbox', uid, list);
};

/** Opening the page marks every message shown as read (gifts still wait for Collect). */
export async function readAll() {
  const list = useInbox.getState().list ?? [];
  const unread = list.filter((m) => !m.read);
  if (!unread.length) return;
  const next = list.map((m) => ({ ...m, read: true }));
  useInbox.setState({ list: next, waiting: waitingIn(next) });
  save(next);
  await Promise.all(unread.map((m) => supabase.rpc('inbox_read', { msg: m.id })));
}

/** Collects one message's gifts on the server (no wallet refresh). */
async function take(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('inbox_collect', { msg: id });
  const r = (data ?? {}) as { ok?: boolean; why?: string };
  if (error || (!r.ok && r.why !== 'done')) return false;
  const next = (useInbox.getState().list ?? []).map((m) => (m.id === id ? { ...m, read: true, collected: true } : m));
  useInbox.setState({ list: next, waiting: waitingIn(next) });
  save(next);
  return true;
}

/** Brings the wallet, Sparks and chests up to date after collecting. */
async function refresh() {
  const uid = useSession.getState().userId;
  if (uid) await syncAccount(uid).catch(() => {});
  await Promise.all([refreshSparks().catch(() => {}), loadChallenges(true).catch(() => {})]);
}

/** Collects a message's gifts on the server, then brings the wallet, Sparks and chests up to date. */
export async function collect(id: string): Promise<boolean> {
  const ok = await take(id);
  if (ok) await refresh();
  return ok;
}

/** Collect all (Yazan 2026-10-27): every gift still waiting, one by one, then one refresh. */
export async function collectAll(): Promise<boolean> {
  const waiting = (useInbox.getState().list ?? []).filter((m) => hasGift(m) && !m.collected);
  let ok = true;
  for (const m of waiting) if (!(await take(m.id))) ok = false;
  if (waiting.length) await refresh();
  return ok;
}

/** Messages "Clear messages" hides: read, with nothing left to collect. */
export const clearable = (m: Message) => m.read && (!hasGift(m) || m.collected);

/** Clear messages (Yazan 2026-10-27): hides every read message with nothing left to collect. */
export async function clearInbox(): Promise<boolean> {
  const { error } = await supabase.rpc('inbox_clear');
  if (error) return false;
  const next = (useInbox.getState().list ?? []).filter((m) => !clearable(m));
  useInbox.setState({ list: next, waiting: waitingIn(next) });
  save(next);
  return true;
}
