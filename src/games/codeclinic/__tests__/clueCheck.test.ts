import { describe, expect, it } from './jestish';
import { checkClue } from '../engine/clueCheck';

const board = ['Cardiomyopathy', 'Heart', 'Insulin', 'Aorta'];

describe('checkClue', () => {
  it('accepts a clean single word', () => {
    expect(checkClue('  Pump ', board)).toEqual({ ok: true, clue: 'Pump' });
  });
  it('rejects empty, spaces, hyphens, symbols', () => {
    expect(checkClue('', board)).toMatchObject({ ok: false, problem: 'EMPTY' });
    expect(checkClue('blood sugar', board)).toMatchObject({ ok: false, problem: 'MULTIPLE_WORDS' });
    expect(checkClue('blood-sugar', board)).toMatchObject({ ok: false, problem: 'MULTIPLE_WORDS' });
    expect(checkClue('b@d', board)).toMatchObject({ ok: false, problem: 'INVALID_CHARS' });
  });
  it('rejects a board word, ignoring case and accents', () => {
    expect(checkClue('insulin', board)).toMatchObject({ ok: false, problem: 'BOARD_WORD', conflictsWith: 'Insulin' });
    expect(checkClue('AORTÁ', board)).toMatchObject({ ok: false, problem: 'BOARD_WORD' });
  });
  it('rejects a clue inside a board word (cardio vs cardiomyopathy)', () => {
    expect(checkClue('cardio', board)).toMatchObject({ ok: false, problem: 'INSIDE_BOARD_WORD', conflictsWith: 'Cardiomyopathy' });
  });
  it('rejects a clue containing a board word (heartburn vs heart)', () => {
    expect(checkClue('heartburn', board)).toMatchObject({ ok: false, problem: 'CONTAINS_BOARD_WORD', conflictsWith: 'Heart' });
  });
  it('only compares against the terms passed in (revealed cards are excluded by the caller)', () => {
    expect(checkClue('heartburn', ['Insulin'])).toEqual({ ok: true, clue: 'heartburn' });
  });
  it('rejects 1-letter and over-long clues', () => {
    expect(checkClue('a', [])).toMatchObject({ ok: false, problem: 'TOO_SHORT' });
    expect(checkClue('x'.repeat(31), [])).toMatchObject({ ok: false, problem: 'TOO_LONG' });
  });
});
