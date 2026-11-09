import { create } from 'zustand';

import { defaultKV } from '@/games/engine/storage';

import { botNamed } from './core';
import type { Bot, BotType } from './types';

/**
 * What the phone remembers about rivals (Yazan 2026-11-09): your favourites, and how often you've met each one.
 * Same name, same person: a rival's level grows a little each time you play it, like a real player's.
 */
type State = { favs: string[]; met: Record<string, number>; loaded: boolean };
export const useRivals = create<State>(() => ({ favs: [], met: {}, loaded: false }));

const kv = defaultKV();
const KEY = 'rivals:memory';
const save = () => {
  const { favs, met } = useRivals.getState();
  void kv.set(KEY, { favs, met }).catch(() => {});
};

export async function loadRivals() {
  if (useRivals.getState().loaded) return;
  const v = await kv.get<{ favs: string[]; met: Record<string, number> }>(KEY).catch(() => null);
  useRivals.setState({ favs: v?.favs ?? [], met: v?.met ?? {}, loaded: true });
}

export function toggleFav(bot: Bot) {
  useRivals.setState((s) => ({ favs: s.favs.includes(bot.id) ? s.favs.filter((x) => x !== bot.id) : [...s.favs, bot.id] }));
  save();
}

/** Called when a match with these rivals starts. */
export function meet(bots: Bot[]) {
  useRivals.setState((s) => {
    const met = { ...s.met };
    for (const b of bots) met[b.id] = (met[b.id] ?? 0) + 1;
    return { met };
  });
  save();
}

/** The level a rival shows: its starting level plus one for every 2 matches you've played it (12 at most). */
export const grownLevel = (bot: Bot, met: Record<string, number>) => bot.level + Math.min(12, Math.floor((met[bot.id] ?? 0) / 2));

/** A rival back from its saved id ('bot:<type>:<name>'), with the same face, personality and level as always. */
export function rivalOf(id: string): Bot | null {
  const [, type, ...rest] = id.split(':');
  const name = rest.join(':');
  if (!['freshman', 'scholar', 'genius'].includes(type) || !name) return null;
  return botNamed(type as BotType, name);
}
