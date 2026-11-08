/** A fresh shuffled copy (Fisher-Yates). Pass a seeded `rng` where every phone or the referee must get the same order. */
export function shuffle<T>(xs: readonly T[], rng: () => number = Math.random): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
