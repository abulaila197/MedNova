import { describe, expect, it } from './jestish';
import { buildCards, buildKey, newBoard, pickTerms, termsClash } from '../engine/board';
import { seededRng } from '../engine/random';
import type { Term } from '../engine/types';
import { TERMS } from './helpers';

const count = (cs: { color: string }[], c: string) => cs.filter((x) => x.color === c).length;

describe('board', () => {
  it('key has 9/8/7/1 with the starting team getting 9', () => {
    for (const team of ['red', 'blue'] as const) {
      const key = buildKey(team, seededRng(3));
      expect(key).toHaveLength(25);
      expect(count(key.map((color) => ({ color })), team)).toBe(9);
      expect(count(key.map((color) => ({ color })), team === 'red' ? 'blue' : 'red')).toBe(8);
      expect(count(key.map((color) => ({ color })), 'neutral')).toBe(7);
      expect(count(key.map((color) => ({ color })), 'assassin')).toBe(1);
    }
  });
  it('buildCards needs exactly 25 terms', () => {
    expect(() => buildCards(TERMS.slice(0, 24), 'red', seededRng(1))).toThrow();
  });
  it('pickTerms: single style stays in style, mixed is 13/12, no repeats', () => {
    const clin = pickTerms(TERMS, 'clinical', seededRng(5));
    expect(clin).toHaveLength(25);
    expect(clin.every((t) => t.style === 'clinical')).toBe(true);
    const mixed = pickTerms(TERMS, 'mixed', seededRng(6));
    const nClin = mixed.filter((t) => t.style === 'clinical').length;
    expect([12, 13]).toContain(nClin);
    expect(new Set(mixed.map((t) => t.id)).size).toBe(25);
  });
  it('pickTerms never puts clashing terms on one board', () => {
    const pool: Term[] = [
      ...TERMS.filter((t) => t.style === 'clinical'),
      { id: 900, style: 'clinical', field: 'F', term: 'Cardio' },
      { id: 901, style: 'clinical', field: 'F', term: 'Cardiomyopathy' },
    ];
    for (let seed = 1; seed < 30; seed++) {
      const picked = pickTerms(pool, 'clinical', seededRng(seed));
      for (let i = 0; i < picked.length; i++) {
        for (let j = i + 1; j < picked.length; j++) expect(termsClash(picked[i].term, picked[j].term)).toBe(false);
      }
    }
  });
  it('throws when the pool is too small', () => {
    expect(() => pickTerms(TERMS.slice(0, 10), 'clinical', seededRng(1))).toThrow();
  });
  it('newBoard picks a starting team that owns 9 cards', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 20; seed++) {
      const { cards, startingTeam } = newBoard(TERMS, 'mixed', seededRng(seed));
      seen.add(startingTeam);
      expect(count(cards, startingTeam)).toBe(9);
    }
    expect(seen.size).toBe(2);
  });
});
