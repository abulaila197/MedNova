// Tilt & Tell (Yazan 2026-11-12): reads the phone's accelerometer while it is held sideways on a forehead.
// Pure: no React Native, so node tests run it.
//
// Readings are in g, as expo-sensors gives them on both platforms: a phone lying face up on a table reads z = -1,
// face down z = +1. On a forehead the phone stands upright, so gravity runs along the screen and z is near 0.
// Nodding forward turns the screen to the floor (z goes up): that is CORRECT. Tipping the head back turns the
// screen to the ceiling (z goes down): that is PASS (TT1, Yazan's card).

export type Reading = { x: number; y: number; z: number };
export type Tilt = 'down' | 'up';

/** How far z must go for a tilt, and how close to upright it must come back before the next one counts. */
export const TILT_ON = 0.7;
export const TILT_OFF = 0.35;
/** A tilt right after another (a wobble) is ignored. */
export const TILT_GAP_MS = 450;
/** Upright on a forehead: little z, nearly all of gravity along the screen. */
export const UPRIGHT_Z = 0.4;
export const UPRIGHT_G = 0.75;
/** Held upright this long before the 3-2-1 starts. */
export const HOLD_MS = 700;

/** Flip this if a phone ever reports z the other way round (one place to change). */
export const Z_SIGN = 1;

export type TiltState = { armed: boolean; last: number };
export const freshTilt = (): TiltState => ({ armed: true, last: -Infinity });

/** One reading in: the new state and, when a tilt just happened, which way. */
export function stepTilt(st: TiltState, r: Reading, now: number): { st: TiltState; tilt: Tilt | null } {
  const z = r.z * Z_SIGN;
  if (!st.armed) return { st: Math.abs(z) < TILT_OFF ? { ...st, armed: true } : st, tilt: null };
  if (now - st.last < TILT_GAP_MS) return { st, tilt: null };
  if (z > TILT_ON) return { st: { armed: false, last: now }, tilt: 'down' };
  if (z < -TILT_ON) return { st: { armed: false, last: now }, tilt: 'up' };
  return { st, tilt: null };
}

/** The phone stands upright (as on a forehead, screen facing out). */
export function upright(r: Reading) {
  return Math.abs(r.z * Z_SIGN) < UPRIGHT_Z && Math.hypot(r.x, r.y) > UPRIGHT_G;
}

/** Forehead check (TT turn start): counts how long the phone has stayed upright. Returns the new start time. */
export function stepHold(since: number | null, r: Reading, now: number): number | null {
  if (!upright(r)) return null;
  return since ?? now;
}
export const held = (since: number | null, now: number) => since != null && now - since >= HOLD_MS;
