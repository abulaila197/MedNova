import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { engine } from '@/games/engine';
import { useSession } from '@/games/shell/session';
import { supabase } from '@/lib/supabase';
import { syncAccount } from '@/lib/sync';
import { startPresence, stopPresence } from '@/state/friends';

export type Profile = { id: string; username: string; display_name: string; avatar: string; friend_code: string };

type AccountState = { profile: Profile | null; email: string | null };

/** The signed-in player's profile (AU1). Guests have none. */
export const useAccount = create<AccountState>(() => ({ profile: null, email: null }));

async function loadProfile(userId: string) {
  const { data } = await supabase.from('profiles').select('id,username,display_name,avatar,friend_code').eq('id', userId).maybeSingle();
  useAccount.setState({ profile: (data as Profile | null) ?? null });
}

function apply(session: Session | null) {
  const id = session?.user.id ?? null;
  if (useSession.getState().userId === id) return;
  useSession.getState().setUser(id);
  useAccount.setState({ email: session?.user.email ?? null, profile: id ? useAccount.getState().profile : null });
  if (id) {
    void loadProfile(id);
    syncAccount(id).catch(() => {}); // retried on the next sign-in, finish or app start
    startPresence();
  } else stopPresence();
}

let started = false;
/** Called once from the root layout. */
export function startAccount() {
  if (started) return;
  started = true;
  void supabase.auth.getSession().then(({ data }) => apply(data.session));
  supabase.auth.onAuthStateChange((_e, session) => apply(session));
}

/** What the account keeps on the server; cleared from the phone on sign-out (SO1: clean slate). */
const ACCOUNT_KEYS = ['plays', 'play_items', 'wallet'];
const clearPhone = () => Promise.all(ACCOUNT_KEYS.map((k) => engine.kv.remove(k)));

/** SO1: upload first, then sign out and clear the phone back to a fresh guest. Offline, it refuses so nothing is lost. */
export async function signOut() {
  const id = useSession.getState().userId;
  if (id) await syncAccount(id); // throws when offline; the caller shows the message
  await supabase.auth.signOut();
  await clearPhone();
}

/** Delete my account: the server removes the login and every row it owns; the phone goes back to guest. */
export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  await supabase.auth.signOut({ scope: 'local' });
  await clearPhone();
}
