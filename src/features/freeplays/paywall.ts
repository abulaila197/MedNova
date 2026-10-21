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

/** Play-again ads: 20 a day in total across all games (Yazan 2026-10-21, was 5); Store token ads have their own 5. */
export const PLAY_AD_CAP = 20;
const AD_KEY = 'ads:play';
// The phone's own date, like the free plays (gate.ts) and the sheet's "3 new free plays at midnight" (AP10c).
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Play-again ads left today on this phone (the server holds the same cap once ads are live). */
export async function playAdsLeft() {
  const d = await engine.kv.get<{ date: string; n: number }>(AD_KEY);
  return PLAY_AD_CAP - (d?.date === today() ? d.n : 0);
}

// One payment at a time: a fast double tap must not spend twice or count two ads for one play (DEF-094).
let paying = false;
const once = <A extends unknown[]>(job: (...a: A) => Promise<boolean>) => async (...a: A) => {
  if (paying) return true; // the first tap is still working; don't show "not enough" for the second
  paying = true;
  try {
    return await job(...a);
  } finally {
    paying = false;
  }
};

/** 'Watch an ad': one more play, never tokens. A free stand-in until ads are live. */
export const payWithAd = once(async () => {
  const a = usePaywall.getState().ask;
  if (!a) return false;
  const left = await playAdsLeft();
  if (left <= 0) return false;
  // ADS_LIVE: show the rewarded ad here and stop if it was not watched to the end.
  // Real ads count toward the Commercial Break achievement; the free stand-in does not.
  if (ADS_LIVE) {
    const r = await call<{ ok: boolean }>('ad_watched', { source: 'play' }).catch(() => ({ ok: true }));
    if (!r.ok) return false;
  }
  await engine.kv.set(AD_KEY, { date: today(), n: PLAY_AD_CAP - left + 1 });
  await engine.gate.addPlay(a.game);
  close(true);
  return true;
});

/** 'Pay 3 tokens'. False when the wallet is short. */
export const payWithTokens = once(async () => {
  const a = usePaywall.getState().ask;
  if (!a) return false;
  const receipt = await engine.wallet.spend(PLAY_PRICE, `free_play_${a.game}`);
  if (!receipt) return false;
  await engine.gate.addPlay(a.game);
  close(true);
  return true;
});

export const cancelPaywall = () => close(false);

/** 'Subscribe': closes the sheet and opens the Store (MN7). */
export const subscribeFromPaywall = () => {
  close(false);
  router.navigate('/store');
};
