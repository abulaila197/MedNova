/** Lowercase, letters a-z only (spaces, hyphens, dots and digits removed). */
export const lettersOnly = (s: string): string => s.toLowerCase().replace(/[^a-z]/g, '');

/** Lowercase letters with one trailing "s" removed (design: plurals count as the same word). */
export const stem = (s: string): string => {
  const t = lettersOnly(s);
  return t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t;
};

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Same word, or the same word with a final "s" added or removed (design: plurals count as the same word). */
export const sameWord = (a: string, b: string): boolean => {
  const x = lettersOnly(a);
  const y = lettersOnly(b);
  return x === y || x + 's' === y || x === y + 's';
};
