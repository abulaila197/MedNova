/** A clock a small widget can follow on every tick (a smooth ring, a fuse, bulbs) without redrawing the whole screen. */
export type Clock = { get: () => number; watch: (fn: () => void) => () => void };

/**
 * One clock's latest time, for useSyncExternalStore. `set` always records the time but only wakes the screen
 * (`subscribe`) when what it shows changes (`key`), so a 150 ms tick redraws once a second; a redraw for any other
 * reason (a TICK that changed the game, a tap) still reads the latest time. `watch` wakes on every tick, for the
 * one small clock widget that draws smoothly.
 */
export function timeStore(start = Date.now()) {
  let now = start;
  let shown: unknown = undefined;
  const subs = new Set<() => void>();
  const fine = new Set<() => void>();
  const add = (set: Set<() => void>) => (fn: () => void) => {
    set.add(fn);
    return () => {
      set.delete(fn);
    };
  };
  return {
    get: () => now,
    subscribe: add(subs),
    watch: add(fine),
    /** Records `n` without waking anyone (e.g. a new server offset read just before a redraw). */
    put(n: number) {
      now = n;
    },
    /** Records `n`; wakes the screen when `key` differs from the last one it woke for. Returns whether it did. */
    set(n: number, key: unknown) {
      now = n;
      fine.forEach((f) => f());
      if (Object.is(key, shown)) return false;
      shown = key;
      subs.forEach((f) => f());
      return true;
    },
  };
}

/** The whole second a countdown or stopwatch shows: both change exactly when this does. */
export const second = (ms: number) => Math.floor(ms / 1000);
