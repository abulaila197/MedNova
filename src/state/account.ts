import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { engine, RECORDER_KEYS } from '@/games/engine';
import { useSession } from '@/games/shell/session';
import { supabase } from '@/lib/supabase';
import { PROGRESS_KEYS } from '@/lib/progress';
import { holdUnsynced, syncAccount } from '@/lib/sync';
import { loadSubscription } from '@/features/store/billing';
import { invoke } from '@/online/api';
import { startInvites, stopInvites } from '@/online/invites';
import { startPresence, stopPresence } from '@/state/friends';

export type Profile = { id: string; username: string; display_name: string; avatar: string; friend_code: string };

type AccountState = {
  profile: Profile | null;
  email: string | null;
  /** The saved session arrived only after the first page had opened as a guest (a slow, offline launch). */
  restored: boolean;
  /** Yazan's account (AD1): shows the hidden Admin page. The server checks again on every admin call. */
  isAdmin: boolean;
};

/** The signed-in player's profile (AU1). Guests have none. */
export const useAccount = create<AccountState>(() => ({ profile: null, email: null, restored: false, isAdmin: false }));

async function loadProfile(userId: string) {
  const { data } = await supabase.from('profiles').select('id,username,display_name,avatar,friend_code').eq('id', userId).maybeSingle();
  useAccount.setState({ profile: (data as Profile | null) ?? null });
  const admin = await supabase.rpc('is_admin');
  useAccount.setState({ isAdmin: admin.data === true });
}

function apply(id: string | null, email: string | null) {
  if (useSession.getState().known && useSession.getState().userId === id) {
    if (email && email !== useAccount.getState().email) useAccount.setState({ email });
    return;
  }
  useSession.getState().setUser(id);
  useAccount.setState({ email, profile: id ? useAccount.getState().profile : null, restored: false, isAdmin: false });
  void loadSubscription(id);
  if (id) {
    void loadProfile(id);
    syncAccount(id).catch(() => {}); // retried on the next sign-in, finish or app start
    startPresence();
    startInvites();
  } else {
    stopPresence();
    stopInvites();
  }
}

/** The player whose session is saved on this phone, read straight from Supabase's storage key (no network). */
function savedUserId(): string | null {
  try {
    const key = (supabase.auth as unknown as { storageKey: string }).storageKey;
    const raw = (globalThis as { localStorage?: Storage }).localStorage?.getItem(key);
    const id: unknown = raw ? JSON.parse(raw)?.user?.id : null;
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}

// Offline with an expired token, getSession retries the refresh for up to ~30 s. The first page waits at most this
// long, then opens with the player saved on the phone; the real session follows in the background.
const WAIT_MS = 2000;
let early = false;

/** The launch's session. Offline it can come back empty while the saved one waits to refresh: keep the saved player. */
function settle(session: Session | null) {
  const id = session?.user.id ?? savedUserId();
  apply(id, session?.user.email ?? null);
  if (early && id) useAccount.setState({ restored: true });
  early = false;
}

let started = false;
/** Called once from the root layout. */
export function startAccount() {
  if (started) return;
  started = true;
  const wait = setTimeout(() => {
    if (useSession.getState().known) return;
    const id = savedUserId();
    early = !id;
    apply(id, null);
  }, WAIT_MS);
  void supabase.auth
    .getSession()
    .then(({ data }) => settle(data.session))
    .catch(() => settle(null))
    .finally(() => clearTimeout(wait));
  supabase.auth.onAuthStateChange((e, session) => (e === 'INITIAL_SESSION' ? settle(session) : apply(session?.user.id ?? null, session?.user.email ?? null)));
}

/** What the account keeps on the server; cleared from the phone on sign-out (SO1: clean slate). */
const ACCOUNT_KEYS = [...RECORDER_KEYS, 'wallet', 'subscription', ...PROGRESS_KEYS];
const clearPhone = () => Promise.all(ACCOUNT_KEYS.map((k) => engine.kv.remove(k)));

/**
 * SO1: upload first, then sign out and clear the phone back to a fresh guest.
 * SO2: offline, the same happens at once; what could not upload is held for this account and goes up at its next sign-in here.
 */
export async function signOut() {
  const id = useSession.getState().userId;
  let online = true;
  if (id) await syncAccount(id).catch(() => (online = false));
  if (id && !online) await holdUnsynced(id);
  await supabase.auth.signOut({ scope: online ? 'global' : 'local' });
  await clearPhone();
}

/** Delete my account: the server removes the login and every row it owns; the phone goes back to guest. */
export async function deleteAccount() {
  await invoke('delete-account');
  await supabase.auth.signOut({ scope: 'local' });
  await clearPhone();
}
