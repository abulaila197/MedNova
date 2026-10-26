// Pass the phone: Yazan's offline machine runs on the phone. Players p1..p4 are the four seats in order; seat 0 is
// the phone owner.
import { sfx } from '@/lib/sound';

import termsJson from './data/terms.json';
import type { OfflineEnv } from './engine/offlineMachine';
import type { Effect, Term } from './engine/types';

export const TERMS = termsJson as Term[];

export const ENV: OfflineEnv = { terms: TERMS, rng: Math.random, now: () => Date.now() };

/** My own terms (My diseases), by their "c:" id; a practice match plays its term first. */
export const OWN_TERMS = new Map<string, Term>();
/** The machine's world for one play: a practice of my own term adds it and plays it first. */
export function envFor(custom: unknown): OfflineEnv {
  const own = typeof custom === 'string' ? OWN_TERMS.get(custom) : undefined;
  return own ? { ...ENV, terms: [own, ...TERMS], first: [own.id] } : ENV;
}

export const termOf = (id: string | null) => (id ? (OWN_TERMS.get(id) ?? TERMS.find((x) => x.id === id) ?? null) : null);

/** The machine wants four different names; a repeated name gets its seat number. */
export const uniqueNames = (names: string[]) => names.map((n, i) => (names.findIndex((m) => m.trim().toLowerCase() === n.trim().toLowerCase()) === i ? n : `${n} ${i + 1}`));

/** The machine's sounds, on the app's six. */
export function playEffects(effects: readonly Effect<unknown>[]) {
  const kinds = new Set(effects.flatMap((e) => (e.type === 'SOUND' ? [e.kind] : [])));
  const timeUp = effects.some((e) => e.type === 'HAPTIC' && e.kind === 'buzzer');
  if (timeUp) void sfx('timeup');
  else if (kinds.has('ding')) void sfx('right');
  else if (kinds.has('buzzer')) void sfx('wrong');
  else if (kinds.has('tap')) void sfx('tap');
}
