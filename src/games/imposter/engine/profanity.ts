import { lettersOnly, stem } from './text';

export interface ProfanityChecker {
  isProfane(text: string): boolean;
}

/** "fuuuck" -> "fuck" / "fuuck": runs of 3+ identical letters are collapsed to 1 or 2. */
const collapse = (t: string, keep: 1 | 2): string => t.replace(/([a-z])\1{2,}/g, (_m, c: string) => c.repeat(keep));
const variants = (t: string): string[] => Array.from(new Set([t, collapse(t, 1), collapse(t, 2)]));

/**
 * Whole-word profanity check (never matches inside longer words).
 * - a final "s" is ignored
 * - stretched spellings (repeated letters) are caught
 * - the allowlist (medical words) always wins over the blocklist
 *
 * The blocklist is NOT included: you supply it (a package or your own file).
 */
export function createProfanityChecker(opts: {
  blocklist: readonly string[];
  allowlist?: readonly string[];
}): ProfanityChecker {
  const block = new Set(opts.blocklist.map(lettersOnly).filter(Boolean));
  const allow = new Set((opts.allowlist ?? []).map(lettersOnly).filter(Boolean));

  const tokenIsProfane = (tok: string): boolean => {
    if (allow.has(tok) || allow.has(stem(tok))) return false;
    return variants(tok).some((v) => block.has(v) || block.has(stem(v)));
  };

  return {
    isProfane(text: string): boolean {
      const tokens = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
      return tokens.some(tokenIsProfane);
    },
  };
}
