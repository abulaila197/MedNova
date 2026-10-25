import { CONFIG } from './config';

/** A team's clock: pauses (offline, in the background), stops at the last word, capped at 3:00. */
export interface Timer {
  elapsedMs: number;
  /** null while paused or stopped. */
  runningSince: number | null;
  /** Elapsed ms when it stopped. */
  endedAtMs: number | null;
}

export const startTimer = (now: number): Timer => ({ elapsedMs: 0, runningSince: now, endedAtMs: null });

/** Elapsed ms, never more than the 3-minute cap. */
export function elapsed(t: Timer, now: number): number {
  const raw = t.endedAtMs ?? t.elapsedMs + (t.runningSince !== null ? Math.max(0, now - t.runningSince) : 0);
  return Math.min(raw, CONFIG.ROUND_MAX_MS);
}

export const isTimeUp = (t: Timer, now: number): boolean => elapsed(t, now) >= CONFIG.ROUND_MAX_MS;

export function pauseTimer(t: Timer, now: number): Timer {
  return t.runningSince === null || t.endedAtMs !== null ? t : { ...t, elapsedMs: elapsed(t, now), runningSince: null };
}

export function resumeTimer(t: Timer, now: number): Timer {
  return t.runningSince !== null || t.endedAtMs !== null ? t : { ...t, runningSince: now };
}

export function stopTimer(t: Timer, now: number): Timer {
  if (t.endedAtMs !== null) return t;
  const e = elapsed(t, now);
  return { elapsedMs: e, runningSince: null, endedAtMs: e };
}
