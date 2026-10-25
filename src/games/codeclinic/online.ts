// Online (CC1): Yazan's room rules (server/codeClinicRoom.ts in his package) as one pure step, so the 'code-clinic'
// edge function can load the room, apply a move and save it. The phones only ever get their own view: the key goes to
// the two spymasters and nobody else. This file is the referee's whole logic, tested with the rest of the game.
import { keyOf, newBoard } from './engine/board';
import { createGame, reduceGame, type GameEvent, type GameState } from './engine/gameCore';
import { ensureSpymasters, rotateSpymasters, teamHasRoom, validateStart, type LobbyPlayer, type StartCheck } from './engine/lobby';
import type { PublicGame, RosterPlayer } from './engine/onlineProtocol';
import type { CardColor, ClueNumber, Rng, StyleChoice, Team, Term, WinReason } from './engine/types';

/** The moves a phone may send; the referee fills in who sent it from the signed-in user. */
export type Move =
  | { type: 'TICK' }
  | { type: 'SET_TEAM'; team: Team | null }
  | { type: 'CLAIM_SPYMASTER' }
  | { type: 'RELEASE_SPYMASTER' }
  | { type: 'ASSIGN_SPYMASTER'; playerId: string }
  | { type: 'SET_STYLE'; style: StyleChoice }
  | { type: 'START' }
  | { type: 'CLUE'; word: string; number: ClueNumber }
  | { type: 'MARK'; cardIndex: number | null }
  | { type: 'CONFIRM'; cardIndex: number }
  | { type: 'END_TURN' }
  | { type: 'REMATCH' }
  | { type: 'BACK_TO_LOBBY' }
  | { type: 'FINISH' };

export const MOVES = new Set<Move['type']>(['TICK', 'SET_TEAM', 'CLAIM_SPYMASTER', 'RELEASE_SPYMASTER', 'ASSIGN_SPYMASTER', 'SET_STYLE', 'START', 'CLUE', 'MARK', 'CONFIRM', 'END_TURN', 'REMATCH', 'BACK_TO_LOBBY', 'FINISH']);

export type CPlayer = { id: string; name: string; team: Team | null; isSpymaster: boolean; left: boolean };

/** One finished game of the match, for the results and the scores. */
export type Played = { winner: Team; reason: WinReason; turns: number; teams: Record<string, Team>; spymasters: string[] };

/** What is saved for a match. */
export type Room = {
  order: string[];
  players: Record<string, CPlayer>;
  hostId: string;
  style: StyleChoice;
  phase: 'lobby' | 'playing' | 'finished';
  game: GameState | null;
  /** The card a guesser tapped once; everyone sees it, any guesser of that team confirms it. */
  marker: number | null;
  played: Played[];
  /** The host closed the match: everyone goes to the results. */
  ended: boolean;
};

export type Refusal = { code: string; message: string };

/** One player's screen. `key` is only ever filled for a spymaster while a game runs. */
export type CcView = {
  phase: Room['phase'];
  ended: boolean;
  hostId: string;
  style: StyleChoice;
  players: RosterPlayer[];
  start: StartCheck;
  game: PublicGame | null;
  key: CardColor[] | null;
  played: Played[];
};

const STYLES: StyleChoice[] = ['mixed', 'clinical', 'basic'];

/** A new match: everyone from the room, no teams yet (players pick them on the first screen). */
export function startOnlineRoom(o: { host: string; seats: string[]; names: Record<string, string>; style: string }): Room {
  const players: Record<string, CPlayer> = {};
  for (const id of o.seats) players[id] = { id, name: o.names[id]?.trim() || 'Player', team: null, isSpymaster: false, left: false };
  return {
    order: [...o.seats],
    players,
    hostId: o.seats.includes(o.host) ? o.host : o.seats[0],
    style: STYLES.includes(o.style as StyleChoice) ? (o.style as StyleChoice) : 'mixed',
    phase: 'lobby',
    game: null,
    marker: null,
    played: [],
    ended: false,
  };
}

const active = (r: Room) => r.order.map((id) => r.players[id]).filter((p) => !p.left);
const asLobby = (p: CPlayer, dropped: Set<string> = new Set()): LobbyPlayer => ({ id: p.id, name: p.name, team: p.team, isSpymaster: p.isSpymaster, connected: !dropped.has(p.id) });
const refuse = (code: string, message: string): Refusal => ({ code, message });

/** Copies the room so a step never changes the saved one. */
const clone = (r: Room): Room => JSON.parse(JSON.stringify(r)) as Room;

function applyGame(r: Room, e: GameEvent): Refusal | null {
  const res = reduceGame(r.game!, e);
  r.game = res.state;
  const n = res.effects.find((x) => x.type === 'notice' && x.code !== 'CLUE_TIMEOUT' && x.code !== 'GUESS_TIMEOUT');
  return n && n.type === 'notice' ? refuse(n.code, n.message) : null;
}

function afterAction(r: Room) {
  const g = r.game!;
  if (g.phase === 'over' && r.phase === 'playing') {
    r.phase = 'finished';
    r.marker = null;
    const teams: Record<string, Team> = {};
    for (const p of r.order.map((id) => r.players[id])) if (p.team) teams[p.id] = p.team;
    r.played.push({ winner: g.winner!, reason: g.winReason!, turns: g.turnNumber, teams, spymasters: r.order.filter((id) => r.players[id].isSpymaster) });
  }
}

/** Runs a move through the core; a move after the buzzer still lets the timeout through (his room's rule). */
function play(r: Room, e: GameEvent): Refusal | null {
  const before = r.game!.log.length;
  const err = applyGame(r, e);
  if (r.game!.log.length !== before) r.marker = null;
  afterAction(r);
  return err;
}

function startGame(r: Room, terms: readonly Term[], rng: Rng, now: number, rotate: boolean, dropped: Set<string>): Refusal | null {
  let list = active(r).map((p) => asLobby(p, dropped));
  list = rotate ? rotateSpymasters(list) : ensureSpymasters(list, rng);
  let board;
  try {
    board = newBoard(terms, r.style, rng);
  } catch {
    return refuse('NOT_ENOUGH_TERMS', 'Not enough words to build a board.');
  }
  for (const l of list) r.players[l.id].isSpymaster = l.isSpymaster;
  r.game = createGame({ cards: board.cards, startingTeam: board.startingTeam, now, config: { requireReady: false } });
  r.marker = null;
  r.phase = 'playing';
  return null;
}

/** A player is out for good (left the room, or past the 60 s rejoin window). */
function markLeft(r: Room, id: string, now: number) {
  const p = r.players[id];
  if (!p || p.left) return;
  p.left = true;
  if (r.hostId === id) r.hostId = active(r)[0]?.id ?? r.hostId;
  if (!active(r).length) {
    r.ended = true;
    return;
  }
  if (r.phase !== 'playing' || !p.team) {
    if (r.phase === 'lobby') p.isSpymaster = false;
    return;
  }
  const mates = active(r).filter((m) => m.team === p.team);
  if (!mates.length) {
    // A team with nobody left forfeits.
    applyGame(r, { type: 'FORFEIT', team: p.team, at: now });
    r.marker = null;
    afterAction(r);
    return;
  }
  if (p.isSpymaster) {
    p.isSpymaster = false;
    mates[0].isSpymaster = true;
    r.marker = null;
  }
}

/** Checks for MARK, CONFIRM and END_TURN: a guesser of the team on turn, while guessing. */
function guesser(r: Room, p: CPlayer): Refusal | null {
  if (r.phase !== 'playing' || !r.game) return refuse('NOT_IN_GAME', 'No game is running.');
  if (p.isSpymaster) return refuse('NOT_GUESSER', 'Spymasters cannot guess.');
  if (p.team !== r.game.turn) return refuse('NOT_YOUR_TURN', "Not your team's turn.");
  if (r.game.phase !== 'guess') return refuse('WRONG_PHASE', 'Wait for the clue.');
  return null;
}

function handle(r: Room, p: CPlayer, m: Move, terms: readonly Term[], rng: Rng, now: number, dropped: Set<string>): Refusal | null {
  const host = p.id === r.hostId;
  const lobby = active(r).map((x) => asLobby(x, dropped));
  switch (m.type) {
    case 'TICK':
      if (r.phase === 'playing' && r.game) {
        const before = r.game.log.length;
        applyGame(r, { type: 'TICK', at: now });
        if (r.game.log.length !== before) r.marker = null;
        afterAction(r);
      }
      return null;
    case 'SET_TEAM':
      if (r.phase !== 'lobby') return refuse('NOT_IN_LOBBY', 'Teams are locked during a game.');
      if (m.team !== null && m.team !== 'red' && m.team !== 'blue') return refuse('NO_TEAM', 'No such team.');
      if (m.team !== null && m.team !== p.team && !teamHasRoom(lobby, m.team, p.id)) return refuse('TEAM_FULL', 'That team is full.');
      if (m.team !== p.team) p.isSpymaster = false;
      p.team = m.team;
      return null;
    case 'CLAIM_SPYMASTER':
      if (r.phase !== 'lobby') return refuse('NOT_IN_LOBBY', 'Roles are fixed during a game.');
      if (!p.team) return refuse('NO_TEAM', 'Pick a team first.');
      if (active(r).some((x) => x.team === p.team && x.isSpymaster && x.id !== p.id)) return refuse('SPYMASTER_TAKEN', 'Your team already has a spymaster.');
      p.isSpymaster = true;
      return null;
    case 'RELEASE_SPYMASTER':
      if (r.phase !== 'lobby') return refuse('NOT_IN_LOBBY', 'Roles are fixed during a game.');
      p.isSpymaster = false;
      return null;
    case 'ASSIGN_SPYMASTER': {
      if (r.phase !== 'lobby') return refuse('NOT_IN_LOBBY', 'Roles are fixed during a game.');
      if (!host) return refuse('NOT_HOST', 'Only the host can assign roles.');
      const target = r.players[m.playerId];
      if (!target || target.left) return refuse('UNKNOWN_PLAYER', 'No such player.');
      if (!target.team) return refuse('NO_TEAM', 'That player has no team yet.');
      for (const x of active(r)) if (x.team === target.team) x.isSpymaster = x.id === target.id;
      return null;
    }
    case 'SET_STYLE':
      if (r.phase !== 'lobby') return refuse('NOT_IN_LOBBY', 'Words are locked during a game.');
      if (!host) return refuse('NOT_HOST', 'Only the host can change the words.');
      if (!STYLES.includes(m.style)) return refuse('BAD_STYLE', 'No such word style.');
      r.style = m.style;
      return null;
    case 'START': {
      if (r.phase !== 'lobby') return refuse('NOT_IN_LOBBY', 'A game is already running.');
      if (!host) return refuse('NOT_HOST', 'Only the host can start.');
      const check = validateStart(lobby);
      if (!check.ok) return refuse('NOT_READY', check.message!);
      return startGame(r, terms, rng, now, false, dropped);
    }
    case 'CLUE':
      if (r.phase !== 'playing' || !r.game) return refuse('NOT_IN_GAME', 'No game is running.');
      if (!p.isSpymaster) return refuse('NOT_SPYMASTER', 'Only the spymaster gives clues.');
      if (p.team !== r.game.turn) return refuse('NOT_YOUR_TURN', "Not your team's turn.");
      if (typeof m.word !== 'string') return refuse('CLUE_REJECTED', 'Type a one-word clue.');
      return play(r, { type: 'CLUE', team: p.team, word: m.word, number: m.number, at: now });
    case 'MARK': {
      const err = guesser(r, p);
      if (err) return err;
      if (m.cardIndex !== null) {
        const c = r.game!.cards[m.cardIndex];
        if (!c) return refuse('BAD_CARD', 'No such card.');
        if (c.revealed) return refuse('CARD_ALREADY_REVEALED', 'Already revealed.');
      }
      r.marker = m.cardIndex;
      return null;
    }
    case 'CONFIRM': {
      const err = guesser(r, p);
      if (err) return err;
      if (r.marker !== m.cardIndex) return refuse('MARK_FIRST', 'Tap the card first, then confirm.');
      return play(r, { type: 'GUESS', team: p.team!, cardIndex: m.cardIndex, at: now });
    }
    case 'END_TURN': {
      const err = guesser(r, p);
      if (err) return err;
      return play(r, { type: 'END_TURN', team: p.team!, at: now });
    }
    case 'REMATCH': {
      if (r.phase !== 'finished') return refuse('NOT_IN_GAME', 'The game is not over.');
      if (!host) return refuse('NOT_HOST', 'Only the host can start a rematch.');
      const check = validateStart(lobby);
      if (!check.ok) return refuse('NOT_READY', check.message!);
      return startGame(r, terms, rng, now, true, dropped);
    }
    case 'BACK_TO_LOBBY':
      if (r.phase !== 'finished') return refuse('NOT_IN_GAME', 'The game is not over.');
      if (!host) return refuse('NOT_HOST', 'Only the host can do that.');
      for (const x of active(r)) x.isSpymaster = false;
      r.phase = 'lobby';
      r.game = null;
      r.marker = null;
      return null;
    case 'FINISH':
      // The host ends the match between games; a game in progress has to finish first.
      if (r.phase === 'playing') return refuse('NOT_OVER', 'Finish this game first.');
      if (!host) return refuse('NOT_HOST', 'Only the host can end the match.');
      r.ended = true;
      return null;
  }
}

/**
 * One request: players who dropped out leave first, then my move. Returns the new save (the same object when
 * nothing changed) and the refusal for my move, if any.
 */
export function stepOnline(terms: readonly Term[], saved: Room, me: string, move: Move, dropped: string[], now: number, rng: Rng = Math.random): { next: Room; refused: Refusal | null } {
  if (saved.ended) return { next: saved, refused: move.type === 'TICK' ? null : refuse('ENDED', 'The match is over.') };
  const r = clone(saved);
  const gone = new Set(dropped);
  for (const id of dropped) markLeft(r, id, now);
  let refused: Refusal | null = null;
  const p = r.players[me];
  if (!r.ended) {
    if (move.type === 'TICK') handle(r, p ?? ({ id: me } as CPlayer), move, terms, rng, now, gone);
    else if (!p || p.left) refused = refuse('LEFT_GAME', 'You are not in this game.');
    else refused = handle(r, p, move, terms, rng, now, gone);
  }
  if (JSON.stringify(r) === JSON.stringify(saved)) return { next: saved, refused };
  return { next: r, refused };
}

function publicGame(r: Room): PublicGame {
  const g = r.game!;
  const over = g.phase === 'over';
  return {
    cards: g.cards.map((c) => ({ index: c.index, term: c.term, revealed: c.revealed, color: c.revealed || over ? c.color : null })),
    style: r.style,
    startingTeam: g.startingTeam,
    turn: g.turn,
    phase: g.phase,
    phaseEndsAt: g.phaseEndsAt,
    clue: g.clue && { team: g.clue.team, word: g.clue.word, number: g.clue.number, guessesLeft: g.clue.guessesLeft, guesses: g.clue.guesses },
    remaining: g.remaining,
    log: g.log,
    turnNumber: g.turnNumber,
    winner: g.winner,
    winReason: g.winReason,
    marker: r.marker,
    hostId: r.hostId,
    players: r.order.map((id) => ({ ...asLobby(r.players[id]), left: r.players[id].left })),
  };
}

/** Each player's own view keyed by user id, plus 'watch' for spectators. Only the spymasters' views hold the key. */
export function viewsOf(r: Room): Record<string, CcView> {
  const players = r.order.map((id) => ({ ...asLobby(r.players[id]), left: r.players[id].left }));
  const base = {
    phase: r.phase,
    ended: r.ended,
    hostId: r.hostId,
    style: r.style,
    players,
    start: validateStart(active(r).map((p) => asLobby(p))),
    game: r.game ? publicGame(r) : null,
    played: r.played,
  };
  const key = r.game && r.phase === 'playing' ? keyOf(r.game.cards) : null;
  const out: Record<string, CcView> = {};
  for (const id of r.order) out[id] = { ...base, key: r.players[id].isSpymaster && !r.players[id].left ? key : null };
  out.watch = { ...base, key: null };
  return out;
}

/** When the referee must next be asked to move on (the clue or guess clock running out). */
export const dueOf = (r: Room): number | null => (r.phase === 'playing' && r.game && !r.ended ? r.game.phaseEndsAt : null);

/** Games won by each seat. */
export const scoresOf = (r: Room, seats: string[]) => seats.map((id) => r.played.filter((x) => x.teams[id] === x.winner).length);

/** Places for the match_players rows, in seat order: most games won first, ties share. */
export function onlineRanks(r: Room, seats: string[]): number[] {
  const s = scoresOf(r, seats);
  return s.map((x) => 1 + s.filter((y) => y > x).length);
}

/** CC2: winners 60 EXP and losers 20 for each game, at most 60 a match. */
export const expOf = (games: number, wins: number) => Math.min(60, 20 * games + 40 * wins);
