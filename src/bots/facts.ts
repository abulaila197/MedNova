import dossiersJson from '@/features/learn/data/dossiers.json';

/**
 * The Genius's one text line (Yazan 2026-11-09): a short medical fact from the dossiers, after some rounds.
 * Taken from the dossier itself, cut to its first point so it fits a bubble.
 */
type Dossier = { id: string; name: string; epi: string; eti: string; cli: string; inv: string; tre: string };
const BY_ID = new Map((dossiersJson as Dossier[]).map((d) => [d.id, d]));
const BY_NAME = new Map((dossiersJson as Dossier[]).map((d) => [d.name.toLowerCase(), d]));

const FIELDS: (keyof Omit<Dossier, 'id' | 'name'>)[] = ['cli', 'inv', 'tre', 'epi', 'eti'];

/** First point of a field: up to the first semicolon, shortened at a comma if still long. */
function firstPoint(text: string) {
  let t = text.split(/;\s/)[0].trim().replace(/\.$/, '');
  if (t.length > 120) t = t.slice(0, t.lastIndexOf(',', 120) > 40 ? t.lastIndexOf(',', 120) : 117).trim() + '…';
  return t;
}

/** A fact about a disease (by dossier id or name), or null when there is no dossier. `pick` chooses the field. */
export function factFor(idOrName: string, pick: number): string | null {
  const d = BY_ID.get(idOrName) ?? BY_NAME.get(idOrName.toLowerCase());
  if (!d) return null;
  const field = FIELDS[pick % FIELDS.length];
  const t = d[field] ? firstPoint(d[field]) : '';
  // "Loud snoring..." reads on after the name in lower case; "CPAP is..." keeps its capitals.
  const lead = /^[A-Z][a-z]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
  return t ? `${d.name}: ${lead}.` : null;
}
