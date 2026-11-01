import { useCallback, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { timeStore, type Clock } from '@/games/engine/timeStore';

import { call } from './api';
import { BACKUP_MS, usePushLine } from './push';
import { keepIfSame } from './same';

/** A deadline from a state: a number of ms, or a date string; null if it isn't one. */
const toMs = (x: unknown): number | null => {
  if (typeof x === 'number' && isFinite(x)) return x;
  if (typeof x === 'string') {
    const t = Date.parse(x);
    return isNaN(t) ? null : t;
  }
  return null;
};

/** Answer of a match's state call: always carries the server clock. */
type Stamped = { now: number };
/**
 * Group 10 (Yazan 2026-11-01), lighter updates: the state is asked for through poll_state, which answers with only
 * the clock ({ now, same: true }) when nothing changed since the fingerprint `h` of the last full answer. Everything
 * else stays as it was: one ask a second, the give-up timer, no asks in the background, "Reconnecting…".
 */
type Light = { now: number; same?: true; h?: string };
/** A server without poll_state yet (before its SQL is pasted): ask the state function directly, as before. */
let legacy = false;
const missingFn = (e: unknown) => {
  const x = e as { code?: string; message?: string } | null;
  return x?.code === 'PGRST202' || /poll_state/.test(x?.message ?? '');
};

const POLL_MS = 1000;
/** Race games without push (Yazan 2026-11-01): each player goes at their own pace, so every 2 s is enough. */
const RACE_POLL_MS = 2000;
const NOTICE_MS = 2200;
const POLL_GIVE_UP_MS = 3000;

/**
 * The one way an online game follows its match: polls the server's state every second (skipping a
 * poll while the previous one is still waiting, so a slow network never piles requests up), keeps
 * the previous object when nothing changed (so the screen doesn't redraw for nothing), ticks a
 * clock for countdowns and works out the server time from it. `notice` is a short message line that
 * clears itself; `quiet` games show no "Reconnecting" note. The clock redraws the screen on every tick only
 * when `shown` is left out; with it, only when what it returns (e.g. the whole seconds left) changes.
 * `clock` (in server time) lets one small widget follow every tick with useClock while the screen does not;
 * `serverNow()` reads the server time at the moment it is called (e.g. a tap).
 */
export function useMatchState<T extends Stamped>(
  rpc: string,
  matchId: string,
  opts: { tickMs?: number; quiet?: boolean; race?: boolean; shown?: (server: number, st: T | null) => unknown } = {},
) {
  const { tickMs = 250, quiet = false, race = false } = opts;
  const [st, setSt] = useState<T | null>(null);
  const [clock] = useState(timeStore);
  // The clock keeps server time (the phone's time plus the offset read from the last answer).
  const server = useSyncExternalStore(clock.subscribe, clock.get, clock.get);
  const [notice, setNotice] = useState<string | null>(null);
  const offset = useRef(0);
  const busy = useRef(false);
  // Fingerprint of the last full state this screen holds; null until the first one (or after a failed ask).
  const seen = useRef<string | null>(null);

  const ask = useCallback(async (): Promise<(T & Light) | null> => {
    if (!legacy) {
      try {
        return await call<T & Light>('poll_state', { fn: rpc, m: matchId, seen: seen.current });
      } catch (e) {
        if (!missingFn(e)) throw e;
        legacy = true;
      }
    }
    return await call<T>(rpc, { m: matchId });
  }, [rpc, matchId]);

  const load = useCallback(async () => {
    try {
      const s = await ask();
      if (!s) throw new Error('no state');
      offset.current = s.now - Date.now();
      clock.put(Date.now() + offset.current);
      if (s.same) return; // nothing changed: the screen keeps the state it has
      seen.current = s.h ?? null;
      const { h: _h, ...full } = s;
      setSt((prev) => keepIfSame(prev, full as unknown as T));
    } catch {
      seen.current = null; // the next answer is a full one
      if (!quiet) setNotice('Reconnecting…');
    }
  }, [ask, quiet, clock]);

  // One ask at a time. A push signal that lands while an ask is out is not lost: one more ask follows it.
  const again = useRef(false);
  const poll = useCallback(() => {
    const go = () => {
      if (AppState.currentState !== 'active') return;
      if (busy.current) {
        again.current = true;
        return;
      }
      busy.current = true;
      // #17: a request that never answers (a phone switching networks) used to hold `busy` for good, so the
      // screen stopped following the match and froze. After POLL_GIVE_UP_MS the next poll goes out anyway.
      const id = setTimeout(() => (busy.current = false), POLL_GIVE_UP_MS);
      load().finally(() => {
        clearTimeout(id);
        busy.current = false;
        if (again.current) {
          again.current = false;
          go();
        }
      });
    };
    go();
  }, [load]);

  // Push (Yazan 2026-11-01): with the match's push line open, ask when the server signals a change, at each deadline
  // (a phase ending, a referee step due) and as a slow backup; without it, ask every second (2 s in race games).
  const pushed = usePushLine(matchId ? `match:${matchId}` : null, poll);
  const every = pushed ? BACKUP_MS : race ? RACE_POLL_MS : POLL_MS;
  const deadlineDone = useRef(0);

  const tick = useEffectEvent((n: number) => {
    const sv = n + offset.current;
    clock.set(sv, opts.shown ? opts.shown(sv, st) : sv);
    if (pushed && st) {
      // Phases end on the server clock; the first ask after the end moves the match on and signals everyone.
      const o = st as unknown as { phase_ends_at?: unknown; due?: unknown };
      const ends = [o.phase_ends_at, o.due].map(toMs).filter((x): x is number => x != null && x > deadlineDone.current);
      const next = ends.length ? Math.min(...ends) : null;
      if (next != null && sv >= next + 250) {
        deadlineDone.current = next;
        poll();
      }
    }
  });

  useEffect(() => {
    // In the background no polls and no clock ticks (the seat is kept by live.tsx's room_ping); one poll on return (AP9).
    poll();
    const p = setInterval(() => poll(), every);
    const t = setInterval(() => AppState.currentState === 'active' && tick(Date.now()), tickMs);
    const back = AppState.addEventListener('change', (a) => a === 'active' && poll());
    return () => {
      clearInterval(p);
      clearInterval(t);
      back.remove();
    };
  }, [poll, tickMs, every]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(id);
  }, [notice]);

  /** The server time right now (not the last tick's): for timing a tap. Call it from handlers and effects only. */
  const serverNow = useCallback(() => Date.now() + offset.current, []);

  return { st, load, server, clock: clock as Clock, serverNow, notice, setNotice };
}
