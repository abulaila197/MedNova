// Helpers that reproduce the prototype's CSS (easing curves and gradient angles).

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
