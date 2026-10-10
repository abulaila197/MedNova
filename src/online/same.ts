// `now` is the server clock, new on every answer; callers keep it as an offset, so it doesn't count as a change.
const drop = (k: string, v: unknown) => (k === 'now' ? undefined : v);

/** The previous state when the new answer has the same content, so an unchanged poll doesn't redraw the screen. */
export function keepIfSame<T>(prev: T | null, next: T): T {
  return prev != null && JSON.stringify(prev, drop) === JSON.stringify(next, drop) ? prev : next;
}
