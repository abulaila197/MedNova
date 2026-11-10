import { localDay } from '@/games/engine/gate';
import type { GameKey, Play } from '@/games/engine/types';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/games/shell/session';

import { bossOf } from './boss';
import { botNamed } from './core';
import { setDay, useRivals, type DayWin } from './memory';
import type { Bot } from './types';

/** Rival of the day (G6): the pure pick (boss.ts) as a real Bot. */
export type Boss = { day: string; bot: Bot; game: GameKey };
export { BOSS_GAMES } from './boss';

export function rivalOfDay(day = localDay()): Boss {
  const b = bossOf(day);
  return { day, bot: botNamed('genius', b.name), game: b.game };
}
/** Today's win state (a state from another day is stale). */
export function todayWin(day: DayWin | null, today = localDay()): DayWin | null {
  return day && day.day === today ? day : null;
}

/** A finished Vs rivals match: did you beat today's boss in its game? Files the win (the chest is claimed from the server). */
export function checkBossWin(play: Play) {
  if (play.mode !== 'bots') return false;
  const boss = rivalOfDay();
  if (play.game !== boss.game) return false;
  const seat = play.seats.find((x) => x.bot?.id === boss.bot.id && !x.removed);
  if (!seat) return false;
  const rank = new Map(play.standings.map((x) => [x.seat, x.rank]));
  if ((rank.get(0) ?? 99) >= (rank.get(seat.seat) ?? 0)) return false;
  if (todayWin(useRivals.getState().day)?.won) return true; // already won today: one chest a day
  setDay({ day: boss.day, won: true, paid: false, seen: false });
  void claimBossChest();
  return true;
}

/**
 * Asks the server to file today's golden chest (rival_day_win: once per player and day). Offline or before the function
 * is live, the win stays on the phone and is asked again next time the page opens.
 */
export async function claimBossChest() {
  const d = todayWin(useRivals.getState().day);
  if (!d || !d.won || d.paid) return false;
  if (!useSession.getState().userId) return false;
  const { data, error } = await supabase.rpc('rival_day_win', { day: d.day });
  if (error || !(data as { ok?: boolean } | null)?.ok) return false;
  setDay({ ...d, paid: true });
  return true;
}

/** The win was seen on the Nemesis page (its badge goes). */
export function sawBossWin() {
  const d = todayWin(useRivals.getState().day);
  if (d && !d.seen) setDay({ ...d, seen: true });
}
