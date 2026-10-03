// Guest trial gate (rules 19-20, revised 2026-10-03): 3 free plays per game, shared by Solo and
// Offline Multiplayer together, then sign-in before setup. A play counts once its first case is answered.
import { serial, type KV } from './storage';
import type { GameKey, Mode } from './types';

export const GUEST_TRIALS = 3;
const KEY = 'guest_trials';

type Counted = Record<string, string[]>; // game -> play ids that counted

/** Modes that draw on the shared free plays. Online Multiplayer always needs sign-in (no free plays). */
export const TRIAL_MODES: Mode[] = ['solo', 'offline'];

export function createGate(kv: KV) {
  const load = async () => (await kv.get<Counted>(KEY)) ?? {};
  const k = (g: GameKey, _m?: Mode) => g;
  const run = serial();
  return {
    used(game: GameKey, mode: Mode) {
      return run(async () => {
        return ((await load())[k(game, mode)] ?? []).length;
      });
    },
    /** True when a guest must sign in before setup. */
    mustSignIn(game: GameKey, mode: Mode, signedIn: boolean) {
      return run(async () => {
        if (signedIn) return false;
        if (!TRIAL_MODES.includes(mode)) return true;
        return ((await load())[k(game, mode)] ?? []).length >= GUEST_TRIALS;
      });
    },
    /** Call when the first case of a guest play is answered. Idempotent per play. */
    countPlay(game: GameKey, mode: Mode, playId: string) {
      return run(async () => {
        const all = await load();
        const list = all[k(game, mode)] ?? [];
        if (!list.includes(playId)) all[k(game, mode)] = [...list, playId];
        await kv.set(KEY, all);
      });
    },
  };
}
