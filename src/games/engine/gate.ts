// Who may start a play. Guests: 5 plays in total, ever, across all games, in Solo or Pass the phone (#83; Online
// needs an account). Signed in, plays cost Sparks (sparks.ts) instead of the old 3 free plays a day (#82).
// A play counts at its first answer (TR2, #52).
import { serial, type KV } from './storage';
import type { GameKey, Mode } from './types';

export const GUEST_PLAYS = 5;
const GUEST_KEY = 'guest_trials';

/** Modes a guest may try. Online Multiplayer always needs sign-in. */
export const TRIAL_MODES: Mode[] = ['solo', 'offline'];

type Counted = Record<string, string[]>; // game -> guest play ids that counted

/** The phone's own date, e.g. "2026-10-11" (also the daily prize day, DL3). */
export function localDay(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function createGate(kv: KV) {
  const guest = async () => (await kv.get<Counted>(GUEST_KEY)) ?? {};
  const total = (g: Counted) => Object.values(g).reduce((n, l) => n + l.length, 0);
  const run = serial();
  return {
    /** Guest plays still free, across every game. */
    guestLeft() {
      return run(async () => Math.max(0, GUEST_PLAYS - total(await guest())));
    },
    /** True when a guest must sign in before setup. */
    mustSignIn(mode: Mode, signedIn: boolean) {
      return run(async () => {
        if (signedIn) return false;
        if (!TRIAL_MODES.includes(mode)) return true;
        return total(await guest()) >= GUEST_PLAYS;
      });
    },
    /** A guest play counts once, at its first answer. */
    countGuest(game: GameKey, playId: string) {
      return run(async () => {
        const all = await guest();
        const list = all[game] ?? [];
        if (list.includes(playId)) return;
        all[game] = [...list, playId];
        await kv.set(GUEST_KEY, all);
      });
    },
  };
}
