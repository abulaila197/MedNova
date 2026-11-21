import { engine } from '../engine';
import type { Play } from '../engine/types';

/**
 * Beat my score plays the same questions (Yazan 2026-11-22). Every Solo and Vs rivals deal remembers what it dealt;
 * the challenge sends that list in its settings (`deal`), and the friend's deal takes those ids first, in order, before
 * any fresh pick. Ids no longer in the pool (a bank change, other field ticks) are skipped and replaced by fresh ones.
 */
const KEY = 'deals';
/** Plays remembered, newest last; a play's list is cut to this many ids (a long Streak Master round deals its whole pool). */
const KEEP_PLAYS = 10;
const KEEP_IDS = 200;

type Deals = { id: string; ids: string[] }[];

/** The fixed deal a challenge play brings, or null. */
export const dealOf = (settings: Record<string, unknown>): string[] | null => (Array.isArray(settings.deal) ? settings.deal.map(String) : null);

/** `order` with the challenge's fixed ids (those still in it) moved to the front. */
export function dealFirst(settings: Record<string, unknown>, order: string[]) {
  const fixed = dealOf(settings);
  if (!fixed) return order;
  const there = new Set(order);
  const head = [...new Set(fixed.filter((id) => there.has(id)))];
  const used = new Set(head);
  return [...head, ...order.filter((id) => !used.has(id))];
}

/** Adds what a play dealt to its list (a game may deal in parts, like Streak Master's clinical and basic halves). */
export async function keepDeal(playId: string, ids: string[]) {
  const all = (await engine.kv.get<Deals>(KEY)) ?? [];
  const old = all.find((x) => x.id === playId)?.ids ?? [];
  const next = [...all.filter((x) => x.id !== playId), { id: playId, ids: [...old, ...ids].slice(0, KEEP_IDS) }].slice(-KEEP_PLAYS);
  await engine.kv.set(KEY, next);
}

/** What a play dealt, and forgets it. */
export async function takeDeal(playId: string) {
  const all = (await engine.kv.get<Deals>(KEY)) ?? [];
  const mine = all.find((x) => x.id === playId)?.ids ?? null;
  if (mine) await engine.kv.set(KEY, all.filter((x) => x.id !== playId));
  return mine?.length ? mine : null;
}

/**
 * Picks `n` ids from `pool` for a play, the challenge's fixed ones first, then the picker's (unseen first), and
 * remembers them. Every Solo and Vs rivals deal that used engine.picker goes through here.
 */
export async function pickFor(play: Pick<Play, 'id' | 'game' | 'settings'>, pool: string[], n: number) {
  const inPool = new Set(pool);
  const head = [...new Set((dealOf(play.settings) ?? []).filter((id) => inPool.has(id)))].slice(0, n);
  const used = new Set(head);
  const tail = head.length < n ? await engine.picker.pick(play.game, pool.filter((id) => !used.has(id)), n - head.length) : [];
  const ids = [...head, ...tail];
  await keepDeal(play.id, ids);
  return ids;
}
