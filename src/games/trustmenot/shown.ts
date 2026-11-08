// What the online screen itself reads from the clock, kept apart so it can be tested without a phone.
import type { TmnEnvelope } from './online';

export type TState = { now: number; phase: 'countdown' | 'case' | 'done'; due: number | null; state: TmnEnvelope | null };

/** Month 12's Gap opens with 30 silent seconds for the Last Supper. */
export const SUPPER_MS = 30000;

/** Whether this phone nudges the referee now: its clock ran out (seats take turns), or the year has not started. */
export function nudgeDue(st: TState, server: number, me: string) {
  if (st.phase === 'done') return false;
  const seat = Math.max(0, st.state?.view.players.findIndex((x) => x.id === me) ?? 0);
  return st.state ? st.due != null && server >= st.due + seat * 1500 : st.phase === 'case' || st.phase === 'countdown';
}

/**
 * What this screen itself draws or decides from the clock: whether to nudge (then every tick, so the nudge keeps
 * retrying) and whether the Last Supper is still open. The pages' own countdowns and rings follow the clock by themselves.
 */
export function tmnShown(server: number, st: TState | null, me: string): unknown {
  if (!st) return 0;
  if (nudgeDue(st, server, me)) return server;
  return !!st.state && server < st.state.started + SUPPER_MS;
}

