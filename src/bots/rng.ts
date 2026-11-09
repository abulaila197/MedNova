/** Small seeded randomness, so the same name, match and question always give the same choices. */

/** A 32-bit hash of a string (FNV-1a). */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A random number source (mulberry32): each call gives the next number in [0, 1). */
export function rng(seed: number | string) {
  let a = typeof seed === 'string' ? hash(seed) : seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rand = ReturnType<typeof rng>;
export const between = (r: Rand, a: number, b: number) => a + r() * (b - a);
export const pickOf = <T,>(r: Rand, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
