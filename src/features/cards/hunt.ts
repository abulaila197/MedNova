import { create } from 'zustand';

import { useSession } from '@/games/shell/session';
import { syncAccount } from '@/lib/sync';
import { call } from '@/online/api';
import { onAccountSwitch } from '@/state/accountSwitch';

/** Mission progress per card: [have, need]. */
export type HuntStatus = { found: string[]; progress: Record<string, [number, number]>; prize: boolean };

type State = { status: HuntStatus | null; loading: boolean };
/** The player's hunt, as the server sees it (cards are only ever added by the server, hunt_check). */
export const useHunt = create<State>(() => ({ status: null, loading: false }));
onAccountSwitch(() => useHunt.setState({ status: null, loading: false }));

/** Asks the server to add any card whose mission is now met, then reloads the collection. Guests have none. */
export async function loadHunt() {
  if (!useSession.getState().userId) return useHunt.setState({ status: null, loading: false });
  useHunt.setState({ loading: true });
  try {
    await call('hunt_check');
    useHunt.setState({ status: await call<HuntStatus>('hunt_status') });
  } finally {
    useHunt.setState({ loading: false });
  }
}

/** Omar's prize (200 tokens), once all nine cards are found. */
export async function redeemHuntPrize() {
  const r = await call<{ ok: boolean; why?: string; tokens?: number }>('hunt_prize');
  const uid = useSession.getState().userId;
  if (uid) await syncAccount(uid).catch(() => {});
  await loadHunt();
  return r;
}
