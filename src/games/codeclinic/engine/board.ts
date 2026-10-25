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
 * Picks 25 terms. 'mixed' = 13 of one style and 12 of the other (which one gets 13 is random).
 * No two picked terms clash, so a legal clue is always possible. Throws if the pool is too small.
 */
export function pickTerms(pool: readonly Term[], style: StyleChoice, rng: Rng, count: number = BOARD.size): Term[] {
  const chosen: Term[] = [];
  const take = (candidates: Term[], n: number) => {
    let taken = 0;
    for (const t of shuffle(candidates, rng)) {
      if (taken === n) break;
      if (chosen.some((c) => c.id === t.id || termsClash(c.term, t.term))) continue;
      chosen.push(t);
      taken++;
    }
    if (taken < n) throw new Error(`Not enough ${style} terms to fill a board (${taken}/${n}).`);
  };

  if (style === 'mixed') {
    const bigFirst = rng() < 0.5;
    const big = Math.ceil(count / 2);
    take(pool.filter((t) => t.style === 'clinical'), bigFirst ? big : count - big);
    take(pool.filter((t) => t.style === 'basic'), bigFirst ? count - big : big);
  } else {
    take(pool.filter((t) => t.style === style), count);
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
