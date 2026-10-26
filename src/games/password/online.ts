// Online (Yazan's rules, section 5): the 'nova-password' edge function referees the match with this pure step. Both
// teams play at once, on the same words in a different order. Only the clue giver's view ever holds the secret term;
// each team sees only how many words the other team has done. This file is the referee's whole logic.
import { CONFIG } from './engine/config';
import { validateClue, type ClueRejection } from './engine/clues';
import { canStart, lobbyReduce, rolesForRound, type LobbyIntent, type LobbyState, type StartCheck } from './engine/lobby';
import { planMatch, type RoundPlan } from './engine/match';
import { forfeitedResult, summarizeMatch, type Winner } from './engine/scoring';
import { addClue, currentWord, isFinished, markCorrect, newTeamRound, skipWord, totalClues, wordsCompleted, type TeamRound } from './engine/teamRound';
import type { BankChoice, Rng, Role, Settings, TeamId, TeamRoundResult, Term, TermId } from './engine/types';

/** The moves a phone may send; the referee fills in who sent it from the signed-in user. */
export type Move =
  | { type: 'TICK' }
  | { type: 'LOBBY'; intent: LobbyIntent }
  | { type: 'START' }
  | { type: 'CLUE'; text: string }
  | { type: 'GUESS'; termId: TermId }
  | { type: 'SKIP' }
  | { type: 'NEXT' }
  | { type: 'REMATCH' }
  | { type: 'FINISH' };

export const MOVES = new Set<Move['type']>(['TICK', 'LOBBY', 'START', 'CLUE', 'GUESS', 'SKIP', 'NEXT', 'REMATCH', 'FINISH']);

type TeamPlay = { tr: TeamRound; guesses: TermId[]; doneAt: number | null; forfeit: boolean };

/** One finished match of 1 or 2 rounds, for the results and the scores. */
export type Played = { winner: Winner; rounds: Record<TeamId, TeamRoundResult>[]; totals: Record<TeamId, TeamRoundResult>; teams: Record<string, TeamId>; forfeited: string[] };

/** What is saved for a match. */
export type Room = {
  order: string[];
  names: Record<string, string>;
  left: string[];
  lobby: LobbyState;
  phase: 'lobby' | 'playing' | 'roundEnd' | 'finished';
  plan: RoundPlan[] | null;
  round: number;
  startedAt: number;
  teams: Record<TeamId, TeamPlay> | null;
  /** Finished rounds of the current game. */
  results: Record<TeamId, TeamRoundResult>[];
  /** Players whose team forfeited a round of the current game. */
  forfeited: string[];
  /** The round break moves on by itself at this time. */
  breakEnds: number | null;
  played: Played[];
  rematch: string[];
  ended: boolean;
  /** The host's own approved terms (My diseases): played first, at most half of each game's words. */
  own?: Term[];
};

export type Refusal = { code: string; message: string };

type TeamView = { completed: number; total: number; done: boolean; forfeit: boolean };

/** One player's screen. `word` is only ever filled for the giver of a team while it plays. */
export type PwView = {
  phase: Room['phase'];
  ended: boolean;
  hostId: string;
  settings: Settings;
  players: { id: string; name: string; team: TeamId | null; left: boolean }[];
  givers: Record<TeamId, string | null>;
  start: StartCheck;
  round: number;
  endsAt: number | null;
  breakEnds: number | null;
  me: { team: TeamId; role: Role } | null;
  word: { id: TermId; name: string; category: string; forbidden: string[] } | null;
  clues: string[];
  guesses: TermId[];
  doneWords: TermId[];
  wordNo: number;
  teams: Record<TeamId, TeamView> | null;
  results: Record<TeamId, TeamRoundResult>[];
  played: Played[];
  rematch: string[];
  /** The host's own terms' names, so guessers can pick them (the phones only carry the bank). */
  ownTerms: { id: TermId; name: string }[];
};

const refuse = (code: string, message: string): Refusal => ({ code, message });
const clone = (r: Room): Room => JSON.parse(JSON.stringify(r)) as Room;
const TEAMS: TeamId[] = ['A', 'B'];

const CLUE_WHY: Record<ClueRejection, string> = {
  EMPTY: 'Type a clue first.',
  NOT_ONE_WORD: 'One word only.',
  INVALID_CHARS: 'Letters, numbers and hyphens only.',
  TOO_LONG: 'That clue is too long.',
  TERM_WORD: "That's part of the term.",
  SAME_ROOT: 'Too close to the term: same root.',
  FORBIDDEN: "That's one of the crossed-out words.",
  DUPLICATE: 'You already gave that clue.',
};
export const clueWhy = (r: ClueRejection) => CLUE_WHY[r];

export function settingsFrom(raw: Record<string, unknown>): Settings {
  const bank = ['mixed', 'clinical', 'basic'].includes(String(raw.bank)) ? (String(raw.bank) as BankChoice) : 'mixed';
  return { bank, wordsPerTeam: Number(raw.words) === 10 ? 10 : 5, rounds: Number(raw.rounds) === 2 ? 2 : 1 };
}

/** A new match: everyone from the room, dealt into two teams (the host can change them on the first screen). */
export function startOnlineRoom(o: { host: string; seats: string[]; names: Record<string, string>; settings: Record<string, unknown> }): Room {
  const host = o.seats.includes(o.host) ? o.host : o.seats[0];
  const order = [host, ...o.seats.filter((id) => id !== host)];
  const names: Record<string, string> = {};
  for (const id of order) names[id] = o.names[id]?.trim() || 'Player';
  const teams: Record<string, TeamId | null> = {};
  order.forEach((id, i) => (teams[id] = i < 4 ? (i % 2 === 0 ? 'A' : 'B') : null));
  const lobby: LobbyState = {
    hostId: host,
    players: order.slice(0, 4).map((id) => ({ id, name: names[id] })),
    teams,
    givers: { A: order[0] ?? null, B: order[1] ?? null },
    settings: settingsFrom(o.settings),
  };
  return { order, names, left: [], lobby, phase: 'lobby', plan: null, round: 0, startedAt: 0, teams: null, results: [], forfeited: [], breakEnds: null, played: [], rematch: [], ended: false };
}

/** Up to half of a game's words from the host's own terms, in random order. */
const firstOf = (r: Room) => (r.own ?? []).map((t) => t.id).slice(0, Math.floor((r.lobby.settings.wordsPerTeam * r.lobby.settings.rounds) / 2));
/** The bank plus the host's own terms. */
const withOwn = (r: Room, terms: readonly Term[]) => (r.own?.length ? [...r.own, ...terms] : terms);

const live = (r: Room) => r.order.filter((id) => !r.left.includes(id));
const roleOf = (r: Room, id: string) => rolesForRound(r.lobby, r.round)[id] ?? null;
const membersOf = (r: Room, team: TeamId) => r.lobby.players.filter((p) => r.lobby.teams[p.id] === team).map((p) => p.id);
const roundEnds = (r: Room) => r.startedAt + CONFIG.ROUND_MAX_MS;

function forfeit(r: Room, team: TeamId, now: number) {
  const t = r.teams![team];
  if (t.doneAt !== null) return;
  t.forfeit = true;
  t.doneAt = now;
  for (const id of membersOf(r, team)) if (!r.forfeited.includes(id)) r.forfeited.push(id);
}

function beginRound(r: Room, round: number, now: number) {
  r.round = round;
  r.phase = 'playing';
  r.startedAt = now;
  r.breakEnds = null;
  const lists = r.plan![round].lists;
  r.teams = { A: { tr: newTeamRound(lists.A), guesses: [], doneAt: null, forfeit: false }, B: { tr: newTeamRound(lists.B), guesses: [], doneAt: null, forfeit: false } };
  // A team that lost a player for good forfeits every round it cannot play.
  for (const team of TEAMS) if (membersOf(r, team).some((id) => r.left.includes(id))) forfeit(r, team, now);
}

function resultOf(r: Room, team: TeamId): TeamRoundResult {
  const t = r.teams![team];
  const clues = totalClues(t.tr);
  if (t.forfeit) return forfeitedResult(team, clues, CONFIG.ROUND_MAX_MS);
  const timeMs = t.doneAt === null ? CONFIG.ROUND_MAX_MS : Math.min(CONFIG.ROUND_MAX_MS, t.doneAt - r.startedAt);
  return { teamId: team, wordsCompleted: wordsCompleted(t.tr), clues, timeMs };
}

/** Ends the round when both teams are done or the 3 minutes are up. */
function settle(r: Room, now: number) {
  if (r.phase !== 'playing' || !r.teams) return;
  const allDone = TEAMS.every((team) => r.teams![team].doneAt !== null);
  if (!allDone && now < roundEnds(r)) return;
  r.results.push({ A: resultOf(r, 'A'), B: resultOf(r, 'B') });
  r.phase = 'roundEnd';
  r.breakEnds = now + 12_000;
}

function nextRound(r: Room, now: number) {
  if (r.round + 1 < r.lobby.settings.rounds) return beginRound(r, r.round + 1, now);
  const sum = summarizeMatch(r.results);
  const teams: Record<string, TeamId> = {};
  for (const p of r.lobby.players) if (r.lobby.teams[p.id]) teams[p.id] = r.lobby.teams[p.id]!;
  r.played.push({ winner: sum.winner, rounds: sum.rounds, totals: sum.totals, teams, forfeited: [...r.forfeited] });
  r.phase = 'finished';
  r.teams = null;
  r.breakEnds = null;
  r.rematch = [];
}

/** A player is out for good (left the room, or past the rejoin window). */
function markLeft(r: Room, id: string, now: number) {
  if (!r.order.includes(id) || r.left.includes(id)) return;
  r.left.push(id);
  if (!live(r).length) {
    r.ended = true;
    return;
  }
  const team = r.lobby.teams[id];
  if (r.phase === 'playing' && team) forfeit(r, team, now);
  if (r.phase !== 'playing' && r.phase !== 'roundEnd') {
    r.lobby = lobbyReduce(r.lobby, { type: 'PLAYER_LEFT', playerId: id });
    // A player waiting outside the four takes the free seat.
    const spare = live(r).find((x) => !r.lobby.players.some((p) => p.id === x));
    if (spare) r.lobby = lobbyReduce(r.lobby, { type: 'PLAYER_JOINED', player: { id: spare, name: r.names[spare] } });
  } else if (r.lobby.hostId === id) r.lobby = { ...r.lobby, hostId: live(r)[0] };
}

/** Moves of a player on a team that is playing now; returns the team. */
function inPlay(r: Room, me: string, role: Role): { team: TeamId; t: TeamPlay } | Refusal {
  if (r.phase !== 'playing' || !r.teams) return refuse('NOT_IN_ROUND', 'No round is running.');
  const ro = roleOf(r, me);
  if (!ro) return refuse('NOT_PLAYING', 'You are watching this match.');
  if (ro.role !== role) return refuse(role === 'giver' ? 'NOT_GIVER' : 'NOT_GUESSER', role === 'giver' ? 'Only the clue giver can do that.' : 'Only the guesser can guess.');
  const t = r.teams[ro.team];
  if (t.doneAt !== null) return refuse('TEAM_DONE', 'Your team is done for this round.');
  return { team: ro.team, t };
}

function handle(r: Room, me: string, m: Move, terms: readonly Term[], rng: Rng, now: number): Refusal | null {
  const host = me === r.lobby.hostId;
  switch (m.type) {
    case 'TICK':
      return null;
    case 'LOBBY': {
      if (r.phase !== 'lobby' && r.phase !== 'finished') return refuse('NOT_IN_LOBBY', 'Teams are locked during a game.');
      if (!host) return refuse('NOT_HOST', 'Only the host can change the teams and settings.');
      r.lobby = lobbyReduce(r.lobby, { type: 'INTENT', by: me, intent: m.intent }, rng);
      if (r.phase === 'finished') r.phase = 'lobby';
      return null;
    }
    case 'START': {
      if (r.phase !== 'lobby' && r.phase !== 'finished') return refuse('NOT_IN_LOBBY', 'A game is already running.');
      if (!host) return refuse('NOT_HOST', 'Only the host can start.');
      const check = canStart(r.lobby);
      if (!check.ok) return refuse(check.reason, START_WHY[check.reason]);
      const plan = planMatch({ terms, settings: r.lobby.settings, mode: 'online', rng, first: firstOf(r) });
      if (!plan.ok) return refuse('NOT_ENOUGH_TERMS', 'Not enough words for these settings.');
      r.plan = plan.rounds;
      r.results = [];
      r.forfeited = [];
      r.rematch = [];
      beginRound(r, 0, now);
      settle(r, now);
      return null;
    }
    case 'CLUE': {
      const p = inPlay(r, me, 'giver');
      if ('code' in p) return p;
      const id = currentWord(p.t.tr);
      const term = terms.find((x) => x.id === id);
      if (!id || !term) return refuse('NO_WORD', 'No word to give a clue for.');
      if (typeof m.text !== 'string') return refuse('EMPTY', CLUE_WHY.EMPTY);
      const check = validateClue(term, m.text, p.t.tr.words[id].clues);
      if (!check.ok) return refuse(check.reason, CLUE_WHY[check.reason]);
      p.t.tr = addClue(p.t.tr, check.clue);
      return null;
    }
    case 'GUESS': {
      const p = inPlay(r, me, 'guesser');
      if ('code' in p) return p;
      if (!terms.some((x) => x.id === m.termId)) return refuse('UNKNOWN_TERM', 'Pick a term from the list.');
      const id = currentWord(p.t.tr);
      if (!id) return refuse('NO_WORD', 'No word to guess.');
      if (m.termId === id) {
        p.t.tr = markCorrect(p.t.tr);
        p.t.guesses = [];
        if (isFinished(p.t.tr)) p.t.doneAt = now;
        settle(r, now);
      } else if (!p.t.guesses.includes(m.termId)) p.t.guesses.push(m.termId); // wrong guesses are free
      return null;
    }
    case 'SKIP': {
      const p = inPlay(r, me, 'giver');
      if ('code' in p) return p;
      if (p.t.tr.queue.length <= 1) return refuse('LAST_WORD', 'This is your last word: nothing to skip to.');
      p.t.tr = skipWord(p.t.tr);
      p.t.guesses = [];
      return null;
    }
    case 'NEXT':
      if (r.phase !== 'roundEnd') return refuse('NOT_BREAK', 'Not between rounds.');
      if (!host) return refuse('NOT_HOST', 'The host moves on.');
      nextRound(r, now);
      settle(r, now);
      return null;
    case 'REMATCH': {
      if (r.phase !== 'finished') return refuse('NOT_OVER', 'The game is not over.');
      if (!r.rematch.includes(me)) r.rematch.push(me);
      // All four accept: new words, same teams; roles go back to the givers the host picked.
      const four = r.lobby.players.map((p) => p.id);
      if (four.length === CONFIG.PLAYERS && four.every((id) => r.rematch.includes(id))) {
        const plan = planMatch({ terms, settings: r.lobby.settings, mode: 'online', rng, first: firstOf(r) });
        if (!plan.ok) return refuse('NOT_ENOUGH_TERMS', 'Not enough words for these settings.');
        r.plan = plan.rounds;
        r.results = [];
        r.forfeited = [];
        r.rematch = [];
        beginRound(r, 0, now);
        settle(r, now);
      }
      return null;
    }
    case 'FINISH':
      if (r.phase === 'playing' || r.phase === 'roundEnd') return refuse('NOT_OVER', 'Finish this game first.');
      if (!host) return refuse('NOT_HOST', 'Only the host can end the match.');
      r.ended = true;
      return null;
  }
}

const START_WHY: Record<Exclude<StartCheck, { ok: true }>['reason'], string> = {
  NEED_4_PLAYERS: 'Password needs exactly 4 players.',
  TEAMS_NOT_2_AND_2: 'Each team needs exactly 2 players.',
  MISSING_GIVER: 'Pick a clue giver for each team.',
};
export const startWhy = (c: StartCheck) => (c.ok ? null : START_WHY[c.reason]);

/**
 * One request: players who dropped out leave first, then the clock, then my move. Returns the new save (the same
 * object when nothing changed) and the refusal for my move, if any.
 */
export function stepOnline(terms: readonly Term[], saved: Room, me: string, move: Move, dropped: string[], now: number, rng: Rng = Math.random): { next: Room; refused: Refusal | null } {
  if (saved.ended) return { next: saved, refused: move.type === 'TICK' ? null : refuse('ENDED', 'The match is over.') };
  const r = clone(saved);
  for (const id of dropped) markLeft(r, id, now);
  let refused: Refusal | null = null;
  if (!r.ended) {
    // The clock first: a move after the buzzer never counts.
    settle(r, now);
    if (r.phase === 'roundEnd' && r.breakEnds !== null && now >= r.breakEnds) {
      nextRound(r, now);
      settle(r, now);
    }
    if (move.type !== 'TICK') {
      if (!r.order.includes(me) || r.left.includes(me)) refused = refuse('LEFT_GAME', 'You are not in this game.');
      else refused = handle(r, me, move, withOwn(r, terms), rng, now);
    }
  }
  if (JSON.stringify(r) === JSON.stringify(saved)) return { next: saved, refused };
  return { next: r, refused };
}

/** Each player's own view keyed by user id, plus 'watch' for spectators. Only a giver's view holds the word. */
export function viewsOf(r: Room, bank: readonly Term[]): Record<string, PwView> {
  const terms = withOwn(r, bank);
  const roles = r.phase === 'playing' || r.phase === 'roundEnd' ? rolesForRound(r.lobby, r.round) : {};
  const teamView = (team: TeamId): TeamView | null => {
    const t = r.teams?.[team];
    return t ? { completed: wordsCompleted(t.tr), total: t.tr.queue.length + wordsCompleted(t.tr), done: t.doneAt !== null, forfeit: t.forfeit } : null;
  };
  const base: Omit<PwView, 'me' | 'word' | 'clues' | 'guesses' | 'doneWords' | 'wordNo'> = {
    phase: r.phase,
    ended: r.ended,
    hostId: r.lobby.hostId,
    settings: r.lobby.settings,
    players: r.order.map((id) => ({ id, name: r.names[id], team: r.lobby.teams[id] ?? null, left: r.left.includes(id) })),
    givers: r.lobby.givers,
    start: canStart(r.lobby),
    round: r.round,
    endsAt: r.phase === 'playing' ? roundEnds(r) : null,
    breakEnds: r.breakEnds,
    teams: r.teams ? { A: teamView('A')!, B: teamView('B')! } : null,
    results: r.results,
    played: r.played,
    rematch: r.rematch,
    ownTerms: (r.own ?? []).map((t) => ({ id: t.id, name: t.name })),
  };
  const empty = { word: null, clues: [], guesses: [], doneWords: [], wordNo: 0 };
  const out: Record<string, PwView> = {};
  for (const id of r.order) {
    const ro = roles[id];
    const t = ro && r.teams ? r.teams[ro.team] : null;
    if (!ro || !t || r.phase !== 'playing') {
      out[id] = { ...base, me: ro ? { team: ro.team, role: ro.role } : null, ...empty };
      continue;
    }
    const cur = t.doneAt === null ? currentWord(t.tr) : null;
    const term = cur ? terms.find((x) => x.id === cur) : undefined;
    out[id] = {
      ...base,
      me: { team: ro.team, role: ro.role },
      word: ro.role === 'giver' && term && !r.left.includes(id) ? { id: term.id, name: term.name, category: term.category, forbidden: term.forbidden } : null,
      clues: cur ? t.tr.words[cur].clues : [],
      guesses: cur ? t.guesses : [],
      doneWords: t.tr.completed,
      wordNo: wordsCompleted(t.tr) + 1,
    };
  }
  out.watch = { ...base, me: null, ...empty };
  return out;
}

/** When the referee must next be asked to move on (the round's 3 minutes, or the end of the break). */
export const dueOf = (r: Room): number | null => (r.ended ? null : r.phase === 'playing' ? roundEnds(r) : r.phase === 'roundEnd' ? r.breakEnds : null);

/** Games won by each seat. */
export const scoresOf = (r: Room, seats: string[]) => seats.map((id) => r.played.filter((x) => x.winner !== 'draw' && x.teams[id] === x.winner).length);

/** Places for the match_players rows, in seat order: most games won first, ties share. */
export function onlineRanks(r: Room, seats: string[]): number[] {
  const s = scoresOf(r, seats);
  return s.map((x) => 1 + s.filter((y) => y > x).length);
}

/** Yazan's EXP (decided 2026-10-25): win 60, draw 40, loss 20 a game, nothing when your team forfeited; at most 60 a match. */
export function expOf(games: { outcome: 'win' | 'draw' | 'loss'; forfeit: boolean }[]): number {
  const each = games.map((g): number => (g.forfeit ? 0 : g.outcome === 'win' ? 60 : g.outcome === 'draw' ? 40 : 20));
  return Math.min(
    60,
    each.reduce((a, b) => a + b, 0),
  );
}
