import { BOARD } from './config';
import { normalizeTerm } from './clueCheck';
import { shuffle } from './random';
import { otherTeam, type Card, type CardColor, type Rng, type StyleChoice, type Team, type Term } from './types';

/** Two terms clash if one contains the other (same rule the clue check uses). */
export function termsClash(a: string, b: string): boolean {
  const x = normalizeTerm(a);
  const y = normalizeTerm(b);
  return x.includes(y) || y.includes(x);
}

/**
 * Field groups (Yazan 2026-11-02): random words from 41 fields left almost no links, so a clue could rarely point
 * to two cards. Each board now holds 4 to 6 groups of words from one field (2 to 5 words each, at least three
 * groups of 3 or more, 15 to 20 words in all, different every game); the rest are single words from other fields.
 * Colours are dealt afterwards at random, so every group mixes both teams' cards: links and traps.
 */
export function groupSizes(rng: Rng): number[] {
  for (;;) {
    const n = 4 + Math.floor(rng() * 3);
    const sizes = Array.from({ length: n }, () => 2 + Math.floor(rng() * 4));
    const total = sizes.reduce((a, b) => a + b, 0);
    if (sizes.filter((x) => x >= 3).length >= 3 && total >= 15 && total <= 20) return sizes;
  }
}

/**
 * Picks 25 terms. 'mixed' = 13 of one style and 12 of the other (which one gets 13 is random).
 * No two picked terms clash, so a legal clue is always possible. Throws if the pool is too small.
 */
export function pickTerms(pool: readonly Term[], style: StyleChoice, rng: Rng, count: number = BOARD.size): Term[] {
  const chosen: Term[] = [];
  const fits = (t: Term) => !chosen.some((c) => c.id === t.id || termsClash(c.term, t.term));
  const usedFields = new Set<string>();
  /** Up to `n` words from `candidates`; returns how many were taken. */
  const take = (candidates: readonly Term[], n: number) => {
    let taken = 0;
    for (const t of shuffle(candidates, rng)) {
      if (taken === n) break;
      if (!fits(t)) continue;
      chosen.push(t);
      taken++;
    }
    return taken;
  };
  /** Fills `n` words of one style: field groups first, then single words from fields no group used. */
  const fill = (ofStyle: readonly Term[], n: number, sizes: number[]) => {
    let left = n;
    const fields = shuffle([...new Set(ofStyle.map((t) => t.field))], rng);
    for (const size of sizes) {
      const field = fields.find((f) => !usedFields.has(f) && ofStyle.filter((t) => t.field === f).length >= size);
      if (!field || size > left) continue;
      usedFields.add(field);
      left -= take(ofStyle.filter((t) => t.field === field), size);
    }
    // One single word per other field while they last, then any word.
    for (const f of fields) {
      if (left === 0) break;
      if (usedFields.has(f)) continue;
      left -= take(ofStyle.filter((t) => t.field === f), 1);
    }
    if (left > 0) left -= take(ofStyle, left);
    if (left > 0) throw new Error(`Not enough ${style} terms to fill a board (${n - left}/${n}).`);
  };

  const sizes = groupSizes(rng);
  if (style === 'mixed') {
    const bigFirst = rng() < 0.5;
    const big = Math.ceil(count / 2);
    // Biggest group first, each to the style with more room left, so every group fits.
    const room = { clinical: bigFirst ? big : count - big, basic: bigFirst ? count - big : big };
    const to: Record<'clinical' | 'basic', number[]> = { clinical: [], basic: [] };
    const left = { ...room };
    for (const size of [...sizes].sort((x, y) => y - x)) {
      const k = left.clinical >= left.basic ? 'clinical' : 'basic';
      if (size > left[k]) continue;
      to[k].push(size);
      left[k] -= size;
    }
    fill(pool.filter((t) => t.style === 'clinical'), room.clinical, to.clinical);
    fill(pool.filter((t) => t.style === 'basic'), room.basic, to.basic);
  } else {
    fill(pool.filter((t) => t.style === style), count, sizes);
  }
  return shuffle(chosen, rng);
}

/** The color of each card, for a given starting team. Starting team gets 9, the other 8. */
export function buildKey(startingTeam: Team, rng: Rng): CardColor[] {
  const colors: CardColor[] = [
    ...Array<CardColor>(BOARD.firstTeamCards).fill(startingTeam),
    ...Array<CardColor>(BOARD.secondTeamCards).fill(otherTeam(startingTeam)),
    ...Array<CardColor>(BOARD.neutralCards).fill('neutral'),
    ...Array<CardColor>(BOARD.assassinCards).fill('assassin'),
  ];
  return shuffle(colors, rng);
}

export function buildCards(terms: readonly Term[], startingTeam: Team, rng: Rng): Card[] {
  if (terms.length !== BOARD.size) throw new Error(`A board needs exactly ${BOARD.size} terms.`);
  const key = buildKey(startingTeam, rng);
  return terms.map((t, index) => ({ index, termId: t.id, term: t.term, color: key[index], revealed: false }));
}

/** One call: pick terms, choose a random starting team, build cards. */
export function newBoard(pool: readonly Term[], style: StyleChoice, rng: Rng): { cards: Card[]; startingTeam: Team } {
  const startingTeam: Team = rng() < 0.5 ? 'red' : 'blue';
  const cards = buildCards(pickTerms(pool, style, rng), startingTeam, rng);
  return { cards, startingTeam };
}

export const keyOf = (cards: readonly Card[]): CardColor[] => cards.map((c) => c.color);
export const unrevealedTerms = (cards: readonly Card[]): string[] => cards.filter((c) => !c.revealed).map((c) => c.term);
