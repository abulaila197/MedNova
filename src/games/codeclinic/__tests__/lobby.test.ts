import { describe, expect, it } from './jestish';
import { ensureSpymasters, rotateSpymasters, teamHasRoom, validateStart, type LobbyPlayer } from '../engine/lobby';

const p = (id: string, team: 'red' | 'blue' | null, isSpymaster = false, connected = true): LobbyPlayer => ({ id, name: id, team, isSpymaster, connected });

describe('validateStart', () => {
  it('accepts 2v2, 3v2 and 3v3', () => {
    expect(validateStart([p('a', 'red'), p('b', 'red'), p('c', 'blue'), p('d', 'blue')]).ok).toBe(true);
    expect(validateStart([p('a', 'red'), p('b', 'red'), p('e', 'red'), p('c', 'blue'), p('d', 'blue')]).ok).toBe(true);
    expect(validateStart([p('a', 'red'), p('b', 'red'), p('e', 'red'), p('c', 'blue'), p('d', 'blue'), p('f', 'blue')]).ok).toBe(true);
  });
  it('rejects fewer than 4, unassigned players, and 1-player teams', () => {
    expect(validateStart([p('a', 'red'), p('b', 'blue'), p('c', 'blue')]).problems).toContain('TOO_FEW_PLAYERS');
    expect(validateStart([p('a', 'red'), p('b', 'red'), p('c', 'blue'), p('d', null)]).problems).toContain('UNASSIGNED_PLAYERS');
    expect(validateStart([p('a', 'red'), p('b', 'blue'), p('c', 'blue'), p('d', 'blue')]).problems).toContain('TEAM_TOO_SMALL');
  });
  it('rejects 7 players and a 4-person team', () => {
    const seven = [p('1', 'red'), p('2', 'red'), p('3', 'red'), p('4', 'blue'), p('5', 'blue'), p('6', 'blue'), p('7', 'blue')];
    const r = validateStart(seven);
    expect(r.problems).toContain('TOO_MANY_PLAYERS');
    expect(r.problems).toContain('TEAM_TOO_BIG');
    expect(r.message).toBeTruthy();
  });
  it('teamHasRoom stops at 3', () => {
    const team = [p('a', 'red'), p('b', 'red'), p('c', 'red')];
    expect(teamHasRoom(team, 'red')).toBe(false);
    expect(teamHasRoom(team, 'red', 'a')).toBe(true);
    expect(teamHasRoom(team, 'blue')).toBe(true);
  });
});

describe('spymasters', () => {
  it('ensureSpymasters keeps existing ones and fills the gaps', () => {
    const out = ensureSpymasters([p('a', 'red'), p('b', 'red', true), p('c', 'blue'), p('d', 'blue')]);
    expect(out.filter((x) => x.isSpymaster).map((x) => x.id)).toEqual(['b', 'c']);
  });
  it('ensureSpymasters prefers a connected player', () => {
    const out = ensureSpymasters([p('a', 'red', false, false), p('b', 'red'), p('c', 'blue'), p('d', 'blue')]);
    expect(out.find((x) => x.isSpymaster && x.team === 'red')?.id).toBe('b');
  });
  it('ensureSpymasters repairs two spymasters on one team', () => {
    const out = ensureSpymasters([p('a', 'red', true), p('b', 'red', true), p('c', 'blue'), p('d', 'blue')]);
    expect(out.filter((x) => x.team === 'red' && x.isSpymaster)).toHaveLength(1);
  });
  it('rotateSpymasters moves to the next teammate, wrapping around', () => {
    const start = [p('a', 'red', true), p('b', 'red'), p('c', 'blue'), p('d', 'blue', true), p('e', 'blue')];
    const once = rotateSpymasters(start);
    expect(once.filter((x) => x.isSpymaster).map((x) => x.id)).toEqual(['b', 'e']);
    const twice = rotateSpymasters(once);
    expect(twice.filter((x) => x.isSpymaster).map((x) => x.id)).toEqual(['a', 'c']);
  });
});
