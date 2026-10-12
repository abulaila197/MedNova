// The "out of free plays" sheet (T23, TR1-TR5): a signed-in player with no free plays left today for a game
// buys one more with an ad or 3 tokens, or subscribes. needPlay() waits for that choice.
import { router } from 'expo-router';
import { create } from 'zustand';

import { engine, PLAY_PRICE } from '@/games/engine';
import type { GameKey } from '@/games/engine/types';
import { useSession } from '@/games/shell/session';
import { isSubscribed } from '@/features/store/billing';
import { call } from '@/online/api';

/** Ads go live once the store accounts exist (EC2); until then 'Watch an ad' gives the play free (TR5). */
export const ADS_LIVE = false;

type Ask = { game: GameKey; done: (ok: boolean) => void };
export const usePaywall = create<{ ask: Ask | null }>(() => ({ ask: null }));

/** True when the player may start a play of `game` now; opens the sheet and waits when today's free plays are used. */
export async function needPlay(game: GameKey) {
  if (!useSession.getState().userId) return true; // guests go through the sign-in gate instead
  if (isSubscribed()) return true; // MN3: unlimited plays
  if ((await engine.gate.allowance(game)).left > 0) return true;
  return new Promise<boolean>((done) => usePaywall.setState({ ask: { game, done } }));
}

const close = (ok: boolean) => {
  const a = usePaywall.getState().ask;
  usePaywall.setState({ ask: null });
  a?.done(ok);
};

/** 'Watch an ad': a free stand-in until ads are live. */
export async function payWithAd() {
  const a = usePaywall.getState().ask;
  if (!a) return;
  // ADS_LIVE: show the rewarded ad here and stop if it was not watched to the end.
  // Real ads count toward the Ad Watcher achievement; the free stand-in does not.
  if (ADS_LIVE) await call('ad_watched', { source: 'play' }).catch(() => {});
  await engine.gate.addPlay(a.game);
  close(true);
}

/** 'Pay 3 tokens'. False when the wallet is short. */
export async function payWithTokens() {
  const a = usePaywall.getState().ask;
  if (!a) return false;
  const receipt = await engine.wallet.spend(PLAY_PRICE, `free_play_${a.game}`);
  if (!receipt) return false;
  await engine.gate.addPlay(a.game);
  close(true);
  return true;
}

export const cancelPaywall = () => close(false);

/** 'Subscribe': closes the sheet and opens the Store (MN7). */
export const subscribeFromPaywall = () => {
  close(false);
  router.navigate('/store');
};
