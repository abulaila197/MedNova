import { CONFIG } from './config';
import { strip } from './clues';
import type { BankChoice, Rng, Term, TermId } from './types';

const norm = (s: string) => strip(s).replace(/\s+/g, ' ').trim();

/**
 * Autocomplete for the guesser: suggestions appear after 3 typed letters, over the whole term
 * list, exact names only. Ranking: name starts with the query, then a word starts with it, then
 * the name contains it.
 */
export function searchTerms(terms: readonly Term[], query: string, limit = 8): Term[] {
  const q = norm(query);
  if (q.length < CONFIG.MIN_AUTOCOMPLETE_CHARS) return [];
  const ranked: { t: Term; rank: number }[] = [];
  for (const t of terms) {
    const name = norm(t.name);
    let rank = -1;
    if (name.startsWith(q)) rank = 0;
    else if (name.split(' ').some((w) => w.startsWith(q))) rank = 1;
    else if (name.includes(q)) rank = 2;
    if (rank >= 0) ranked.push({ t, rank });
  }
  ranked.sort((a, b) => a.rank - b.rank || a.t.name.localeCompare(b.t.name));
  return ranked.slice(0, limit).map((r) => r.t);
}

export const findTerm = (terms: readonly Term[], id: TermId): Term | undefined => terms.find((t) => t.id === id);

/** Terms of the chosen bank (Mixed = all). */
export const termsOfBank = (terms: readonly Term[], bank: BankChoice): Term[] =>
  bank === 'mixed' ? terms.slice() : terms.filter((t) => t.bank === bank);

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
