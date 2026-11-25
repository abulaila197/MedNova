// In-app rating prompt (Yazan 2026-11-25): after a good game, the store's own rating sheet. Only after 3 good games, at
// most once every 4 months (the stores cap it at 3 a year anyway), and only on the results page, never in a game.
import * as StoreReview from 'expo-store-review';

import { engine } from '@/games/engine';
import type { Play, PlayItem, Standing } from '@/games/engine/types';

const GOOD = 'rate:good';
const LAST = 'rate:last';
const WAIT = 120 * 24 * 3600 * 1000;

/** A good game: first place vs rivals, or a Solo game with 70%+ answered right. Pass the phone never counts. */
export function goodGame(play: Play, items: PlayItem[], standings?: Standing[]): boolean {
  if (play.mode === 'bots') return standings?.find((x) => x.seat === 0)?.rank === 1;
  if (play.mode !== 'solo') return false;
  const asked = items.filter((i) => i.outcome !== 'skipped');
  return asked.length >= 3 && asked.filter((i) => i.outcome === 'right').length / asked.length >= 0.7;
}

let busy = false;
/** Counts a good game and, when it is time, shows the rating sheet once the results page has settled. */
export function rateAfterGoodGame(): void {
  if (busy) return;
  busy = true;
  void (async () => {
    try {
      const n = ((await engine.kv.get<number>(GOOD)) ?? 0) + 1;
      await engine.kv.set(GOOD, n);
      const last = (await engine.kv.get<number>(LAST)) ?? 0;
      if (n < 3 || Date.now() - last < WAIT) return;
      if (!(await StoreReview.isAvailableAsync())) return;
      await new Promise((r) => setTimeout(r, 2500));
      await engine.kv.set(LAST, Date.now());
      await StoreReview.requestReview();
    } catch {
      // no sheet this time
    } finally {
      busy = false;
    }
  })();
}
