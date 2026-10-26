import { CONFIG } from './config';
import { step, stay } from './machine';
import { planMatch, type RoundPlan } from './match';
import { summarizeMatch, type MatchSummary } from './scoring';
import { shuffle } from './terms';
import { elapsed, isTimeUp, pauseTimer, resumeTimer, startTimer, stopTimer, type Timer } from './timer';
import { addClue, currentWord, isFinished, markCorrect, newTeamRound, removeClue, skipWord, totalClues, wordsCompleted, type TeamRound } from './teamRound';
import type { Effect, Rng, Settings, Step, TeamId, Term, TeamRoundResult } from './types';

/**
 * OFFLINE MODE (pass the phone, one device, 4 players in 2 teams of 2)
 *
 *  setup -> turnIntro -> playing -> turnEnd -> (other team) turnIntro -> playing -> turnEnd
 *        -> roundSummary -> (round 2: roles swap, new words) -> ... -> results -> rematch -> setup
 *
 *  - The app picks the first team at random; teams take turns and each plays its WHOLE list, with
 *    its own random words. In round 2 the team that went second goes first.
 *  - The giver holds the phone and sees one word at a time. Clues are NOT typed: the giver says
 *    them aloud and taps +1 for each. The guesser answers aloud; the giver taps Correct or Not
 *    correct (Not correct costs nothing). Skip sends the word to the end of the list.
 *  - A turn lasts at most 3 minutes; the clock pauses while the app is in the background.
 *  - Offline earns no EXP or tokens and is free for guests.
 */

export interface OfflineEnv {
  terms: readonly Term[];
  rng: Rng;
  now: () => number;
  /** Terms played before the rest, in order: a player's own words (My diseases). */
  first?: readonly string[];
}

export interface OfflinePlayer {
  id: string;
  name: string;
  team: TeamId;
}

export interface OfflineSetup {
  players: OfflinePlayer[];
  givers: Record<TeamId, string | null>;
  settings: Settings;
}

export type SetupNotice = 'INVALID_PLAYERS' | 'TEAMS_NOT_2_AND_2' | 'MISSING_GIVER' | 'NOT_ENOUGH_TERMS';

export type OfflineUi =
  | { name: 'setup'; notice: SetupNotice | null }
  | { name: 'turnIntro'; round: number; team: TeamId }
  | { name: 'playing' }
  | { name: 'turnEnd'; round: number; team: TeamId; result: TeamRoundResult; reason: 'finished' | 'timeUp' }
  | { name: 'roundSummary'; round: number; results: Record<TeamId, TeamRoundResult> }
  | { name: 'results'; summary: MatchSummary }
  | { name: 'exited' };

export interface Turn {
  team: TeamId;
  giverId: string;
  guesserId: string;
  tr: TeamRound;
  timer: Timer;
}

export interface OfflineState {
  ui: OfflineUi;
  setup: OfflineSetup;
  plan: RoundPlan[] | null;
  /** Which team plays first in each round. */
  firstTeams: TeamId[];
  round: number;
  /** Finished turns per round. */
  results: Partial<Record<TeamId, TeamRoundResult>>[];
  turn: Turn | null;
  rematchAccepted: string[];
}

export type OfflineEvent =
  | { type: 'SET_PLAYERS'; names: string[] }
  | { type: 'ASSIGN_TEAMS'; teams: Record<string, TeamId> }
  | { type: 'RANDOMIZE_TEAMS' }
  | { type: 'SET_GIVER'; team: TeamId; playerId: string }
  | { type: 'SET_SETTINGS'; settings: Partial<Settings> }
  | { type: 'START_MATCH' }
  | { type: 'START_TURN' }
  | { type: 'CLUE_PLUS' }
  | { type: 'CLUE_MINUS' }
  | { type: 'CORRECT' }
  | { type: 'NOT_CORRECT' }
  | { type: 'SKIP' }
  | { type: 'TICK' }
  | { type: 'APP_BACKGROUND' }
  | { type: 'APP_FOREGROUND' }
  | { type: 'NEXT' }
  | { type: 'REMATCH_ACCEPT'; playerId: string }
  | { type: 'EXIT' };

type FX = Effect<OfflineEvent>;
type OfflineStep = Step<OfflineState, OfflineEvent>;
const CLOCK = 'clock';

export const initialOfflineState = (): OfflineState => ({
  ui: { name: 'setup', notice: null },
  setup: { players: [], givers: { A: null, B: null }, settings: { bank: 'mixed', wordsPerTeam: 5, rounds: 1 } },
  plan: null,
  firstTeams: [],
  round: 0,
  results: [],
  turn: null,
  rematchAccepted: [],
});

const other = (t: TeamId): TeamId => (t === 'A' ? 'B' : 'A');
const membersOf = (s: OfflineSetup, team: TeamId) => s.players.filter((p) => p.team === team);

function withGivers(setup: OfflineSetup): OfflineSetup {
  const givers = { ...setup.givers };
  for (const team of ['A', 'B'] as const) {
    const m = membersOf(setup, team).map((p) => p.id);
    if (!givers[team] || !m.includes(givers[team]!)) givers[team] = m[0] ?? null;
  }
  return { ...setup, givers };
}

/** Giver and guesser of a team in a round: round 1 as chosen, round 2 swapped. */
export function rolesFor(setup: OfflineSetup, team: TeamId, round: number): { giverId: string; guesserId: string } {
  const [a, b] = membersOf(setup, team).map((p) => p.id);
  const chosen = setup.givers[team] ?? a;
  const guesser = chosen === a ? b : a;
  return round % 2 === 0 ? { giverId: chosen, guesserId: guesser } : { giverId: guesser, guesserId: chosen };
}

export const currentTermId = (s: OfflineState): string | null => (s.turn ? currentWord(s.turn.tr) : null);

function setSetup(s: OfflineState, setup: OfflineSetup): OfflineStep {
  return step<OfflineState, OfflineEvent>({ ...s, setup, ui: { name: 'setup', notice: null } });
}

function setupEvent(env: OfflineEnv, s: OfflineState, event: OfflineEvent): OfflineStep {
  const bad = (notice: SetupNotice): OfflineStep => step<OfflineState, OfflineEvent>({ ...s, ui: { name: 'setup', notice } });
  switch (event.type) {
    case 'SET_PLAYERS': {
      const names = event.names.map((n) => n.trim());
      const unique = new Set(names.map((n) => n.toLowerCase()));
      if (names.length !== CONFIG.PLAYERS || names.some((n) => n === '') || unique.size !== names.length) {
        return bad('INVALID_PLAYERS');
      }
      const players: OfflinePlayer[] = names.map((name, i) => ({ id: `p${i + 1}`, name, team: i < 2 ? 'A' : 'B' }));
      return setSetup(s, withGivers({ ...s.setup, players, givers: { A: null, B: null } }));
    }
    case 'ASSIGN_TEAMS': {
      const players = s.setup.players.map((p) => ({ ...p, team: event.teams[p.id] ?? p.team }));
      const a = players.filter((p) => p.team === 'A').length;
      if (players.length !== CONFIG.PLAYERS || a !== CONFIG.TEAM_SIZE) return bad('TEAMS_NOT_2_AND_2');
      return setSetup(s, withGivers({ ...s.setup, players }));
    }
    case 'RANDOMIZE_TEAMS': {
      if (s.setup.players.length !== CONFIG.PLAYERS) return bad('INVALID_PLAYERS');
      const ids = shuffle(
        s.setup.players.map((p) => p.id),
        env.rng,
      );
      const players = s.setup.players.map((p) => ({ ...p, team: (ids.indexOf(p.id) < CONFIG.TEAM_SIZE ? 'A' : 'B') as TeamId }));
      return setSetup(s, withGivers({ ...s.setup, players, givers: { A: null, B: null } }));
    }
    case 'SET_GIVER': {
      const member = membersOf(s.setup, event.team).some((p) => p.id === event.playerId);
      return member ? setSetup(s, { ...s.setup, givers: { ...s.setup.givers, [event.team]: event.playerId } }) : stay(s);
    }
    case 'SET_SETTINGS': {
      const next = { ...s.setup.settings, ...event.settings };
      const valid = (next.bank === 'clinical' || next.bank === 'basic' || next.bank === 'mixed') && (next.wordsPerTeam === 5 || next.wordsPerTeam === 10) && (next.rounds === 1 || next.rounds === 2);
      return valid ? setSetup(s, { ...s.setup, settings: next }) : stay(s);
    }
    case 'START_MATCH': {
      const { setup } = s;
      if (setup.players.length !== CONFIG.PLAYERS) return bad('INVALID_PLAYERS');
      if (membersOf(setup, 'A').length !== CONFIG.TEAM_SIZE || membersOf(setup, 'B').length !== CONFIG.TEAM_SIZE) {
        return bad('TEAMS_NOT_2_AND_2');
      }
      if (!setup.givers.A || !setup.givers.B) return bad('MISSING_GIVER');
      const planned = planMatch({ terms: env.terms, settings: setup.settings, mode: 'offline', rng: env.rng, first: env.first });
      if (!planned.ok) return bad('NOT_ENOUGH_TERMS');
      const first: TeamId = env.rng() < 0.5 ? 'A' : 'B'; // the app picks the first team at random
      return step<OfflineState, OfflineEvent>({
        ...s,
        plan: planned.rounds,
        firstTeams: [first],
        round: 0,
        results: [{}],
        turn: null,
        rematchAccepted: [],
        ui: { name: 'turnIntro', round: 0, team: first },
      });
    }
    default:
      return stay(s);
  }
}

function endTurn(env: OfflineEnv, s: OfflineState, reason: 'finished' | 'timeUp'): OfflineStep {
  const turn = s.turn!;
  const timer = stopTimer(turn.timer, env.now());
  const result: TeamRoundResult = {
    teamId: turn.team,
    wordsCompleted: wordsCompleted(turn.tr),
    clues: totalClues(turn.tr), // every clue counts, including on skipped or unfinished words
    timeMs: reason === 'timeUp' ? CONFIG.ROUND_MAX_MS : elapsed(timer, env.now()),
  };
  const results = s.results.map((r, i) => (i === s.round ? { ...r, [turn.team]: result } : r));
  const fx: FX[] = [
    { type: 'CANCEL_TICKER', id: CLOCK },
    { type: 'SOUND', kind: reason === 'timeUp' ? 'buzzer' : 'ding' },
  ];
  if (reason === 'timeUp') fx.push({ type: 'HAPTIC', kind: 'buzzer' });
  return step<OfflineState, OfflineEvent>({ ...s, results, turn: { ...turn, timer }, ui: { name: 'turnEnd', round: s.round, team: turn.team, result, reason } }, fx);
}

function playingEvent(env: OfflineEnv, s: OfflineState, event: OfflineEvent): OfflineStep {
  const turn = s.turn!;
  const now = env.now();

  // The 3-minute cap is checked on every event, so a late tap never counts.
  if (isTimeUp(turn.timer, now)) return endTurn(env, s, 'timeUp');

  const update = (tr: TeamRound, fx: FX[] = []): OfflineStep => step<OfflineState, OfflineEvent>({ ...s, turn: { ...turn, tr } }, fx);

  switch (event.type) {
    case 'CLUE_PLUS':
      return update(addClue(turn.tr), [
        { type: 'SOUND', kind: 'tap' },
        { type: 'HAPTIC', kind: 'tap' },
      ]);
    case 'CLUE_MINUS':
      return update(removeClue(turn.tr));
    case 'NOT_CORRECT':
      // costs nothing: the giver keeps giving clues
      return step<OfflineState, OfflineEvent>(s, [
        { type: 'SOUND', kind: 'buzzer' },
        { type: 'HAPTIC', kind: 'wrong' },
      ]);
    case 'SKIP':
      return update(skipWord(turn.tr), [{ type: 'SOUND', kind: 'tap' }]);
    case 'CORRECT': {
      const tr = markCorrect(turn.tr);
      const next = { ...s, turn: { ...turn, tr } };
      if (isFinished(tr)) return endTurn(env, next, 'finished');
      return step<OfflineState, OfflineEvent>(next, [
        { type: 'SOUND', kind: 'ding' },
        { type: 'HAPTIC', kind: 'correct' },
      ]);
    }
    case 'TICK':
      return step<OfflineState, OfflineEvent>(s); // the UI re-reads the clock; the cap was checked above
    case 'APP_BACKGROUND':
      return step<OfflineState, OfflineEvent>({ ...s, turn: { ...turn, timer: pauseTimer(turn.timer, now) } });
    case 'APP_FOREGROUND':
      return step<OfflineState, OfflineEvent>({ ...s, turn: { ...turn, timer: resumeTimer(turn.timer, now) } });
    default:
      return stay(s);
  }
}

function startTurn(env: OfflineEnv, s: OfflineState, round: number, team: TeamId): OfflineStep {
  const roles = rolesFor(s.setup, team, round);
  const turn: Turn = {
    team,
    giverId: roles.giverId,
    guesserId: roles.guesserId,
    tr: newTeamRound(s.plan![round].lists[team]),
    timer: startTimer(env.now()),
  };
  return step<OfflineState, OfflineEvent>({ ...s, turn, ui: { name: 'playing' } }, [{ type: 'START_TICKER', id: CLOCK, ms: CONFIG.TICK_MS, event: { type: 'TICK' } }]);
}

function next(env: OfflineEnv, s: OfflineState): OfflineStep {
  const ui = s.ui;
  if (ui.name === 'turnEnd') {
    const done = s.results[s.round];
    if (!(done.A && done.B)) {
      // the other team of this round plays now
      return step<OfflineState, OfflineEvent>({ ...s, turn: null, ui: { name: 'turnIntro', round: s.round, team: other(ui.team) } });
    }
    return step<OfflineState, OfflineEvent>({
      ...s,
      turn: null,
      ui: { name: 'roundSummary', round: s.round, results: { A: done.A, B: done.B } },
    });
  }
  if (ui.name === 'roundSummary') {
    if (s.round + 1 < s.setup.settings.rounds) {
      const round = s.round + 1;
      const first = other(s.firstTeams[s.round]); // the team that went second goes first
      return step<OfflineState, OfflineEvent>({
        ...s,
        round,
        firstTeams: [...s.firstTeams, first],
        results: [...s.results, {}],
        ui: { name: 'turnIntro', round, team: first },
      });
    }
    const rounds = s.results.map((r) => ({ A: r.A!, B: r.B! }));
    return step<OfflineState, OfflineEvent>({ ...s, ui: { name: 'results', summary: summarizeMatch(rounds) } }, [{ type: 'SOUND', kind: 'ding' }]);
  }
  return stay(s);
}

export function offlineTransition(env: OfflineEnv, s: OfflineState, event: OfflineEvent): OfflineStep {
  if (event.type === 'EXIT' && s.ui.name !== 'exited') {
    return step<OfflineState, OfflineEvent>({ ...s, ui: { name: 'exited' } }, [
      { type: 'CANCEL_TICKER', id: CLOCK },
      { type: 'NAVIGATE', to: 'menu' },
    ]);
  }
  const { ui } = s;
  switch (ui.name) {
    case 'setup':
      return setupEvent(env, s, event);
    case 'turnIntro':
      return event.type === 'START_TURN' ? startTurn(env, s, ui.round, ui.team) : stay(s);
    case 'playing':
      return playingEvent(env, s, event);
    case 'turnEnd':
    case 'roundSummary':
      return event.type === 'NEXT' ? next(env, s) : stay(s);
    case 'results': {
      if (event.type !== 'REMATCH_ACCEPT') return stay(s);
      if (!s.setup.players.some((p) => p.id === event.playerId) || s.rematchAccepted.includes(event.playerId)) return stay(s);
      const accepted = [...s.rematchAccepted, event.playerId];
      if (accepted.length < s.setup.players.length) return step<OfflineState, OfflineEvent>({ ...s, rematchAccepted: accepted });
      // all 4 accepted: back to setup with the same names so teams and roles can be swapped; new words on start
      return step<OfflineState, OfflineEvent>({
        ...initialOfflineState(),
        setup: s.setup,
        ui: { name: 'setup', notice: null },
      });
    }
    case 'exited':
      return stay(s);
  }
}
