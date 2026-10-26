// Frames, titles, win effects and sticker packs on the account (Yazan 2026-10-13). The server owns every purchase
// (style_buy / style_wear / token_spend); the phone keeps a copy for drawing and asks again after each change.
// Offline (#57, #58): the last copy is kept per account and shown while the server can't be reached; wear changes
// made offline show at once and wait on the phone, then go up with their time (the newest change wins on the server).
import { create } from 'zustand';

import { engine } from '@/games/engine';
import { useSession } from '@/games/shell/session';
import { copyOf, keepCopy } from '@/lib/copies';
import { supabase } from '@/lib/supabase';
import { syncAccount } from '@/lib/sync';
import { refreshProfile, useAccount } from '@/state/account';

import type { FrameKey } from './Frame';
import type { EffectKey } from './catalog';

/** What a player wears, as others see it. */
export type Look = { frame: FrameKey; title: string; effect: EffectKey | null; glow: boolean; glowUntil?: number | null };

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
  /** Whose items these are (a copy from another account is never shown). */
  owner: string | null;
  /** When the copy on screen was read, while the server can't be reached; null when it is fresh. */
  savedAt: number | null;
  /** Offline wear changes the server refused ('frame:gold', 'avatar:bloop'), for the note that puts them back. */
  refused: string[];
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
  owner: null,
  savedAt: null,
  refused: [],
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

/** A wear change waiting on this phone: the new value and when it was made (ms). `effect: null` takes it off. */
type Slot = 'frame' | 'title' | 'effect' | 'avatar';
type Pending = Partial<Record<Slot, { v: string | null; at: number }>>;
const pendingKey = (uid: string) => `wear:pending:${uid}`;
const readPending = async (uid: string) => (await engine.kv.get<Pending>(pendingKey(uid)).catch(() => null)) ?? {};

/** The look with this phone's waiting changes on top. */
const withPending = (w: Look, p: Pending): Look => ({
  ...w,
  ...(p.frame ? { frame: p.frame.v as FrameKey } : {}),
  ...(p.title?.v ? { title: p.title.v } : {}),
  ...(p.effect ? { effect: p.effect.v as EffectKey | null } : {}),
});

const PLAIN_OWNED = ['frame:normal', 'title:medical_student'];

/** Puts a status (fresh from the server, or the saved copy) on screen, with the waiting changes on top. */
async function show(userId: string, st: Status, savedAt: number | null) {
  const w = st.worn;
  const worn: Look = withPending(
    {
      frame: (w?.frame as FrameKey) ?? 'normal',
      title: w?.title ?? 'medical_student',
      effect: (w?.effect as EffectKey | null) ?? null,
      glow: !!w?.glow_until && Date.parse(w.glow_until) > Date.now(),
      glowUntil: w?.glow_until ? Date.parse(w.glow_until) : null,
    },
    await readPending(userId),
  );
  if (useSession.getState().userId !== userId) return;
  useStyle.setState((s) => ({
    owned: st.owned,
    worn,
    deal: [st.deal.frame, st.deal.title],
    dealEnds: st.deal_ends,
    // Gifts are only shown fresh, so a saved copy never pops the same gift up again.
    gifts: savedAt == null ? st.gifts : [],
    loaded: true,
    owner: userId,
    savedAt,
    looks: { ...s.looks, [userId]: worn },
  }));
}

/** Reads your own items, look, the weekly deal and unseen gifts. Offline: the last saved copy. */
export async function loadStyle() {
  const userId = useSession.getState().userId;
  if (!userId) {
    useStyle.setState({ owned: PLAIN_OWNED, worn: PLAIN, gifts: [], loaded: true, owner: null, savedAt: null, ...guestDeal() });
    return;
  }
  if (useStyle.getState().owner !== userId) {
    const copy = await copyOf<Status>('style', userId);
    if (copy) await show(userId, copy.v, copy.at);
    else if (useSession.getState().userId === userId)
      useStyle.setState({ owned: PLAIN_OWNED, worn: PLAIN, gifts: [], loaded: false, owner: userId, savedAt: null, ...guestDeal() });
  }
  // Waiting wear changes go up first, so the status read next already has them.
  await flushWear().catch(() => {});
  const { data } = await supabase.rpc('style_status');
  const st = data as Status | null;
  if (!st) {
    // Unreachable: the screen keeps the copy it has; mark it as saved if it was fresh until now.
    if (useStyle.getState().owner === userId && useStyle.getState().savedAt == null && useStyle.getState().loaded)
      useStyle.setState({ savedAt: (await copyOf<Status>('style', userId))?.at ?? Date.now() });
    return;
  }
  void keepCopy('style', userId, st);
  await show(userId, st, null);
}

type Flushed = { offline: boolean; refused: string[]; sent: Slot[] };
let flushing: Promise<Flushed> | null = null;

/** Sends the waiting wear changes, oldest slot first. Each carries its time; the server keeps the newest (#58). */
export function flushWear() {
  flushing ??= sendPending().finally(() => (flushing = null));
  return flushing;
}

async function sendPending(): Promise<Flushed> {
  const out: Flushed = { offline: false, refused: [], sent: [] };
  const uid = useSession.getState().userId;
  if (!uid) return out;
  const list = Object.entries(await readPending(uid)) as [Slot, { v: string | null; at: number }][];
  for (const [slot, c] of list.sort((a, b) => a[1].at - b[1].at)) {
    const at = new Date(c.at).toISOString();
    const { data, error } =
      slot === 'avatar'
        ? await supabase.rpc('set_avatar', { slug: c.v, at })
        : await supabase.rpc('style_wear', {
            frame: slot === 'frame' ? c.v : null,
            title: slot === 'title' ? c.v : null,
            effect: slot === 'effect' ? c.v : null,
            clear_effect: slot === 'effect' && c.v === null,
            at,
          });
    // Not reached: this one and the rest wait for the next try.
    if (error || !data) return { ...out, offline: true };
    if (!(data as { ok?: boolean }).ok) out.refused.push(`${slot}:${c.v}`);
    out.sent.push(slot);
    // Done with this slot, unless a newer change to it was made while this one was on its way.
    const now = await readPending(uid);
    if (now[slot]?.at === c.at) {
      delete now[slot];
      await engine.kv.set(pendingKey(uid), now);
    }
  }
  if (out.sent.includes('avatar')) refreshProfile();
  return out;
}

/** Puts changes on the phone at once and queues them (#58). */
async function queueWear(uid: string, change: Pending) {
  const p = { ...(await readPending(uid)), ...change };
  await engine.kv.set(pendingKey(uid), p);
  if (useStyle.getState().owner === uid)
    useStyle.setState((s) => {
      const worn = withPending(s.worn, change);
      return { worn, looks: { ...s.looks, [uid]: worn } };
    });
  if (change.avatar?.v) {
    const prof = useAccount.getState().profile;
    if (prof?.id === uid) useAccount.setState({ profile: { ...prof, avatar: change.avatar.v } });
  }
}

/** On reconnect: sends what waits, and puts back (with a note) anything the server refused. */
export async function flushInBackground() {
  const uid = useSession.getState().userId;
  if (!uid || !Object.keys(await readPending(uid)).length) return;
  const r = await flushWear().catch(() => null);
  if (!r || !r.sent.length) return;
  if (r.refused.length) useStyle.setState((s) => ({ refused: [...s.refused, ...r.refused] }));
  await loadStyle();
}

export const refusedSeen = () => useStyle.setState({ refused: [] });

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
    const { data, error } = await supabase.rpc('style_of', { ids: batch });
    // A failed read caches nothing, so these players are asked again next time instead of showing plain all session.
    if (error) return;
    const got = (data as Record<string, Look> | null) ?? {};
    useStyle.setState((s) => ({ looks: { ...s.looks, ...Object.fromEntries(batch.map((id) => [id, got[id] ?? PLAIN])) } }));
  }, 60);
}

/** A player's look; your own comes from your account copy. */
export function useLook(userId?: string | null): Look {
  const me = useSession((s) => s.userId);
  return useStyle((s) => (!userId ? PLAIN : userId === me ? s.worn : (s.looks[userId] ?? PLAIN)));
}

export type ShopResult = { ok: true; prize?: number } | { ok: false; why: string; need?: number };

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

/** What a wear answers: `queued` when it was saved on the phone and goes up once back online. */
export type WearResult = ShopResult & { queued?: boolean };

/** Sends one queued change now; offline it stays queued and the look already shows it. */
async function wearNow(uid: string, slot: Slot, change: Pending): Promise<WearResult> {
  await queueWear(uid, change);
  const r = await flushWear();
  if (r.offline) return { ok: true, queued: true };
  const bad = r.refused.some((x) => x.startsWith(`${slot}:`));
  await loadStyle();
  if (slot === 'avatar' && bad) refreshProfile();
  return bad ? { ok: false, why: 'not owned' } : { ok: true };
}

/** Puts on owned items. `effect: null` takes the win effect off. Works offline (#58). */
export async function wear(p: { frame?: string; title?: string; effect?: string | null }): Promise<WearResult> {
  const uid = useSession.getState().userId;
  if (!uid) return { ok: false, why: 'signin' };
  const at = Date.now();
  const change: Pending = {};
  if (p.frame) change.frame = { v: p.frame, at };
  if (p.title) change.title = { v: p.title, at };
  if (p.effect !== undefined) change.effect = { v: p.effect, at };
  const slot = (Object.keys(change)[0] ?? 'frame') as Slot;
  return wearNow(uid, slot, change);
}

/** Puts on a character you own; the server checks it is yours (set_avatar). Works offline (#58). */
export async function wearCharacterNow(slug: string): Promise<WearResult> {
  const uid = useSession.getState().userId;
  if (!uid) return { ok: false, why: 'signin' };
  return wearNow(uid, 'avatar', { avatar: { v: slug, at: Date.now() } });
}

/** Other token spends: name glow and a second chance in a run. */
export async function spendTokens(what: 'glow' | 'second', ref?: string): Promise<ShopResult & { cost?: number; id?: string }> {
  const userId = useSession.getState().userId;
  if (!userId) return { ok: false, why: 'signin' };
  await syncAccount(userId).catch(() => {});
  const { data, error } = await supabase.rpc('token_spend', { what, ref: ref ?? null });
  if (error || !data) return what === 'second' && ref ? secondOnPhone(userId, ref) : { ok: false, why: 'offline' };
  await after();
  return data as ShopResult & { cost?: number; id?: string };
}

/** Second chance prices in a run (the server's token_spend uses the same). */
const SECOND_COST = [5, 10, 20];
/** Receipts of second chances bought on the phone start with this, so a refund knows which way to go. */
const PHONE = 'phone:';

/**
 * Offline (Yazan 2026-10-26): a second chance is taken from the phone's wallet with the same rules as the server
 * (5, 10, then 20 tokens; 3 a run; none after one was given back). wallet_sync checks it again when back online.
 */
async function secondOnPhone(userId: string, ref: string): Promise<ShopResult & { cost?: number; id?: string }> {
  const all = await engine.wallet.ledger();
  const reason = `second:${ref}`;
  const bought = all.filter((e) => e.kind === 'spend' && e.reason === reason);
  if (bought.length >= SECOND_COST.length || bought.some((b) => all.some((e) => e.kind === 'refund' && e.reason === b.id))) return { ok: false, why: 'max' };
  const cost = SECOND_COST[bought.length];
  const id = await engine.wallet.spend(cost, reason);
  if (!id) return { ok: false, why: 'tokens', need: cost - (await engine.wallet.balance()).tokens };
  void syncAccount(userId).catch(() => {});
  return { ok: true, cost, id: PHONE + id };
}

/** A second chance bought for a round or level that ended while the purchase was on its way: the server gives that
 *  one purchase back (once, within 2 minutes) and allows no more second chances there (token_second_refund). */
export async function refundSecond(spendId: string | undefined) {
  if (!spendId) return false;
  if (spendId.startsWith(PHONE)) {
    const back = await engine.wallet.refund(spendId.slice(PHONE.length));
    const uid = useSession.getState().userId;
    if (back && uid) void syncAccount(uid).catch(() => {});
    return back;
  }
  const { data, error } = await supabase.rpc('token_second_refund', { spend_id: spendId });
  if (error || !(data as { ok?: boolean } | null)?.ok) return false;
  await after();
  return true;
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
  max: 'No more second chances in this run.',
  offline: 'Could not reach MedNova. Check your connection and try again.',
  signin: 'Sign in first.',
};

export const whySay = (r: { why: string; need?: number }) => (r.why === 'tokens' && r.need ? `You need ${r.need} more tokens.` : (WHY[r.why] ?? WHY.offline));
