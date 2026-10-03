// Rule 15: unseen first. Draw only unseen cases until the bank runs out, then reshuffle.
import { serial, type KV } from './storage';
import type { GameKey } from './types';

export function createPicker(kv: KV, rand: () => number = Math.random) {
  const key = (g: GameKey) => `seen:${g}`;
  const run = serial();
  return {
    /** Picks `count` distinct ids from `pool` (already filtered, e.g. by difficulty), unseen ones first. */
    pick(game: GameKey, pool: string[], count: number) {
      return run(async () => {
      const seen = new Set((await kv.get<string[]>(key(game))) ?? []);
      let fresh = pool.filter((id) => !seen.has(id));
      const out: string[] = [];
      const take = (from: string[]) => {
        const a = [...from];
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        for (const id of a) if (out.length < count && !out.includes(id)) out.push(id);
      };
      take(fresh);
      if (out.length < count) {
        // bank exhausted: reshuffle this pool and continue
        for (const id of pool) seen.delete(id);
        await kv.set(key(game), [...seen]);
        fresh = pool.filter((id) => !out.includes(id));
        take(fresh);
      }
      return out;
      });
    },
    markSeen(game: GameKey, id: string) {
      return run(async () => {
        const seen = (await kv.get<string[]>(key(game))) ?? [];
        if (!seen.includes(id)) await kv.set(key(game), [...seen, id]);
      });
    },
  };
}
