import { describe, expect, it } from './jestish';
import { createGame, reduceGame, canEndTurn, getPhaseRemainingMs, type GameEvent, type GameState } from '../engine/gameCore';
import { fixedCards } from './helpers';

const T0 = 1_000_000;
const run = (s: GameState, ...events: GameEvent[]) => {
  let state = s;
  const effects: any[] = [];
  for (const e of events) {
    const r = reduceGame(state, e);
    state = r.state;
    effects.push(...r.effects);
  }
  return { state, effects };
};
const fresh = (requireReady = false) => createGame({ cards: fixedCards('red'), startingTeam: 'red', now: T0, config: { requireReady } });
const clue = (team: 'red' | 'blue', n: number | 'unlimited', at: number, word: string | null = 'pump'): GameEvent => ({ type: 'CLUE', team, word, number: n, at });
const guess = (team: 'red' | 'blue', cardIndex: number, at: number): GameEvent => ({ type: 'GUESS', team, cardIndex, at });
const notices = (effects: any[]) => effects.filter((e) => e.type === 'notice').map((e) => e.code);

describe('createGame', () => {
  it('starts in the clue phase with a 60 s timer (online) or waits in ready (offline)', () => {
    const g = fresh();
    expect(g.phase).toBe('clue');
    expect(g.phaseEndsAt).toBe(T0 + 60_000);
    expect(g.remaining).toEqual({ red: 9, blue: 8 });
    expect(fresh(true).phase).toBe('ready');
  });
  it('BEGIN_TURN starts the clue clock', () => {
    const { state } = run(fresh(true), { type: 'BEGIN_TURN', at: T0 + 5000 });
    expect(state.phase).toBe('clue');
    expect(state.phaseEndsAt).toBe(T0 + 65_000);
  });
});

describe('clues', () => {
  it('accepts a clue and opens guessing with number+1 guesses and a fresh 60 s', () => {
    const { state } = run(fresh(), clue('red', 2, T0 + 10_000));
    expect(state.phase).toBe('guess');
    expect(state.clue).toMatchObject({ word: 'pump', number: 2, guessesLeft: 3, guesses: 0 });
    expect(state.phaseEndsAt).toBe(T0 + 70_000);
  });
  it('unlimited has no cap', () => {
    const { state } = run(fresh(), clue('red', 'unlimited', T0));
    expect(state.clue?.guessesLeft).toBeNull();
  });
  it('rejects a bad clue word and stays in the clue phase', () => {
    const r = run(fresh(), clue('red', 1, T0, 'cardio blood'), clue('red', 1, T0, 'Aorta'));
    expect(r.state.phase).toBe('clue');
    expect(notices(r.effects)).toEqual(['CLUE_REJECTED', 'CLUE_REJECTED']);
  });
  it('rejects a clue that clashes only with UNREVEALED cards', () => {
    const afterReveal = run(fresh(), clue('red', 3, T0), guess('red', 0, T0 + 1), { type: 'END_TURN', team: 'red', at: T0 + 2 }, clue('blue', 1, T0 + 3, 'x'));
    expect(afterReveal.state.turn).toBe('blue');
    // card 0 (Aorta) is revealed now, so "aortic" is fine
    const r = run(afterReveal.state, clue('blue', 1, T0 + 4, 'aortic'));
    expect(r.state.phase).toBe('guess');
  });
  it('rejects numbers outside 1-9', () => {
    const r = run(fresh(), clue('red', 0, T0), clue('red', 10, T0), clue('red', 1.5, T0));
    expect(notices(r.effects)).toEqual(['BAD_NUMBER', 'BAD_NUMBER', 'BAD_NUMBER']);
  });
  it('the other team cannot give the clue', () => {
    expect(notices(run(fresh(), clue('blue', 1, T0)).effects)).toEqual(['WRONG_TEAM']);
  });
  it('offline clues have no word and skip the check', () => {
    const { state } = run(fresh(), clue('red', 2, T0, null));
    expect(state.clue?.word).toBeNull();
  });
});

describe('guessing', () => {
  const inGuess = (n: number | 'unlimited' = 2) => run(fresh(), clue('red', n, T0)).state;

  it('own-team card keeps the turn going', () => {
    const { state, effects } = run(inGuess(), guess('red', 0, T0 + 1));
    expect(state.turn).toBe('red');
    expect(state.phase).toBe('guess');
    expect(state.remaining.red).toBe(8);
    expect(effects.some((e) => e.type === 'sound' && e.id === 'correct')).toBe(true);
  });
  it('neutral ends the turn', () => {
    const { state } = run(inGuess(), guess('red', 17, T0 + 1));
    expect(state.turn).toBe('blue');
    expect(state.phase).toBe('clue');
    expect(state.clue).toBeNull();
  });
  it('an enemy card ends the turn and counts for them', () => {
    const { state } = run(inGuess(), guess('red', 9, T0 + 1));
    expect(state.turn).toBe('blue');
    expect(state.remaining.blue).toBe(7);
  });
  it('assassin loses the game for the guessing team', () => {
    const { state } = run(inGuess(), guess('red', 24, T0 + 1));
    expect(state.phase).toBe('over');
    expect(state.winner).toBe('blue');
    expect(state.winReason).toBe('assassin');
  });
  it('the turn ends automatically after number+1 correct guesses', () => {
    const { state } = run(inGuess(1), guess('red', 0, T0 + 1), guess('red', 1, T0 + 2));
    expect(state.turn).toBe('blue');
  });
  it('unlimited never auto-ends', () => {
    const events = [0, 1, 2, 3, 4].map((i) => guess('red', i, T0 + i));
    const { state } = run(inGuess('unlimited'), ...events);
    expect(state.turn).toBe('red');
  });
  it('cannot reveal twice, or an unknown card', () => {
    const r = run(inGuess(), guess('red', 0, T0 + 1), guess('red', 0, T0 + 2), guess('red', 99, T0 + 3));
    expect(notices(r.effects)).toEqual(['CARD_ALREADY_REVEALED', 'BAD_CARD']);
  });
  it('cannot guess during the clue phase or for the other team', () => {
    expect(notices(run(fresh(), guess('red', 0, T0)).effects)).toEqual(['WRONG_PHASE']);
    expect(notices(run(inGuess(), guess('blue', 0, T0 + 1)).effects)).toEqual(['WRONG_TEAM']);
  });
  it('finding the last own card wins', () => {
    const g = run(fresh(), clue('red', 9, T0)).state;
    const { state } = run(g, ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => guess('red', i, T0 + 1 + i)));
    expect(state.winner).toBe('red');
    expect(state.winReason).toBe('allFound');
  });
  it('revealing the enemy\'s LAST card hands them the win', () => {
    let g = run(fresh(), clue('red', 9, T0)).state;
    // reveal 7 of blue's 8 cards across turns is long; shortcut by editing the state
    g = { ...g, remaining: { red: 9, blue: 1 } };
    const { state } = run(g, guess('red', 9, T0 + 1));
    expect(state.winner).toBe('blue');
  });
  it('ignores events after game over', () => {
    const over = run(run(fresh(), clue('red', 1, T0)).state, guess('red', 24, T0 + 1)).state;
    const r = reduceGame(over, guess('blue', 0, T0 + 2));
    expect(r.state).toBe(over);
  });
});

describe('ending the turn voluntarily', () => {
  it('needs at least one guess', () => {
    const g = run(fresh(), clue('red', 2, T0)).state;
    expect(canEndTurn(g)).toBe(false);
    expect(notices(run(g, { type: 'END_TURN', team: 'red', at: T0 + 1 }).effects)).toEqual(['NEED_ONE_GUESS']);
    const g2 = run(g, guess('red', 0, T0 + 1)).state;
    expect(canEndTurn(g2)).toBe(true);
    expect(run(g2, { type: 'END_TURN', team: 'red', at: T0 + 2 }).state.turn).toBe('blue');
  });
});

describe('timers', () => {
  it('clue timer expiry: the team loses its turn', () => {
    const { state, effects } = run(fresh(), { type: 'TICK', at: T0 + 60_000 });
    expect(state.turn).toBe('blue');
    expect(state.phase).toBe('clue');
    expect(state.phaseEndsAt).toBe(T0 + 120_000);
    expect(notices(effects)).toEqual(['CLUE_TIMEOUT']);
    expect(state.log[0]).toMatchObject({ kind: 'timeout', phase: 'clue', team: 'red' });
  });
  it('guess timer expiry: the turn passes', () => {
    const g = run(fresh(), clue('red', 2, T0 + 1000)).state;
    const { state, effects } = run(g, { type: 'TICK', at: T0 + 61_000 });
    expect(state.turn).toBe('blue');
    expect(notices(effects)).toEqual(['GUESS_TIMEOUT']);
  });
  it('no change before the buzzer', () => {
    const g = fresh();
    expect(reduceGame(g, { type: 'TICK', at: T0 + 59_999 }).state).toBe(g);
  });
  it('a late action is treated as after the buzzer', () => {
    const g = fresh();
    const r = reduceGame(g, clue('red', 1, T0 + 61_000));
    expect(r.state.turn).toBe('blue');
    expect(r.state.phase).toBe('clue');
    expect(r.state.clue).toBeNull();
  });
  it('remaining ms counts down and respects pause', () => {
    const g = fresh();
    expect(getPhaseRemainingMs(g, T0 + 20_000)).toBe(40_000);
    const paused = reduceGame(g, { type: 'PAUSE', at: T0 + 20_000 }).state;
    expect(getPhaseRemainingMs(paused, T0 + 50_000)).toBe(40_000);
    const resumed = reduceGame(paused, { type: 'RESUME', at: T0 + 50_000 }).state;
    expect(resumed.phaseEndsAt).toBe(T0 + 90_000);
    expect(reduceGame(paused, { type: 'TICK', at: T0 + 500_000 }).state).toBe(paused);
  });
  it('offline: after a timeout the next team waits in ready', () => {
    const g = run(fresh(true), { type: 'BEGIN_TURN', at: T0 }).state;
    const { state } = run(g, { type: 'TICK', at: T0 + 60_000 });
    expect(state.phase).toBe('ready');
    expect(state.phaseEndsAt).toBeNull();
    expect(state.turn).toBe('blue');
  });
});

describe('forfeit', () => {
  it('gives the other team the win', () => {
    const { state } = run(fresh(), { type: 'FORFEIT', team: 'red', at: T0 + 5 });
    expect(state).toMatchObject({ phase: 'over', winner: 'blue', winReason: 'forfeit' });
  });
});
