// Answer names shared by every game's master list (NL1):
// a main name plus at most 2 other names, shown as "Main name (other 1, other 2)".
// Only those 3 names are accepted, and a missing 's or plural s doesn't make a different name.

export type Named = { label: string; aliases?: readonly string[] };

export const MAX_OTHER_NAMES = 2;

/** "Myocardial infarction (MI, Heart attack)". */
export function fullName(n: Named) {
  const alt = (n.aliases ?? []).slice(0, MAX_OTHER_NAMES);
  return alt.length ? `${n.label} (${alt.join(', ')})` : n.label;
}

/** Lower case, no accents or punctuation, and each word without a final 's or s: "Crohn's" = "Crohns" = "Crohn". */
export function nameKey(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]s\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
    .join(' ');
}

/** The keys a typed answer is matched against: the main name and its 2 other names. */
export const nameKeys = (n: Named) => [n.label, ...(n.aliases ?? []).slice(0, MAX_OTHER_NAMES)].map(nameKey);

export type NameIndex<T extends Named> = { entry: T; main: string; keys: string[] }[];

export const indexNames = <T extends Named>(list: readonly T[]): NameIndex<T> => list.map((entry) => ({ entry, main: nameKey(entry.label), keys: nameKeys(entry) }));

/**
 * Type-ahead over a master list: nothing until `min` letters, then up to `max` matches.
 * Order: main name starts with it, another name starts with it, a word starts with it, then all words found.
 */
export function searchNames<T extends Named>(index: NameIndex<T>, raw: string, opts: { min: number; max: number; skip?: (e: T) => boolean }): T[] {
  const q = nameKey(raw);
  if (q.replace(/\s/g, '').length < opts.min) return [];
  const tokens = q.split(' ');
  const hits: { e: NameIndex<T>[number]; s: number }[] = [];
  for (const e of index) {
    if (opts.skip?.(e.entry)) continue;
    const s = e.main.startsWith(q)
      ? 0
      : e.keys.some((k) => k.startsWith(q))
        ? 1
        : e.keys.some((k) => (' ' + k).includes(' ' + q))
          ? 2
          : e.keys.some((k) => tokens.every((t) => k.includes(t)))
            ? 3
            : -1;
    if (s >= 0) hits.push({ e, s });
  }
  hits.sort((a, b) => a.s - b.s || a.e.main.length - b.e.main.length || a.e.main.localeCompare(b.e.main));
  return hits.slice(0, opts.max).map((h) => h.e.entry);
}
