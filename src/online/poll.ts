// Helpers for the online games' polling, so a slow network doesn't pile requests up and an
// unchanged answer doesn't redraw the whole game screen every second.

/** Wraps an async poll so a new run is skipped while the previous one is still waiting. */
export function oneAtATime(fn: () => Promise<unknown>) {
  let busy = false;
  return () => {
    if (busy) return;
    busy = true;
    fn().finally(() => (busy = false));
  };
}

// `now` is the server clock, new on every answer; it is read separately (offset), so it doesn't count as a change.
const drop = (k: string, v: unknown) => (k === 'now' ? undefined : v);

/** Keeps the previous state object when the new one has the same content (besides the server clock). */
export function keepSame<T>(prev: T | null, next: T): T {
  if (prev != null && JSON.stringify(prev, drop) === JSON.stringify(next, drop)) return prev;
  return next;
}
