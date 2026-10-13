import { useCallback, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';

import { timeStore, type Clock } from '@/games/engine/timeStore';

import { call } from './api';
import { keepIfSame } from './same';

/** Answer of a match's state call: always carries the server clock. */
type Stamped = { now: number };

const POLL_MS = 1000;
const NOTICE_MS = 2200;

/**
 * The one way an online game follows its match: polls the server's state every second (skipping a
 * poll while the previous one is still waiting, so a slow network never piles requests up), keeps
 * the previous object when nothing changed (so the screen doesn't redraw for nothing), ticks a
 * clock for countdowns and works out the server time from it. `notice` is a short message line that
 * clears itself; `quiet` games show no "Reconnecting" note. The clock redraws the screen on every tick only
 * when `shown` is left out; with it, only when what it returns (e.g. the whole seconds left) changes.
 * `clock` (in server time) lets one small widget follow every tick with useClock while the screen does not.
 */
export function useMatchState<T extends Stamped>(
  rpc: string,
  matchId: string,
  opts: { tickMs?: number; quiet?: boolean; shown?: (server: number, st: T | null) => unknown } = {},
) {
  const { tickMs = 250, quiet = false } = opts;
  const [st, setSt] = useState<T | null>(null);
  const [clock] = useState(timeStore);
  // The clock keeps server time (the phone's time plus the offset read from the last answer).
  const server = useSyncExternalStore(clock.subscribe, clock.get, clock.get);
  const [notice, setNotice] = useState<string | null>(null);
  const offset = useRef(0);
  const busy = useRef(false);

  const load = useCallback(async () => {
    try {
      const s = await call<T>(rpc, { m: matchId });
      offset.current = s.now - Date.now();
      clock.put(Date.now() + offset.current);
      setSt((prev) => keepIfSame(prev, s));
    } catch {
      if (!quiet) setNotice('Reconnecting…');
    }
  }, [rpc, matchId, quiet, clock]);

  const tick = useEffectEvent((n: number) => {
    const sv = n + offset.current;
    clock.set(sv, opts.shown ? opts.shown(sv, st) : sv);
  });

  useEffect(() => {
    const poll = () => {
      if (busy.current) return;
      busy.current = true;
      load().finally(() => (busy.current = false));
    };
    poll();
    const p = setInterval(poll, POLL_MS);
    const t = setInterval(() => tick(Date.now()), tickMs);
    return () => {
      clearInterval(p);
      clearInterval(t);
    };
  }, [load, tickMs]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(id);
  }, [notice]);

  return { st, load, server, clock: clock as Clock, notice, setNotice };
}
