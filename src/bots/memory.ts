import { create } from 'zustand';

import { defaultKV } from '@/games/engine/storage';
import type { Play } from '@/games/engine/types';

import { botNamed } from './core';
import type { Bot, BotType, HeadToHead } from './types';

/**
 * What the phone remembers about rivals (Yazan 2026-11-09): your favourites, how often you've met each one, and
 * (G6) your head-to-head record with it. Same name, same person: a rival's level grows a little each time you play it.
 */
export type Record_ = HeadToHead;
/** The rival of the day: whether you beat it today, and whether the server has filed the chest (paid). */
export type DayWin = { day: string; won: boolean; paid: boolean; seen: boolean };
type Saved = { favs: string[]; met: Record<string, number>; record: Record<string, Record_>; day: DayWin | null };
type State = Saved & { loaded: boolean };
export const useRivals = create<State>(() => ({ favs: [], met: {}, record: {}, day: null, loaded: false }));

const kv = defaultKV();
const KEY = 'rivals:memory';
const save = () => {
  const { favs, met, record, day } = useRivals.getState();
  void kv.set(KEY, { favs, met, record, day }).catch(() => {});
};

export async function loadRivals() {
  if (useRivals.getState().loaded) return;
  const v = await kv.get<Partial<Saved>>(KEY).catch(() => null);
  useRivals.setState({ favs: v?.favs ?? [], met: v?.met ?? {}, record: v?.record ?? {}, day: v?.day ?? null, loaded: true });
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

/** A finished Vs rivals match: one win or loss against each rival at the table (finishing level counts as a loss). */
export function recordMatch(play: Play) {
  const rank = new Map(play.standings.map((x) => [x.seat, x.rank]));
  const mine = rank.get(0) ?? 99;
  useRivals.setState((s) => {
    const record = { ...s.record };
    for (const x of play.seats) {
      if (!x.bot || x.removed) continue;
      const won = mine < (rank.get(x.seat) ?? 0);
      const old = record[x.bot.id] ?? { w: 0, l: 0 };
      record[x.bot.id] = { w: old.w + (won ? 1 : 0), l: old.l + (won ? 0 : 1), last: won ? 'won' : 'lost', game: play.game, settings: play.settings, at: play.endedAt ?? Date.now() };
    }
    return { record };
  });
  save();
}

export function setDay(day: DayWin | null) {
  useRivals.setState({ day });
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

/** Your Nemesis shelf (G6): the rivals you've finished matches with, the most met first, 12 at most. */
export function regulars(s: Pick<State, 'met' | 'record' | 'favs'>): { bot: Bot; rec: Record_; met: number }[] {
  return Object.entries(s.record)
    .map(([id, rec]) => ({ bot: rivalOf(id), rec, met: s.met[id] ?? rec.w + rec.l }))
    .filter((x): x is { bot: Bot; rec: Record_; met: number } => !!x.bot)
    .sort((a, b) => b.met - a.met || b.rec.at - a.rec.at)
    .slice(0, 12);
}
