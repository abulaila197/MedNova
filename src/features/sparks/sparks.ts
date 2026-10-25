// The Sparks bar on the phone (#4, #82): what the header and setup pages show, what a play pays at its first answer,
// and the Recharge sheet when a play costs more than the bar holds. The bar itself is src/games/engine/sparks.ts.
import { router } from 'expo-router';
import { create } from 'zustand';

import { engine, SPARKS_MAX } from '@/games/engine';
import type { Play } from '@/games/engine/types';
import { isSubscribed } from '@/features/store/billing';
import { bonusOf } from '@/features/shop/robots';
import { supabase } from '@/lib/supabase';
import { useAccount } from '@/state/account';
import { useSession } from '@/games/shell/session';

import { perUnit, sparksCost } from './costs';

/** Ads go live once the store accounts exist (EC2); until then 'Watch an ad' gives its Sparks with no ad (TR5). */
export const ADS_LIVE = false;
export const AD_CAP = 20;

type Bar = { value: number; max: number; /** when the next Spark lands (ms), null when full */ nextAt: number | null; refillMin: number; unlimited: boolean; adsLeft: number | null };
export const useSparks = create<Bar>(() => ({ value: SPARKS_MAX, max: SPARKS_MAX, nextAt: null, refillMin: 10, unlimited: false, adsLeft: null }));

/** Minutes per Spark: the worn character's stars (#88). */
export const refillMin = () => bonusOf(useAccount.getState().profile?.avatar).refillMin;

export async function refreshSparks() {
  const min = refillMin();
  const s = await engine.sparks.state(min);
  useSparks.setState({ value: s.value, max: s.max, nextAt: s.nextIn ? Date.now() + s.nextIn : null, refillMin: min, unlimited: isSubscribed() });
}

let watching = false;
/** Follows the bar for the whole app: phone spends, server syncs, a new character, a subscription. */
export function watchSparks() {
  if (watching) return;
  watching = true;
  engine.kv.watch('sparks', () => void refreshSparks());
  useAccount.subscribe((a, b) => {
    if (a.profile?.avatar !== b.profile?.avatar) void refreshSparks();
    // Another account on this phone: the old bar is not theirs (it comes down with their first sync).
    const id = a.profile?.id;
    if (id && id !== b.profile?.id) void engine.sparks.owner().then((o) => (o && o !== id ? engine.sparks.clear() : undefined));
  });
  void refreshSparks();
}

type View = { value: number; at: string; refill_min: number; ads_left: number; unlimited: boolean; refused?: string[]; ok?: boolean; why?: string; need?: number };

const take = async (uid: string, v: View, sent: string[]) => {
  await engine.sparks.settle(uid, { value: v.value, at: Date.parse(v.at) }, sent);
  useSparks.setState({ adsLeft: v.ads_left });
};

/** Sends the phone's spends and takes the server's bar (offline: nothing happens, they go next time). */
export async function syncSparks(uid: string) {
  const spends = await engine.sparks.pending();
  const { data, error } = await supabase.rpc('sparks_sync', { spends: spends.map((x) => ({ ...x, at: new Date(x.at).toISOString() })) });
  if (error) throw error;
  await take(uid, data as View, spends.map((x) => x.id));
}

/**
 * Pays for a play once, at its first answer (TR2, #52). Guests use one of their 5 plays (#83); subscribers and
 * free plays (Medicordle Daily, your own case) pay nothing; a Grand Rounds booster play pays nothing.
 */
export async function chargePlay(play: Play, free: boolean) {
  if (!play.userId) return engine.gate.countGuest(play.game, play.id);
  if (free || isSubscribed()) return;
  if (await engine.gate.useBoost(play.game, play.id)) return;
  if (perUnit(play.game, play.mode, play.settings)) return; // the game pays each level / word itself
  await chargeUnit(play, play.id, sparksCost(play.game, play.mode, play.settings));
}

/** Pays `cost` once for one unit of a play (a Riddler level, a Medicordle Endless word). */
export async function chargeUnit(play: Play, unit: string, cost: number) {
  if (!play.userId || isSubscribed() || cost <= 0) return;
  if (await engine.sparks.charge(unit, cost, play.game)) syncSparks(play.userId).catch(() => {});
}

type Ask = { cost: number; done: (ok: boolean) => void };
export const useRecharge = create<{ ask: Ask | null; busy: boolean; why: string | null }>(() => ({ ask: null, busy: false, why: null }));

/** True when the player may start a play costing `cost`; otherwise opens the Recharge sheet and waits for it. */
export async function needSparks(cost: number) {
  if (cost <= 0 || !useSession.getState().userId || isSubscribed()) return true;
  await refreshSparks();
  if (useSparks.getState().value >= cost) return true;
  return new Promise<boolean>((done) => useRecharge.setState({ ask: { cost, done }, why: null }));
}

const close = (ok: boolean) => {
  const a = useRecharge.getState().ask;
  useRecharge.setState({ ask: null, busy: false, why: null });
  a?.done(ok);
};

/** After an ad or a refill: closes the sheet once the bar covers the play. */
const settled = async () => {
  await refreshSparks();
  const a = useRecharge.getState().ask;
  if (a && a.cost > 0 && useSparks.getState().value >= a.cost) close(true);
};

// One request at a time: a fast double tap must not pay twice (DEF-094).
const once = (job: (uid: string) => Promise<View>) => async () => {
  const uid = useSession.getState().userId;
  if (!uid || useRecharge.getState().busy) return;
  useRecharge.setState({ busy: true, why: null });
  try {
    await syncSparks(uid); // offline spends first, so the server's bar is the real one
    const v = await job(uid);
    await take(uid, v, []);
    useRecharge.setState({ busy: false, why: v.ok === false ? (v.why ?? 'error') : null });
    if (v.ok !== false) await settled();
  } catch {
    useRecharge.setState({ busy: false, why: 'offline' });
  }
};

/** 'Watch an ad': +5 Sparks, 20 a day. A free stand-in until ads are live. */
export const rechargeWithAd = once(async () => {
  // ADS_LIVE: show the rewarded ad here and stop if it was not watched to the end (ad_watched counts real ads).
  const { data, error } = await supabase.rpc('sparks_ad');
  if (error) throw error;
  return data as View;
});

/** 'Refill with tokens': just enough Sparks for this play (from the header: up to a full bar), 1 token each. */
export const rechargeWithTokens = once(async (uid) => {
  const a = useRecharge.getState().ask;
  const { value, max } = useSparks.getState();
  const n = Math.max(1, (a?.cost || max) - value);
  const { data, error } = await supabase.rpc('sparks_buy', { n });
  if (error) throw error;
  // The token spend is a server row: bring it down so the coin shows the new balance.
  const { syncAccount } = await import('@/lib/sync');
  syncAccount(uid).catch(() => {});
  return data as View;
});

export const cancelRecharge = () => close(false);

/** The header's Sparks: the same sheet with no play waiting (cost 0), to watch an ad or fill up with tokens. */
export const openSparks = () => useRecharge.setState({ ask: { cost: 0, done: () => {} }, why: null });

/** 'Subscribe': closes the sheet and opens the Nova Shop (MN7). */
export const subscribeFromRecharge = () => {
  close(false);
  router.navigate('/store');
};
