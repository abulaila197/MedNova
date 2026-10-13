import WORDS from './badwords.json';

/** Look-alike digits folded to letters before matching (0 for o, 1 for i, ...). Same map as public.name_is_clean. */
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't' };

/**
 * English bad-word check for usernames and display names (Yazan 2026-10-13, English only).
 * "anywhere" words are blocked inside a name; "whole" words only as their own part between _ (so Assem, Dickens, class pass).
 * The server runs the same list in public.name_is_clean, so a skipped app check still fails.
 */
export function nameIsClean(name: string): boolean {
  const folded = name.toLowerCase().replace(/[013457]/g, (d) => LEET[d]);
  const joined = folded.replace(/_/g, '');
  if (WORDS.anywhere.some((w) => joined.includes(w))) return false;
  const parts = folded.split(/_+/);
  return !parts.some((p) => WORDS.whole.includes(p));
}
