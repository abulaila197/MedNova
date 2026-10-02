// Timing helpers that reproduce the prototype's CSS animations frame by frame.

/** CSS cubic-bezier(x1, y1, x2, y2) as an easing function. */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const c = (s: number, p1: number, p2: number) => 3 * (1 - s) * (1 - s) * s * p1 + 3 * (1 - s) * s * s * p2 + s * s * s;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let s = t;
    for (let k = 0; k < 28; k++) {
      const x = c(s, x1, x2);
      if (Math.abs(x - t) < 1e-5) break;
      if (x < t) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return c(s, y1, y2);
  };
}

export type Ease = (t: number) => number;
export const EASE = bezier(0.25, 0.1, 0.25, 1);
export const EASE_OUT = bezier(0, 0, 0.58, 1);
export const EASE_IN_OUT = bezier(0.42, 0, 0.58, 1);

/**
 * A CSS keyframe track. `stops` are [progress 0..1, value]; the easing applies to
 * each segment, as CSS animation-timing-function does.
 */
export function track(p: number, stops: [number, number][], ease: Ease = EASE) {
  if (p <= stops[0][0]) return stops[0][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, va] = stops[i];
    const [b, vb] = stops[i + 1];
    if (p < b) return va + (vb - va) * ease((p - a) / (b - a));
  }
  return stops[stops.length - 1][1];
}

/** Progress of an animation that starts at `delay` seconds and lasts `dur` seconds (clamped 0..1). */
export const prog = (t: number, delay: number, dur: number) => Math.min(1, Math.max(0, (t - delay) / dur));

/** start/end points for expo-linear-gradient that match a CSS linear-gradient angle on a w x h box. */
export function cssAngle(deg: number, w: number, h: number) {
  const r = (deg * Math.PI) / 180;
  const dx = Math.sin(r);
  const dy = -Math.cos(r);
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  const sx = w / 2 - (dx * len) / 2;
  const sy = h / 2 - (dy * len) / 2;
  const ex = w / 2 + (dx * len) / 2;
  const ey = h / 2 + (dy * len) / 2;
  return { start: { x: sx / w, y: sy / h }, end: { x: ex / w, y: ey / h } };
}
