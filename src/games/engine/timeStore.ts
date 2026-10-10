/**
 * One clock's latest time, for useSyncExternalStore. `set` always records the time but only wakes the screen
 * when what it shows changes (`key`), so a 150 ms tick redraws once a second; a redraw for any other reason
 * (a TICK that changed the game, a tap) still reads the latest time.
 */
export function timeStore(start = Date.now()) {
  let now = start;
  let shown: unknown = undefined;
  const subs = new Set<() => void>();
  return {
    get: () => now,
    subscribe(fn: () => void) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
    /** Records `n`; wakes the screen when `key` differs from the last one it woke for. Returns whether it did. */
    set(n: number, key: unknown) {
      now = n;
      if (Object.is(key, shown)) return false;
      shown = key;
      subs.forEach((f) => f());
      return true;
    },
  };
}

/** The whole second a countdown or stopwatch shows: both change exactly when this does. */
export const second = (ms: number) => Math.floor(ms / 1000);
