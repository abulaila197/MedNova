import { create } from 'zustand';

import { defaultKV } from '@/games/engine/storage';
import { useSession } from '@/games/shell/session';
import { call } from '@/lib/rpc';
import { onAccountSwitch } from '@/state/accountSwitch';

// Which help pop-ups (and the welcome tour) were closed, kept on the phone and on the account, so a reinstall
// doesn't show them again (Yazan 2026-11-04, point 2). A pop-up counts as seen if either place says so.

const kv = defaultKV();
/** The phone's key for a pop-up. The welcome tour is 'welcome'; a page's help is its path. */
export const helpKey = (page: string) => (page === 'welcome' ? 'welcome:seen' : `help:seen:${page}`);

/** `ready`: the account's list arrived, or there's none to wait for (a guest, or the server didn't answer in time). */
type State = { pages: string[]; ready: boolean; owner: string | null };
export const useHelpSeen = create<State>(() => ({ pages: [], ready: false, owner: null }));
onAccountSwitch(() => useHelpSeen.setState({ pages: [], ready: false, owner: null }));

const WAIT_MS = 3000;
let loading: string | null = null;

/** Reads the signed-in account's list once (guests are ready at once). Called by the pop-up hosts. */
export function loadHelpSeen() {
  const uid = useSession.getState().userId;
  const st = useHelpSeen.getState();
  if (!uid) {
    if (!st.ready || st.owner) useHelpSeen.setState({ pages: [], ready: true, owner: null });
    return;
  }
  if ((st.ready && st.owner === uid) || loading === uid) return;
  loading = uid;
  // Offline or slow: don't hold the pop-up for long, the phone's own memory still counts.
  const late = setTimeout(() => {
    if (useSession.getState().userId === uid && !useHelpSeen.getState().ready) useHelpSeen.setState({ ready: true, owner: uid });
  }, WAIT_MS);
  call<string[]>('my_help_seen')
    .then((pages) => {
      if (useSession.getState().userId !== uid) return;
      useHelpSeen.setState((s) => ({ pages: [...new Set([...(pages ?? []), ...s.pages])], ready: true, owner: uid }));
    })
    .catch(() => {
      if (useSession.getState().userId === uid) useHelpSeen.setState({ ready: true, owner: uid });
    })
    .finally(() => {
      clearTimeout(late);
      if (loading === uid) loading = null;
    });
}

/** Seen on this phone or on the account. */
export async function isHelpSeen(page: string) {
  if (useHelpSeen.getState().pages.includes(page)) return true;
  const local = await kv.get<boolean>(helpKey(page)).catch(() => null);
  if (local && useSession.getState().userId) markHelpSeen(page); // seen on this phone before: copy it to the account
  return !!local;
}

/** Closed: remember it on the phone and, signed in, on the account. */
export function markHelpSeen(page: string) {
  kv.set(helpKey(page), true).catch(() => {});
  if (!useHelpSeen.getState().pages.includes(page)) useHelpSeen.setState((s) => ({ pages: [...s.pages, page] }));
  if (useSession.getState().userId) void call('mark_help_seen', { p_pages: [page] }).catch(() => {});
}
