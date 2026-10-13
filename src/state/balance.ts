import { create } from 'zustand';

import { engine } from '@/games/engine';

/** Your EXP, tokens and level progress, as the wallet on the phone says (rule 6). */
export type Balance = Awaited<ReturnType<typeof engine.wallet.balance>>;

const EMPTY: Balance = { exp: 0, tokens: 0, level: 1, into: 0, need: 60 } as Balance;

/**
 * The balance every header, profile and store page shows. It is read again only when the wallet changes (an
 * earn, a spend, a refund, a sync or a sign-out), instead of each page polling the whole ledger.
 */
export const useBalanceStore = create<Balance>(() => EMPTY);

const refresh = () =>
  engine.wallet
    .balance()
    .then((x) => useBalanceStore.setState((p) => (p.exp === x.exp && p.tokens === x.tokens ? p : x), true))
    .catch(() => {});

let watching = false;
/** Starts following the wallet (once for the app). */
export function watchBalance() {
  if (watching) return;
  watching = true;
  engine.kv.watch('wallet', () => void refresh());
  void refresh();
}
