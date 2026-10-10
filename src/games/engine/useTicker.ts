import { useEffect, useEffectEvent, useState, useSyncExternalStore } from 'react';

import { second, timeStore } from './timeStore';

type Opts = {
  /** Redraw on every tick: for clocks drawn smoothly (a fuse, a ring, bulbs). */
  fine?: boolean;
  /** What the screen shows of the time; it redraws only when this changes. Default: the whole wall-clock second. */
  shown?: (now: number) => unknown;
};

/**
 * A game's clock tick: while `active`, every `ms` it hands the time to `onTick` (usually the game's TICK event,
 * which ends a turn when its time is up). Returns the time to draw clocks from; the screen redraws only when
 * `shown` changes (or on every tick with `fine`), or when `onTick` changed the game.
 */
export function useTicker(active: boolean, ms: number, onTick?: (now: number) => void, opts: Opts = {}) {
  const [store] = useState(timeStore);
  const now = useSyncExternalStore(store.subscribe, store.get, store.get);
  const tick = useEffectEvent((n: number) => {
    onTick?.(n);
    store.set(n, opts.fine ? n : opts.shown ? opts.shown(n) : second(n));
  });
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => tick(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

export { second } from './timeStore';
