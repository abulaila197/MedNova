import { create } from 'zustand';

import { useSession } from '@/games/shell/session';
import { copyOf, keepCopy } from '@/lib/copies';
import { syncAccount } from '@/lib/sync';
import { call } from '@/online/api';
import { onAccountSwitch } from '@/state/accountSwitch';

/** Mission progress per card: [have, need]. */
export type HuntStatus = { found: string[]; progress: Record<string, [number, number]>; prize: boolean };

/** `savedAt`: the collection on screen is the saved copy from then, because the server can't be reached (#59). */
type State = { status: HuntStatus | null; loading: boolean; savedAt: number | null };
/** The player's hunt, as the server sees it (cards are only ever added by the server, hunt_check). */
export const useHunt = create<State>(() => ({ status: null, loading: false, savedAt: null }));
onAccountSwitch(() => useHunt.setState({ status: null, loading: false, savedAt: null }));

/** Asks the server to add any card whose mission is now met, then reloads the collection. Guests have none. */
export async function loadHunt() {
  const uid = useSession.getState().userId;
  if (!uid) return useHunt.setState({ status: null, loading: false, savedAt: null });
  useHunt.setState({ loading: true });
  try {
    await call('hunt_check');
    const status = await call<HuntStatus>('hunt_status');
    useHunt.setState({ status, savedAt: null });
    void keepCopy('hunt', uid, status);
  } catch (e) {
    // Offline: the cards stay open from the saved copy (#59); claiming needs the server.
    const copy = await copyOf<HuntStatus>('hunt', uid);
    if (copy && useSession.getState().userId === uid) useHunt.setState({ status: copy.v, savedAt: copy.at });
    throw e;
  } finally {
    useHunt.setState({ loading: false });
  }
}

/** Omar's prize (HUNT_PRIZE tokens), once all nine cards are found. */
export async function redeemHuntPrize() {
  const r = await call<{ ok: boolean; why?: string; tokens?: number }>('hunt_prize');
  const uid = useSession.getState().userId;
  if (uid) await syncAccount(uid).catch(() => {});
  // Paid already: a failed reload must not turn the Congrats into "Not redeemed" (AP12d).
  await loadHunt().catch(() => {});
  return r;
}
