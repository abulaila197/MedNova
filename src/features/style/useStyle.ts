// Frames, titles, win effects and sticker packs on the account (Yazan 2026-10-13). The server owns every purchase
// (style_buy / style_wear / token_spend); the phone keeps a copy for drawing and asks again after each change.
import { create } from 'zustand';

import { useSession } from '@/games/shell/session';
import { supabase } from '@/lib/supabase';
import { syncAccount } from '@/lib/sync';

import type { FrameKey } from './Frame';
import type { EffectKey } from './catalog';

/** What a player wears, as others see it. */
export type Look = { frame: FrameKey; title: string; effect: EffectKey | null; glow: boolean };

export const PLAIN: Look = { frame: 'normal', title: 'medical_student', effect: null, glow: false };

export type Gift = { item: string; from: string };

type Mine = {
  owned: string[];
  worn: Look;
  /** This week's deal ids (one frame, one title). */
  deal: string[];
  dealEnds: number;
  gifts: Gift[];
  loaded: boolean;
};

type StyleState = Mine & {
  /** Other players' looks by user id (fetched in batches, kept for the session). */
  looks: Record<string, Look>;
};

export const useStyle = create<StyleState>(() => ({
  owned: ['frame:normal', 'title:medical_student'],
  worn: PLAIN,
  deal: [],
  dealEnds: 0,
  gifts: [],
  loaded: false,
  looks: {},
}));

type Status = {
  owned: string[];
  worn: (Partial<Look> & { glow_until?: string | null }) | null;
  deal: { frame: string; title: string };
  deal_ends: number;
  gifts: Gift[];
};

// The weekly deal, worked out the same way as the server's style_deal (so guests see it too).
const WEEK0 = Date.UTC(2026, 9, 10);
const WEEK = 7 * 86400000;
const DEAL_FRAMES = ['bronze', 'silver', 'gold', 'platinum', 'stethoscope', 'helix', 'neuron', 'pulse', 'laurel', 'aurora', 'nova'];
const DEAL_TITLES = ['intern', 'night_owl', 'coffee_powered', 'resident', 'differential_hunter', 'ward_whisperer', 'chief_resident',
  'the_diagnostician', 'pager_legend', 'attending', 'consultant', 'riddle_master', 'head_of_department', 'professor'];
function guestDeal() {
  const w = Math.floor((Date.now() - WEEK0) / WEEK);
  const at = (n: number, m: number) => ((n % m) + m) % m;
  return { deal: [`frame:${DEAL_FRAMES[at(w * 7, 11)]}`, `title:${DEAL_TITLES[at(w * 5, 14)]}`], dealEnds: WEEK0 + (w + 1) * WEEK };
}

/** Reads your own items, look, the weekly deal and unseen gifts. */
export async function loadStyle() {
  const userId = useSession.getState().userId;
  if (!userId) {
    useStyle.setState({ owned: ['frame:normal', 'title:medical_student'], worn: PLAIN, gifts: [], loaded: true, ...guestDeal() });
    return;
  }
  const { data } = await supabase.rpc('style_status');
  const st = data as Status | null;
  if (!st) return;
  const w = st.worn;
  const worn: Look = {
    frame: (w?.frame as FrameKey) ?? 'normal',
    title: w?.title ?? 'medical_student',
    effect: (w?.effect as EffectKey | null) ?? null,
    glow: !!w?.glow_until && Date.parse(w.glow_until) > Date.now(),
  };
  useStyle.setState((s) => ({
    owned: st.owned,
    worn,
    deal: [st.deal.frame, st.deal.title],
    dealEnds: st.deal_ends,
    gifts: st.gifts,
    loaded: true,
    looks: { ...s.looks, [userId]: worn },
  }));
}

let asking = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

/** Asks the server for these players' looks (batched; each id once per session). */
export function wantLooks(ids: (string | null | undefined)[]) {
  const have = useStyle.getState().looks;
  for (const id of ids) if (id && !(id in have)) asking.add(id);
  if (!asking.size || timer) return;
  timer = setTimeout(async () => {
    const batch = [...asking];
    asking = new Set();
    timer = null;
    if (!useSession.getState().userId) return;
    const { data } = await supabase.rpc('style_of', { ids: batch });
    const got = (data as Record<string, Look> | null) ?? {};
    useStyle.setState((s) => ({ looks: { ...s.looks, ...Object.fromEntries(batch.map((id) => [id, got[id] ?? PLAIN])) } }));
  }, 60);
}

/** A player's look; your own comes from your account copy. */
export function useLook(userId?: string | null): Look {
  const me = useSession((s) => s.userId);
  return useStyle((s) => (!userId ? PLAIN : userId === me ? s.worn : (s.looks[userId] ?? PLAIN)));
}

export type ShopResult = { ok: true } | { ok: false; why: string; need?: number };

const after = async () => {
  const userId = useSession.getState().userId;
  if (userId) await syncAccount(userId).catch(() => {});
  await loadStyle();
};

/** Buys an item (or gifts it to a friend). Unsynced spends on this phone go up first so the server sees the right balance. */
export async function buyItem(item: string, giftTo?: string): Promise<ShopResult> {
  const userId = useSession.getState().userId;
  if (!userId) return { ok: false, why: 'signin' };
  await syncAccount(userId).catch(() => {});
  const { data, error } = await supabase.rpc('style_buy', { item, gift_to: giftTo ?? null });
  if (error || !data) return { ok: false, why: 'offline' };
  await after();
  return data as ShopResult;
}

/** Puts on owned items. `effect: null` takes the win effect off. */
export async function wear(p: { frame?: string; title?: string; effect?: string | null }): Promise<ShopResult> {
  const { data, error } = await supabase.rpc('style_wear', {
    frame: p.frame ?? null,
    title: p.title ?? null,
    effect: p.effect ?? null,
    clear_effect: p.effect === null,
  });
  if (error || !data) return { ok: false, why: 'offline' };
  await loadStyle();
  return data as ShopResult;
}

/** Other token spends: name glow, a second chance in a run, the Grand Rounds booster. */
export async function spendTokens(what: 'glow' | 'second' | 'booster', ref?: string): Promise<ShopResult & { cost?: number }> {
  const userId = useSession.getState().userId;
  if (!userId) return { ok: false, why: 'signin' };
  await syncAccount(userId).catch(() => {});
  const { data, error } = await supabase.rpc('token_spend', { what, ref: ref ?? null });
  if (error || !data) return { ok: false, why: 'offline' };
  await after();
  return data as ShopResult & { cost?: number };
}

export async function giftsSeen() {
  useStyle.setState({ gifts: [] });
  await supabase.rpc('style_gifts_seen');
}

/** Words for a refused purchase. */
export const WHY: Record<string, string> = {
  tokens: 'Not enough tokens yet.',
  owned: 'Already owned.',
  'not friends': 'You can only send gifts to friends.',
  'not sold': 'This one is earned, not sold.',
  'not owned': 'Buy it first.',
  'not this week': 'The booster is only for this week’s game.',
  max: 'No more second chances in this run.',
  offline: 'Could not reach MedNova. Check your connection and try again.',
  signin: 'Sign in first.',
};

export const whySay = (r: { why: string; need?: number }) => (r.why === 'tokens' && r.need ? `You need ${r.need} more tokens.` : (WHY[r.why] ?? WHY.offline));
