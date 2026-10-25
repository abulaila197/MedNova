import { describe, expect, it } from './jestish';
import { createInitialOfflineState, reduceOffline, spymasterName, validateOfflineSettings, type OfflineEvent, type OfflineSettings, type OfflineState } from '../engine/offlineMachine';
import { fixedCards } from './helpers';

const T0 = 5_000_000;
const settings: OfflineSettings = {
  style: 'mixed',
  roster: { red: ['Ana', 'Bo'], blue: ['Cy', 'Di', 'Ed'], spymaster: { red: 0, blue: 1 } },
};
const run = (s: OfflineState, ...events: OfflineEvent[]) => {
  let state = s;
  const effects: any[] = [];
  for (const e of events) {
    const r = reduceOffline(state, e);
    state = r.state;
    effects.push(...r.effects);
  }
  return { state, effects };
};
const start = () => run(createInitialOfflineState(), { type: 'START', settings, cards: fixedCards('red'), startingTeam: 'red', at: T0 }).state;
const playing = () => run(start(), { type: 'KEY_DONE' }, { type: 'KEY_DONE' }).state;
const g = (event: any): OfflineEvent => ({ type: 'GAME', event });

describe('settings', () => {
  it('needs 2-3 per team, 4-6 total, a valid spymaster, and names', () => {
    expect(validateOfflineSettings(settings)).toBeNull();
    expect(validateOfflineSettings({ ...settings, roster: { ...settings.roster, red: ['Ana'] } })).toMatch(/red/);
    expect(validateOfflineSettings({ ...settings, roster: { ...settings.roster, spymaster: { red: 5, blue: 0 } } })).toMatch(/spymaster/);
    expect(validateOfflineSettings({ ...settings, roster: { ...settings.roster, red: ['Ana', ' '] } })).toMatch(/name/);
    expect(validateOfflineSettings({ ...settings, roster: { red: ['a', 'b', 'c', 'd'], blue: ['e', 'f'], spymaster: { red: 0, blue: 0 } } })).toMatch(/2-3/);
  });
  it('START with bad settings stays idle and says why', () => {
    const r = run(createInitialOfflineState(), { type: 'START', settings: { ...settings, roster: { ...settings.roster, red: ['x'] } }, cards: fixedCards(), startingTeam: 'red', at: T0 });
    expect(r.state.phase).toBe('idle');
    expect(r.effects[0].type).toBe('notice');
  });
});

describe('key check', () => {
  it('red spymaster peeks, then blue, then play begins', () => {
    let s = start();
    expect(s.phase).toBe('keyCheck');
    expect(s.keyTeam).toBe('red');
    s = run(s, { type: 'KEY_HOLD', team: 'red' }).state;
    expect(s.keyHeldBy).toBe('red');
    s = run(s, { type: 'KEY_RELEASE' }, { type: 'KEY_DONE' }).state;
    expect(s.keyTeam).toBe('blue');
    expect(s.keyHeldBy).toBeNull();
    s = run(s, { type: 'KEY_DONE' }).state;
    expect(s.phase).toBe('playing');
    expect(s.game?.phase).toBe('ready');
  });
  it('the wrong team cannot hold the key', () => {
    expect(run(start(), { type: 'KEY_HOLD', team: 'blue' }).state.keyHeldBy).toBeNull();
  });
  it('the key hides when the finger lifts', () => {
    const s = run(start(), { type: 'KEY_HOLD', team: 'red' }, { type: 'KEY_RELEASE' }).state;
    expect(s.keyHeldBy).toBeNull();
  });
});

describe('playing', () => {
  it('the key can be held only by the team on turn, in ready/clue, never while guessing', () => {
    let s = playing();
    expect(run(s, { type: 'KEY_HOLD', team: 'blue' }).state.keyHeldBy).toBeNull();
    expect(run(s, { type: 'KEY_HOLD', team: 'red' }).state.keyHeldBy).toBe('red'); // ready
    s = run(s, g({ type: 'BEGIN_TURN', at: T0 + 1 })).state;
    expect(run(s, { type: 'KEY_HOLD', team: 'red' }).state.keyHeldBy).toBe('red'); // clue
    s = run(s, g({ type: 'CLUE', team: 'red', word: null, number: 2, at: T0 + 2 })).state;
    expect(run(s, { type: 'KEY_HOLD', team: 'red' }).state.keyHeldBy).toBeNull(); // guess
  });
  it('any game action hides the key', () => {
    let s = run(playing(), g({ type: 'BEGIN_TURN', at: T0 + 1 }), { type: 'KEY_HOLD', team: 'red' }).state;
    expect(s.keyHeldBy).toBe('red');
    s = run(s, g({ type: 'CLUE', team: 'red', word: null, number: 1, at: T0 + 2 })).state;
    expect(s.keyHeldBy).toBeNull();
  });
  it('no key while paused', () => {
    const s = run(playing(), g({ type: 'BEGIN_TURN', at: T0 + 1 }), g({ type: 'PAUSE', at: T0 + 2 })).state;
    expect(run(s, { type: 'KEY_HOLD', team: 'red' }).state.keyHeldBy).toBeNull();
  });
  it('turns wait in ready after a pass (nobody\'s clock runs during the handoff)', () => {
    const s = run(playing(), g({ type: 'BEGIN_TURN', at: T0 }), g({ type: 'TICK', at: T0 + 60_000 })).state;
    expect(s.game?.turn).toBe('blue');
    expect(s.game?.phase).toBe('ready');
  });
});

describe('finishing', () => {
  const finished = () =>
    run(playing(), g({ type: 'BEGIN_TURN', at: T0 }), g({ type: 'CLUE', team: 'red', word: null, number: 1, at: T0 + 1 }), g({ type: 'GUESS', team: 'red', cardIndex: 24, at: T0 + 2 }));
  it('assassin ends the game and emits one record', () => {
    const { state, effects } = finished();
    expect(state.phase).toBe('finished');
    const done = effects.filter((e) => e.type === 'gameFinished');
    expect(done).toHaveLength(1);
    expect(done[0].record).toMatchObject({ mode: 'offline', winner: 'blue', winReason: 'assassin', style: 'mixed' });
    expect(done[0].record.players).toHaveLength(5);
    expect(done[0].record.players.filter((p: any) => p.role === 'spymaster').map((p: any) => p.name)).toEqual(['Ana', 'Di']);
  });
  it('Pass the phone grants no reward', () => {
    expect(finished().state.reward).toEqual({ xp: 0 });
  });
  it('no more game events after finishing', () => {
    const { state } = finished();
    expect(run(state, g({ type: 'TICK', at: T0 + 999_999 })).effects).toEqual([]);
  });
  it('rematch rotates spymasters and starts a fresh key check', () => {
    const { state } = finished();
    const r = run(state, { type: 'REMATCH', cards: fixedCards('blue'), startingTeam: 'blue', at: T0 + 10 }).state;
    expect(r.phase).toBe('keyCheck');
    expect(spymasterName(r.settings!, 'red')).toBe('Bo');
    expect(spymasterName(r.settings!, 'blue')).toBe('Ed');
    expect(r.game?.startingTeam).toBe('blue');
    expect(r.rematches).toBe(1);
    // and rotates again
    const r2 = finishAgain(r);
    expect(spymasterName(r2.settings!, 'red')).toBe('Ana');
    expect(spymasterName(r2.settings!, 'blue')).toBe('Cy');
  });
  it('RESET goes back to idle', () => {
    expect(run(finished().state, { type: 'RESET' }).state.phase).toBe('idle');
  });
});

function finishAgain(s: OfflineState): OfflineState {
  const x = run(s, { type: 'KEY_DONE' }, { type: 'KEY_DONE' }, g({ type: 'BEGIN_TURN', at: T0 + 20 }), g({ type: 'CLUE', team: 'blue', word: null, number: 1, at: T0 + 21 }), g({ type: 'GUESS', team: 'blue', cardIndex: 24, at: T0 + 22 })).state;
  return run(x, { type: 'REMATCH', cards: fixedCards('red'), startingTeam: 'red', at: T0 + 30 }).state;
}
