// My question clocks in a round, as plain data driven by server timestamps. They live outside React (a keyed
// store) so they survive the page remounting mid-round (the pause page swaps the round out), and they only change
// from effects and taps, never while a page draws.

/** Which of my questions is on, when its clock started (server ms), and which I already sent. */
export type QClock = { q: number; since: number; sent: Readonly<Record<number, true>> };

/**
 * My clock when I first reach the round's questions: the first one not done (after a reload I resume there). The
 * first question's clock started with the round (`startAt`, when my notes were read); a later one starts now.
 */
export function startClock(n: number, done: (q: number) => boolean, now: number, startAt: number): QClock {
  let first = 0;
  while (first < n && done(first)) first++;
  return { q: first, since: first === 0 ? Math.min(now, startAt) : now, sent: {} };
}

/** Moves past questions that are done or sent; the next one starts `now`. The same object when nothing moved. */
export function settleClock(c: QClock, n: number, done: (q: number) => boolean, now: number): QClock {
  let q = c.q;
  while (q < n && (done(q) || c.sent[q])) q++;
  return q === c.q ? c : { ...c, q, since: now };
}

/** Sends question q at `now`: the ms it took (at most its limit), and the clock moved on to the next question. */
export function finishClock(c: QClock, q: number, limitMs: number, now: number): { clock: QClock; ms: number } {
  return { ms: Math.max(0, Math.min(limitMs, now - c.since)), clock: { q: q + 1, since: now, sent: { ...c.sent, [q]: true } } };
}

/** Seconds left on the question that is on (0 once all n are done). */
export function secondsOn(c: QClock, n: number, limitMs: number, now: number) {
  return c.q < n ? Math.max(0, (limitMs - (now - c.since)) / 1000) : 0;
}

/** Chain of Trust, my link: 0 before my turn, 1 while my clock runs, 2 once it ran out. */
export function turnPhase(now: number, turnAt: number, limitMs: number) {
  if (now < turnAt) return 0;
  return limitMs - (now - turnAt) <= 0 ? 2 : 1;
}

/** A keyed value outside React that pages read with useSyncExternalStore (values are replaced, never changed). */
export function keyedStore<V>() {
  const map = new Map<string, V>();
  const subs = new Set<() => void>();
  return {
    get: (key: string) => map.get(key),
    set(key: string, value: V) {
      if (map.get(key) === value) return;
      map.set(key, value);
      subs.forEach((f) => f());
    },
    subscribe(fn: () => void) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
  };
}
