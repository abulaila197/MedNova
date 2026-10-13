// Free plays (T23, TR1-TR5). Guests: 1 try per game, ever, in Solo or Pass the phone (Online needs an account).
// Signed in: 3 free plays per game per day, shared by its modes; after that a play is bought with an ad or
// 3 tokens, or unlimited with the subscription. A play counts at its first answer (TR2); Medicordle's Daily word
// never counts (TR3). The day is the phone's own date.
import { serial, type KV } from './storage';
import type { GameKey, Mode } from './types';

export const GUEST_TRIALS = 1;
export const FREE_DAILY = 3;
export const PLAY_PRICE = 3;
const GUEST_KEY = 'guest_trials';
const DAY_KEY = 'free_plays';
const BOOST_KEY = 'rounds_boost';

/** Grand Rounds booster plays (24 tokens = 10 plays of that week's game, used after the day's free and bought plays). */
type Boost = { week: number; game: string; left: number };

/** Modes a guest may try. Online Multiplayer always needs sign-in. */
export const TRIAL_MODES: Mode[] = ['solo', 'offline'];

type Counted = Record<string, string[]>; // game -> play ids that counted
/** One day of a signed-in player's plays: which counted, and how many extra plays were bought. */
type Day = { date: string; plays: Counted; extra: Record<string, number> };

export type Allowance = { used: number; free: number; extra: number; left: number; boost: number };

/** The phone's own date, e.g. "2026-10-11" (also the daily prize day, DL3). */
export function localDay(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function createGate(kv: KV, today: () => string = () => localDay()) {
  const guest = async () => (await kv.get<Counted>(GUEST_KEY)) ?? {};
  const day = async (): Promise<Day> => {
    const d = await kv.get<Day>(DAY_KEY);
    const date = today();
    return d?.date === date ? d : { date, plays: {}, extra: {} };
  };
  const run = serial();
  return {
    /** Guest tries used for a game (all modes together). */
    used(game: GameKey) {
      return run(async () => ((await guest())[game] ?? []).length);
    },
    /** Guest tries still free across these games (one per game, GUEST_TRIALS each). */
    guestLeft(games: GameKey[]) {
      return run(async () => {
        const g = await guest();
        return games.reduce((n, k) => n + Math.max(0, GUEST_TRIALS - (g[k] ?? []).length), 0);
      });
    },
    /** True when a guest must sign in before setup. */
    mustSignIn(game: GameKey, mode: Mode, signedIn: boolean) {
      return run(async () => {
        if (signedIn) return false;
        if (!TRIAL_MODES.includes(mode)) return true;
        return ((await guest())[game] ?? []).length >= GUEST_TRIALS;
      });
    },
    /** Today's free and bought plays for a signed-in player. */
    allowance(game: GameKey) {
      return run(async () => {
        const d = await day();
        const used = (d.plays[game] ?? []).length;
        const extra = d.extra[game] ?? 0;
        const b = await kv.get<Boost>(BOOST_KEY);
        const boost = b && b.game === game ? b.left : 0;
        return { used, free: FREE_DAILY, extra, left: Math.max(0, FREE_DAILY + extra - used) + boost, boost } satisfies Allowance;
      });
    },
    /** One more play today, bought with an ad or tokens. */
    addPlay(game: GameKey) {
      return run(async () => {
        const d = await day();
        d.extra[game] = (d.extra[game] ?? 0) + 1;
        await kv.set(DAY_KEY, d);
      });
    },
    /** Adds bought booster plays for this week's game (a new week or game replaces the old ones). */
    addBoost(game: GameKey, week: number, plays: number) {
      return run(async () => {
        const b = await kv.get<Boost>(BOOST_KEY);
        const same = b && b.week === week && b.game === game;
        await kv.set(BOOST_KEY, { week, game, left: (same ? b.left : 0) + plays } satisfies Boost);
      });
    },
    /** Drops booster plays from an earlier week. */
    expireBoost(week: number) {
      return run(async () => {
        const b = await kv.get<Boost>(BOOST_KEY);
        if (b && b.week !== week) await kv.set(BOOST_KEY, null);
      });
    },
    /** Call at a play's first answer. Idempotent per play; `free` plays (Medicordle Daily) never count. */
    countPlay(game: GameKey, playId: string, signedIn: boolean, free = false) {
      return run(async () => {
        if (free) return;
        if (!signedIn) {
          const all = await guest();
          const list = all[game] ?? [];
          if (!list.includes(playId)) all[game] = [...list, playId];
          return kv.set(GUEST_KEY, all);
        }
        const d = await day();
        const list = d.plays[game] ?? [];
        if (list.includes(playId)) return;
        // Past the day's free and bought plays, a booster play is used (it becomes one more bought play today).
        if (list.length >= FREE_DAILY + (d.extra[game] ?? 0)) {
          const b = await kv.get<Boost>(BOOST_KEY);
          if (b && b.game === game && b.left > 0) {
            d.extra[game] = (d.extra[game] ?? 0) + 1;
            await kv.set(BOOST_KEY, { ...b, left: b.left - 1 } satisfies Boost);
          }
        }
        d.plays[game] = [...list, playId];
        await kv.set(DAY_KEY, d);
      });
    },
  };
}
