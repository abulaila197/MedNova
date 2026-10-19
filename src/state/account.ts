import type { Session } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { engine, RECORDER_KEYS } from '@/games/engine';
import { useSession } from '@/games/shell/session';
import { supabase } from '@/lib/supabase';
import { PROGRESS_KEYS } from '@/lib/progress';
import { holdUnsynced, ITEMS_CURSOR, LEDGER_CURSOR, PLAYS_CURSOR, syncAccount } from '@/lib/sync';
import { loadSubscription } from '@/features/store/billing';
import { invoke } from '@/online/api';
import { startInvites, stopInvites } from '@/online/invites';
import { runAccountSwitch } from '@/state/accountSwitch';
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

// The last profile read for each account, so an offline launch still shows the player's name, code and
// character (X5). Overwritten by every successful read; removed on sign-out.
const profileKey = (id: string) => `profile:${id}`;
useAccount.subscribe((a, b) => {
  if (a.profile && a.profile !== b.profile) void engine.kv.set(profileKey(a.profile.id), a.profile);
});

let profileLoading: string | null = null;
async function loadProfile(userId: string) {
  if (profileLoading === userId) return;
  profileLoading = userId;
  // A sign-out or account switch while a read is in flight must not write the old account back (AP12c).
  const still = () => useSession.getState().userId === userId;
  try {
    if (!useAccount.getState().profile) {
      const cached = await engine.kv.get<Profile>(profileKey(userId));
      if (cached && still() && !useAccount.getState().profile) useAccount.setState({ profile: cached });
    }
    const { data, error } = await supabase.from('profiles').select('id,username,display_name,avatar,friend_code').eq('id', userId).maybeSingle();
    if (!still()) return;
    // Offline the read fails: keep what we have and try again when the app comes back or the token refreshes (X5).
    if (!error) useAccount.setState({ profile: (data as Profile | null) ?? null });
    const admin = await supabase.rpc('is_admin');
    if (!still() || admin.error) return;
    useAccount.setState({ isAdmin: admin.data === true });
  } finally {
    if (profileLoading === userId) profileLoading = null;
  }
}

/** Retries the profile when it never arrived (an offline launch), once the network may be back. */
function retryProfile() {
  const id = useSession.getState().userId;
  if (id && !useAccount.getState().profile) void loadProfile(id);
}

function apply(id: string | null, email: string | null) {
  if (useSession.getState().known && useSession.getState().userId === id) {
    if (email && email !== useAccount.getState().email) useAccount.setState({ email });
    retryProfile();
    return;
  }
  const wasKnown = useSession.getState().known;
  useSession.getState().setUser(id);
  useAccount.setState({ email, profile: id ? useAccount.getState().profile : null, restored: false, isAdmin: false });
  if (wasKnown) runAccountSwitch();
  // Whatever way the account changed, the phone is cleaned (or this account's own keys restored) before the
  // first sync, so one account's wallet and plays are never uploaded to another (AP3).
  const ready = queueCleanSlate(id);
  void loadSubscription(id);
  if (id) {
    void loadProfile(id);
    ready.then(() => syncAccount(id)).catch(() => {}); // retried on the next sign-in, finish or app start
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
  AppState.addEventListener('change', (st) => {
    if (st === 'active') retryProfile();
  });
}

/** What the account keeps on the server; cleared from the phone on sign-out (SO1: clean slate). */
const ACCOUNT_KEYS = [...RECORDER_KEYS, 'wallet', LEDGER_CURSOR, PLAYS_CURSOR, ITEMS_CURSOR, 'subscription', ...PROGRESS_KEYS];

// Per-account keys that live only on this phone (AP4). They are not on the server, so instead of being lost they
// are put aside for the account on sign-out and given back when that account signs in here again. The next
// account starts clean, and nobody can replay a Medicordle daily or re-earn Endless EXP by signing out and in.
const MEDI_STYLES = ['classic', 'custom'] as const;
const PHONE_KEYS = [
  'free_plays', 'rounds_boost', 'ads:play', 'tour:visited', 'medicordle:endless:paid',
  ...MEDI_STYLES.flatMap((st) => [`medicordle:streak:${st}`, `medicordle:daily:last:${st}`]),
];
const stashKey = (id: string) => `stash:${id}`;

/** The phone keys in use now, including each Medicordle style's latest daily board. */
async function phoneKeys() {
  const keys = [...PHONE_KEYS];
  for (const st of MEDI_STYLES) {
    const last = await engine.kv.get<{ day?: number }>(`medicordle:daily:last:${st}`);
    if (typeof last?.day === 'number') keys.push(`medicordle:daily:${st}:${last.day}`);
  }
  return keys;
}

/** Puts this account's phone-only keys aside, under its id. */
async function stashPhone(id: string) {
  const keys = await phoneKeys();
  const kept: Record<string, unknown> = {};
  for (const k of keys) {
    const v = await engine.kv.get<unknown>(k);
    if (v != null) kept[k] = v;
  }
  await engine.kv.set(stashKey(id), kept);
}

/** Gives an account back its phone-only keys, if it left some on this phone. */
async function restorePhone(id: string) {
  const kept = await engine.kv.get<Record<string, unknown>>(stashKey(id));
  if (!kept) return;
  for (const [k, v] of Object.entries(kept)) await engine.kv.set(k, v);
  await engine.kv.remove(stashKey(id));
}

async function clearPhone() {
  const keys = [...ACCOUNT_KEYS, ...(await phoneKeys())];
  await Promise.all(keys.map((k) => engine.kv.remove(k)));
}

/** Which account the phone's data belongs to. Lets a sign-out that happened elsewhere be noticed, even at launch. */
const OWNER_KEY = 'account:owner';

/** Leaves the phone as a fresh guest for the account that owned it: hold its unsynced rows, put its keys aside. */
async function leavePhone(owner: string, hold: boolean) {
  if (hold) await holdUnsynced(owner).catch(() => {});
  await stashPhone(owner).catch(() => {});
  await engine.kv.remove(profileKey(owner));
  await engine.kv.remove(OWNER_KEY);
  await clearPhone();
}

let cleaning: Promise<void> = Promise.resolve();
/**
 * AP3: the clean slate also runs when the session ends without the Sign out button (signed out on another phone,
 * account deleted elsewhere, refresh token expired) and when another account signs in: the previous owner's
 * unsynced rows are held for it (as in SO2) and the phone is cleared before anything is uploaded.
 */
function queueCleanSlate(id: string | null) {
  cleaning = cleaning
    .then(async () => {
      const owner = await engine.kv.get<string>(OWNER_KEY);
      if (owner && owner !== id) await leavePhone(owner, true);
      if (id && owner !== id) {
        await restorePhone(id);
        await engine.kv.set(OWNER_KEY, id);
      }
    })
    .catch(() => {});
  return cleaning;
}

/**
 * SO1: upload first, then sign out and clear the phone back to a fresh guest.
 * SO2: offline, the same happens at once; what could not upload is held for this account and goes up at its next sign-in here.
 */
let signingOut: Promise<void> | null = null;
export function signOut() {
  // A second tap while signing out waits for the first instead of reporting a failure (AP10a).
  signingOut ??= (async () => {
    const id = useSession.getState().userId;
    let online = true;
    if (id) await syncAccount(id).catch(() => (online = false));
    await cleaning;
    if (id) await leavePhone(id, !online);
    // This phone only: other phones signed in to the same account stay signed in (Yazan 2026-10-19).
    await supabase.auth.signOut({ scope: 'local' });
    await clearPhone();
  })().finally(() => (signingOut = null));
  return signingOut;
}

/** Delete my account: the server removes the login and every row it owns; the phone goes back to guest. */
export async function deleteAccount() {
  const id = useSession.getState().userId;
  await invoke('delete-account');
  await cleaning;
  if (id) {
    await engine.kv.remove(stashKey(id));
    await engine.kv.remove(profileKey(id));
  }
  await engine.kv.remove(OWNER_KEY);
  await supabase.auth.signOut({ scope: 'local' });
  await clearPhone();
}
