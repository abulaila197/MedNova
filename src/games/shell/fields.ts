// Field ticks in setup (Yazan 2026-11-11): under Clinical / Basic science / Mixed (DP: under each difficulty) a menu
// lists the fields with their question counts; "All" is ticked at first. The ticked fields travel in the play's
// settings as `fields`, one string joined by FIELD_SEP (no key = every field). Pure: runs in node tests.

export const FIELD_SEP = '|';

export type FieldItem = { key: string; label: string; count: number };
export type FieldGroup = { title?: string; items: FieldItem[] };
/** What a choice's menu shows, and how many questions (or cases) a set of ticks leaves. */
export type FieldMenu = {
  groups: FieldGroup[];
  /** Questions left with these ticks (null = all). Cases with two fields count once. */
  total: (ticked: string[] | null) => number;
  /** The fewest a game may start with. */
  min: number;
  /** "questions" or "cases". */
  unit: string;
};

/** The ticked fields in settings: null = every field (no ticks taken off). */
export function tickedFields(settings: Record<string, unknown> | undefined): string[] | null {
  const f = settings?.fields;
  if (typeof f !== 'string') return null;
  return f === '' ? [] : f.split(FIELD_SEP);
}

export const allKeys = (m: FieldMenu) => m.groups.flatMap((g) => g.items.map((i) => i.key));

/** Settings value for these ticks: undefined when every field is ticked. */
export function fieldsValue(m: FieldMenu, ticked: string[]): string | undefined {
  const all = allKeys(m);
  return all.every((k) => ticked.includes(k)) ? undefined : all.filter((k) => ticked.includes(k)).join(FIELD_SEP);
}

/** Tap on "All": all on, or (when all are on) all off. */
export function toggleAll(m: FieldMenu, ticked: string[] | null): string[] {
  return ticked == null || allKeys(m).every((k) => ticked.includes(k)) ? [] : allKeys(m);
}

/** Tap on one field: it goes off (and so does All), or back on. */
export function toggleField(m: FieldMenu, ticked: string[] | null, key: string): string[] {
  const cur = ticked ?? allKeys(m);
  return cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
}

/** Keeps the items whose field (or one of whose fields) is ticked; null ticks keep everything. */
export function inFields<T>(items: readonly T[], fieldOf: (x: T) => string | readonly string[], ticked: string[] | null): T[] {
  if (ticked == null) return [...items];
  const on = new Set(ticked);
  return items.filter((x) => {
    const f = fieldOf(x);
    return typeof f === 'string' ? on.has(f) : f.some((k) => on.has(k));
  });
}

/** Groups of fields with counts, from the items themselves (largest first inside each group). */
export function groupsOf<T>(items: readonly T[], fieldOf: (x: T) => string, groupOf: (x: T) => string | undefined, label: (f: string) => string = (f) => f, order?: string[]): FieldGroup[] {
  const by = new Map<string, Map<string, number>>();
  for (const x of items) {
    const g = groupOf(x) ?? '';
    const f = fieldOf(x);
    const m = by.get(g) ?? new Map<string, number>();
    m.set(f, (m.get(f) ?? 0) + 1);
    by.set(g, m);
  }
  const keys = order ? order.filter((g) => by.has(g)) : [...by.keys()];
  return keys.map((g) => ({
    title: g || undefined,
    items: [...by.get(g)!].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key, count]) => ({ key, label: label(key), count })),
  }));
}
