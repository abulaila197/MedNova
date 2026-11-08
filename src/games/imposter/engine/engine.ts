import { CLUE_MESSAGES, validateClue } from './clues';
import { RULES } from './constants';
import type { ProfanityChecker } from './profanity';
import type {
  ActionResult, GameAction, GameError, GameEvent, GameState, Mode, Player, Round, RoundSummary,
  Subtype, WordBank, WordEntry, WordPair,
} from './types';
import { isCorrectGuess } from './wordMatch';

/** Everything the engine needs from the outside, so the engine itself stays pure. */
export interface Env {
  now: number; // ms epoch
  rng: () => number; // [0, 1)
  bank: WordBank;
  profanity: ProfanityChecker;
  /** Pairs played before the bank, in order: a player's own words (My diseases). */
  first?: WordPair[];
}

type Fail = { error: GameError; persist?: boolean };
const fail = (code: string, message: string, persist = false): Fail => ({ error: { code, message }, persist });

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const randInt = (rng: () => number, n: number): number => Math.min(n - 1, Math.floor(rng() * n));
const pick = <T>(rng: () => number, arr: T[]): T => arr[randInt(rng, arr.length)];

const mkPlayer = (id: string, name: string): Player => ({
  id, name, connected: true, score: 0, credits: 0, profanityAttempts: 0,
});

export function createGame(opts: { roomId: string; mode: Mode; host: { id: string; name: string } }): GameState {
  return {
    version: 1,
    roomId: opts.roomId,
    mode: opts.mode,
    hostId: opts.host.id,
    players: [mkPlayer(opts.host.id, opts.host.name)],
    config: null,
    roundIndex: -1,
    usedPairIds: [],
    round: null,
    phase: { kind: 'lobby' },
    history: [],
    winners: null,
  };
}

// ---------------------------------------------------------------- helpers

const player = (s: GameState, id: string): Player | undefined => s.players.find((p) => p.id === id);
export const connectedCount = (s: GameState): number => s.players.filter((p) => p.connected).length;

/** Online: a player's vote/answer only counts while connected. Offline: everybody counts. */
const isCounted = (s: GameState, id: string): boolean => s.mode === 'offline' || !!player(s, id)?.connected;
const eligibleIds = (s: GameState): string[] => s.round!.participants.filter((id) => isCounted(s, id));

export const entryOf = (r: Round, playerId: string): WordEntry =>
  playerId === r.imposterId ? r.pair[r.imposterSide] : r.pair[r.imposterSide === 'a' ? 'b' : 'a'];

/** The word a player must see (hold-to-view offline, private message online). */
export function privateWord(s: GameState, playerId: string): string | null {
  const r = s.round;
  if (!r || !r.participants.includes(playerId)) return null;
  return entryOf(r, playerId).word;
}

const countedVotes = (s: GameState): Record<string, string> => {
  const r = s.round!;
  const out: Record<string, string> = {};
  for (const id of r.participants) {
    const t = r.votes[id];
    if (t && isCounted(s, id)) out[id] = t;
  }
  return out;
};

export function computeWinners(players: Player[]): string[] {
  if (!players.length) return [];
  const topScore = Math.max(...players.map((p) => p.score));
  let top = players.filter((p) => p.score === topScore);
  if (top.length > 1) {
    const topCredits = Math.max(...top.map((p) => p.credits));
    top = top.filter((p) => p.credits === topCredits);
  }
  return top.map((p) => p.id); // several ids = shared win
}

/** Offline: the device holder (host) confirms the spoken guess; the next player clockwise if the host is the imposter. */
function confirmerFor(s: GameState): string | null {
  if (s.mode === 'online') return null;
  const imp = s.round!.imposterId;
  if (s.hostId !== imp) return s.hostId;
  const n = s.players.length;
  const start = s.players.findIndex((p) => p.id === s.hostId);
  for (let k = 1; k <= n; k++) {
    const p = s.players[(start + k) % n];
    if (p.id !== imp) return p.id;
  }
  return null;
}

// ------------------------------------------------------- phase transitions

function startRound(s: GameState, env: Env, ev: GameEvent[]): void {
  const cfg = s.config!;
  let subtype: Subtype = cfg.subtype === 'mixed' ? (env.rng() < 0.5 ? 'clinical' : 'basic') : cfg.subtype;
  const own = env.first?.find((p) => !s.usedPairIds.includes(p.id));
  let pool = own ? [own] : env.bank.pairs.filter((p) => p.subtype === subtype && !s.usedPairIds.includes(p.id));
  if (own) subtype = own.subtype;
  if (!pool.length && cfg.subtype === 'mixed') {
    subtype = subtype === 'clinical' ? 'basic' : 'clinical';
    pool = env.bank.pairs.filter((p) => p.subtype === subtype && !s.usedPairIds.includes(p.id));
  }
  if (!pool.length) {
    endMatch(s, ev, 'bank-exhausted');
    return;
  }
  const pair = pick(env.rng, pool);
  const participants = s.players.filter((p) => p.connected).map((p) => p.id);
  const imposterId = pick(env.rng, participants);
  const start = randInt(env.rng, participants.length);
  const order = participants.slice(start).concat(participants.slice(0, start));
  s.roundIndex += 1;
  s.usedPairIds.push(pair.id);
  s.round = {
    index: s.roundIndex,
    pair,
    subtype,
    imposterId,
    imposterSide: env.rng() < 0.5 ? 'a' : 'b',
    participants,
    order,
    acks: [],
    clues: [],
    turn: 0,
    extraUsed: false,
    decisions: {},
    votes: {},
    voteLog: [],
    voteRound: 1,
    candidates: null,
    final: null,
  };
  s.phase = { kind: 'wordReveal', deadline: s.mode === 'online' ? env.now + RULES.wordRevealMs : null };
}

function startTurn(s: GameState, turn: number, env: Env, ev: GameEvent[]): void {
  s.round!.turn = turn;
  if (s.mode === 'offline') {
    s.phase = { kind: 'offlineTurn', turn };
    return;
  }
  enterSlot(s, turn, 0, env, ev);
}

/** Online: give the clue slot to the next connected player. Disconnected players are skipped at once (no pause). */
function enterSlot(s: GameState, turn: number, slot: number, env: Env, ev: GameEvent[]): void {
  const r = s.round!;
  for (let i = slot; i < r.order.length; i++) {
    const pid = r.order[i];
    if (player(s, pid)?.connected) {
      s.phase = { kind: 'clue', turn, slot: i, stage: 'typing', deadline: env.now + RULES.clueMs, reveal: null };
      return;
    }
    r.clues.push({ turn, playerId: pid, text: null });
  }
  finishTurn(s, turn, env, ev);
}

function finishTurn(s: GameState, turn: number, env: Env, ev: GameEvent[]): void {
  if (turn < RULES.obligatoryTurns) startTurn(s, turn + 1, env, ev);
  else if (turn === RULES.obligatoryTurns) {
    s.round!.decisions = {};
    s.phase = { kind: 'decision', deadline: s.mode === 'online' ? env.now + RULES.decisionMs : null };
  } else startVoteFlow(s, env);
}

function startVoteFlow(s: GameState, env: Env): void {
  if (s.mode === 'online') startVote(s, env, null);
  else s.phase = { kind: 'offlineDiscussion', deadline: env.now + RULES.offlineDiscussionMs };
}

function startVote(s: GameState, env: Env, revoteCandidates: string[] | null): void {
  const r = s.round!;
  r.votes = {};
  r.candidates = revoteCandidates;
  if (revoteCandidates) r.voteRound = 2;
  s.phase = { kind: 'vote', deadline: s.mode === 'online' ? env.now + RULES.voteMs : null, allVotedAt: null };
}

function resolveDecision(s: GameState, env: Env, ev: GameEvent[]): void {
  const r = s.round!;
  const el = eligibleIds(s);
  const voteNow = el.filter((id) => r.decisions[id] === 'vote').length;
  const extra = el.length - voteNow; // a tie or no answer means one more turn
  if (voteNow > extra) startVoteFlow(s, env);
  else {
    r.extraUsed = true;
    startTurn(s, RULES.obligatoryTurns + 1, env, ev);
  }
}

function resolveVote(s: GameState, env: Env, ev: GameEvent[]): void {
  const r = s.round!;
  r.final = { votes: countedVotes(s), voters: eligibleIds(s) };
  const counts: Record<string, number> = {};
  for (const t of Object.values(r.final.votes)) counts[t] = (counts[t] ?? 0) + 1;
  const entries = Object.entries(counts);
  if (!entries.length) return finishRound(s, 'not-caught', null, env, ev);
  const max = Math.max(...entries.map(([, n]) => n));
  const top = entries.filter(([, n]) => n === max).map(([id]) => id);
  if (top.length > 1) {
    if (r.voteRound === 1) {
      r.final = null;
      return startVote(s, env, top); // revote among the tied players
    }
    return finishRound(s, 'not-caught', null, env, ev); // second tie: the imposter wins
  }
  if (top[0] === r.imposterId) {
    s.phase = { kind: 'redemption', deadline: env.now + RULES.redemptionMs, confirmerId: confirmerFor(s), guessed: false };
    return;
  }
  finishRound(s, 'not-caught', null, env, ev);
}

function finishRound(
  s: GameState,
  outcome: RoundSummary['outcome'],
  redemptionCorrect: boolean | null,
  env: Env,
  ev: GameEvent[],
): void {
  const r = s.round!;
  const imp = r.imposterId;
  const votes = r.final?.votes ?? {};
  const voters = r.final?.voters ?? [];
  const others = r.participants.filter((id) => id !== imp);
  const deltas: Record<string, number> = {};
  const add = (id: string, n: number) => { deltas[id] = (deltas[id] ?? 0) + n; };
  let creditWinnerId: string | null = null;

  if (outcome === 'imposter-disconnected') {
    others.forEach((id) => add(id, RULES.points.othersWhenImposterDisconnects));
  } else {
    if (outcome === 'caught') {
      others.filter((id) => votes[id] === imp).forEach((id) => add(id, RULES.points.correctVoter));
      if (redemptionCorrect) add(imp, RULES.points.redemptionSuccess);
    } else {
      const wrong = others.filter((id) => voters.includes(id) && votes[id] !== imp);
      add(imp, RULES.points.imposterNotCaughtBase + wrong.length * RULES.points.imposterPerWrongVoter);
    }
    // tiebreak credit: earliest first vote for the true imposter in this round
    const first = r.voteLog.find((e) => e.target === imp && r.participants.includes(e.voter));
    if (first) {
      creditWinnerId = first.voter;
      const p = player(s, first.voter);
      if (p) p.credits += 1;
    }
  }
  for (const [id, n] of Object.entries(deltas)) {
    const p = player(s, id);
    if (p) p.score += n;
  }
  const impWord = r.pair[r.imposterSide].word;
  const majWord = r.pair[r.imposterSide === 'a' ? 'b' : 'a'].word;
  const summary: RoundSummary = {
    roundIndex: r.index,
    category: r.pair.category,
    pairId: r.pair.id,
    words: { a: r.pair.a.word, b: r.pair.b.word },
    imposterId: imp,
    imposterWord: impWord,
    majorityWord: majWord,
    outcome,
    redemptionCorrect,
    votes,
    deltas,
    creditWinnerId,
  };
  s.history.push(summary);
  s.phase = { kind: 'roundResult', deadline: s.mode === 'online' ? env.now + RULES.resultMs : null, summary };
  ev.push({ type: 'round-ended', summary });
}

const finishRedemption = (s: GameState, correct: boolean, env: Env, ev: GameEvent[]): void =>
  finishRound(s, 'caught', correct, env, ev);

function nextRound(s: GameState, env: Env, ev: GameEvent[]): void {
  if (s.roundIndex + 1 >= s.config!.rounds) return endMatch(s, ev, 'completed');
  if (connectedCount(s) < RULES.minPlayers) return endMatch(s, ev, 'too-few-players');
  startRound(s, env, ev);
}

function endMatch(s: GameState, ev: GameEvent[], reason: 'completed' | 'too-few-players' | 'bank-exhausted'): void {
  const winners = computeWinners(s.players);
  s.winners = winners;
  s.phase = { kind: 'matchEnd', winners };
  ev.push({ type: 'match-ended', winners, reason });
}

/**
 * Fewer than 3 players: a round whose vote is finished (redemption pending) is scored with the
 * redemption counted as not attempted; any other round in progress is discarded. Then the match ends.
 */
function abortMatch(s: GameState, env: Env, ev: GameEvent[]): void {
  const k = s.phase.kind;
  if (k === 'redemption') finishRedemption(s, false, env, ev);
  else if (k !== 'roundResult') s.round = null;
  endMatch(s, ev, 'too-few-players');
}

function transferHost(s: GameState, env: Env, ev: GameEvent[], leavingId: string): void {
  const options = s.players.filter((p) => p.connected && p.id !== leavingId);
  if (!options.length) return;
  s.hostId = pick(env.rng, options).id;
  ev.push({ type: 'host-changed', hostId: s.hostId });
}

// ------------------------------------------------------------------ timers

/** One pass over the timers and completion conditions. Returns true when something changed. */
function step(s: GameState, env: Env, ev: GameEvent[]): boolean {
  const ph = s.phase;
  const r = s.round;
  const now = env.now;
  switch (ph.kind) {
    case 'wordReveal': {
      if (!r) return false;
      // online: fixed 10 s, no Ready button. offline: continue when every player has seen their word.
      const everyoneSeen = s.mode === 'offline' && eligibleIds(s).every((id) => r.acks.includes(id));
      if (everyoneSeen || (ph.deadline !== null && now >= ph.deadline)) {
        startTurn(s, 1, env, ev);
        return true;
      }
      return false;
    }
    case 'clue': {
      if (!r || now < ph.deadline) return false;
      if (ph.stage === 'typing') {
        const rec = { turn: ph.turn, playerId: r.order[ph.slot], text: null };
        r.clues.push(rec);
        s.phase = { ...ph, stage: 'pause', deadline: now + RULES.pauseMs, reveal: rec };
      } else enterSlot(s, ph.turn, ph.slot + 1, env, ev);
      return true;
    }
    case 'decision': {
      if (!r) return false;
      const done = eligibleIds(s).every((id) => r.decisions[id]);
      if (done || (ph.deadline !== null && now >= ph.deadline)) {
        resolveDecision(s, env, ev);
        return true;
      }
      return false;
    }
    case 'offlineDiscussion': {
      if (now < ph.deadline) return false;
      startVote(s, env, null);
      return true;
    }
    case 'vote': {
      if (!r) return false;
      const el = eligibleIds(s);
      const everyoneVoted = el.length > 0 && el.every((id) => r.votes[id]);
      if (s.mode === 'offline') {
        if (everyoneVoted) { resolveVote(s, env, ev); return true; }
        return false;
      }
      if (everyoneVoted && ph.allVotedAt === null) {
        s.phase = { ...ph, allVotedAt: now };
        return true;
      }
      const countdownOver = ph.allVotedAt !== null && now >= ph.allVotedAt + RULES.voteCountdownMs;
      if (countdownOver || (ph.deadline !== null && now >= ph.deadline)) {
        resolveVote(s, env, ev);
        return true;
      }
      return false;
    }
    case 'redemption': {
      if (now < ph.deadline) return false;
      finishRedemption(s, false, env, ev);
      return true;
    }
    case 'roundResult': {
      if (ph.deadline !== null && now >= ph.deadline) {
        nextRound(s, env, ev);
        return true;
      }
      return false;
    }
    default:
      return false;
  }
}

function settle(s: GameState, env: Env, ev: GameEvent[]): void {
  for (let i = 0; i < 50 && step(s, env, ev); i++);
}

/** Earliest upcoming deadline, so a server can schedule a wake-up instead of polling. */
export function nextDeadline(s: GameState): number | null {
  const ph = s.phase;
  switch (ph.kind) {
    case 'wordReveal': case 'decision': case 'roundResult':
      return ph.deadline;
    case 'clue': case 'offlineDiscussion': case 'redemption':
      return ph.deadline;
    case 'vote': {
      const c = ph.allVotedAt !== null ? ph.allVotedAt + RULES.voteCountdownMs : null;
      if (c !== null && ph.deadline !== null) return Math.min(c, ph.deadline);
      return c ?? ph.deadline;
    }
    default:
      return null;
  }
}

/** Reactions (stickers, voice lines) are blocked only for the player who is currently typing. */
export function canReact(s: GameState, playerId: string): boolean {
  const ph = s.phase;
  return !(ph.kind === 'clue' && ph.stage === 'typing' && s.round?.order[ph.slot] === playerId);
}

// ----------------------------------------------------------------- actions

function handle(s: GameState, a: GameAction, env: Env, ev: GameEvent[]): Fail | null {
  const online = s.mode === 'online';
  const r = s.round;
  const ph = s.phase;

  switch (a.type) {
    case 'TICK':
      return null;

    case 'JOIN': {
      const existing = player(s, a.playerId);
      if (existing) { existing.connected = true; return null; }
      const between = ph.kind === 'lobby' || (online && ph.kind === 'roundResult');
      if (!between) return fail('join/closed', 'Players can only join between rounds.');
      if (s.players.length >= RULES.maxPlayers) return fail('join/full', 'The room is full.');
      const name = a.name.trim();
      if (!name) return fail('join/name', 'A name is required.');
      s.players.push(mkPlayer(a.playerId, name));
      return null;
    }

    case 'START_MATCH': {
      if (ph.kind !== 'lobby') return fail('start/phase', 'The match has already started.');
      if (online && a.playerId !== s.hostId) return fail('start/notHost', 'Only the host can start.');
      const n = connectedCount(s);
      if (n < RULES.minPlayers || n > RULES.maxPlayers) return fail('start/players', 'You need 3 to 6 players.');
      const { subtype, rounds } = a.config;
      if (!['clinical', 'basic', 'mixed'].includes(subtype)) return fail('start/config', 'Unknown subtype.');
      if (!Number.isInteger(rounds) || rounds < RULES.minRounds || rounds > RULES.maxRounds)
        return fail('start/config', 'Rounds must be 1 to 5.');
      const supply = env.bank.pairs.filter((p) => subtype === 'mixed' || p.subtype === subtype).length;
      if (supply < rounds) return fail('start/bank', 'Not enough word pairs for that many rounds.');
      s.config = { subtype, rounds };
      startRound(s, env, ev);
      return null;
    }

    case 'ACK_WORD': {
      if (online) return fail('mode', 'There is no Ready button online: the word is shown for 10 seconds.');
      if (ph.kind !== 'wordReveal' || !r) return fail('phase', 'Not the word reveal.');
      if (!r.participants.includes(a.playerId)) return fail('player', 'You are not in this round.');
      if (!r.acks.includes(a.playerId)) r.acks.push(a.playerId);
      return null;
    }

    case 'SUBMIT_CLUE': {
      if (!online) return fail('mode', 'Clues are spoken in offline mode.');
      if (ph.kind !== 'clue' || ph.stage !== 'typing' || !r) return fail('clue/notTyping', 'Nobody is typing a clue now.');
      if (r.order[ph.slot] !== a.playerId) return fail('clue/notYourTurn', 'It is not your turn.');
      const check = validateClue(a.text, { own: entryOf(r, a.playerId), prior: r.clues.map((c) => c.text), profanity: env.profanity });
      if (!check.ok) {
        const profane = check.code === 'clue/profanity';
        if (profane) {
          const p = player(s, a.playerId)!;
          p.profanityAttempts += 1;
          if (p.profanityAttempts === RULES.profanityNotifyAfter && p.id !== s.hostId)
            ev.push({ type: 'profanity-threshold', playerId: p.id, notifyId: s.hostId });
        }
        return fail(check.code, CLUE_MESSAGES[check.code], profane);
      }
      const rec = { turn: ph.turn, playerId: a.playerId, text: check.text };
      r.clues.push(rec);
      s.phase = { ...ph, stage: 'pause', deadline: env.now + RULES.pauseMs, reveal: rec }; // early submit skips the rest of the 30 s
      return null;
    }

    case 'NEXT_TURN': {
      if (online) return fail('mode', 'Offline only.');
      if (ph.kind !== 'offlineTurn') return fail('phase', 'Not a clue turn.');
      finishTurn(s, ph.turn, env, ev);
      return null;
    }

    case 'DECIDE': {
      if (ph.kind !== 'decision' || !r) return fail('phase', 'Not the decision.');
      if (!r.participants.includes(a.playerId)) return fail('player', 'You are not in this round.');
      if (!online && r.decisions[a.playerId]) return fail('decide/final', 'Already decided.');
      r.decisions[a.playerId] = a.choice;
      return null;
    }

    case 'SKIP_DISCUSSION': {
      if (online) return fail('mode', 'Offline only.');
      if (ph.kind !== 'offlineDiscussion') return fail('phase', 'Not the discussion.');
      s.phase = { ...ph, deadline: env.now };
      return null;
    }

    case 'CAST_VOTE': {
      if (ph.kind !== 'vote' || !r) return fail('phase', 'Not the vote.');
      if (!r.participants.includes(a.playerId) || !r.participants.includes(a.target)) return fail('vote/invalid', 'Unknown player.');
      if (a.playerId === a.target) return fail('vote/self', 'You cannot vote for yourself.');
      if (r.candidates && !r.candidates.includes(a.target)) return fail('vote/notCandidate', 'Vote for one of the tied players.');
      if (online && !player(s, a.playerId)?.connected) return fail('vote/offline', 'You are disconnected.');
      if (!online && r.votes[a.playerId]) return fail('vote/final', 'Votes are final offline.');
      if (r.votes[a.playerId] !== a.target) {
        r.votes[a.playerId] = a.target;
        r.voteLog.push({ voter: a.playerId, target: a.target, at: env.now });
      }
      return null;
    }

    case 'SUBMIT_GUESS': {
      if (!online) return fail('mode', 'Offline guesses are spoken and confirmed by the device holder.');
      if (ph.kind !== 'redemption' || !r) return fail('phase', 'Not the redemption.');
      if (a.playerId !== r.imposterId) return fail('guess/notImposter', 'Only the caught imposter guesses.');
      if (ph.guessed) return fail('guess/used', 'You only get one attempt.');
      if (env.profanity.isProfane(a.text)) {
        const p = player(s, a.playerId)!;
        p.profanityAttempts += 1;
        if (p.profanityAttempts === RULES.profanityNotifyAfter && p.id !== s.hostId)
          ev.push({ type: 'profanity-threshold', playerId: p.id, notifyId: s.hostId });
        return fail('guess/profanity', 'That word is not allowed.', true);
      }
      const maj = r.pair[r.imposterSide === 'a' ? 'b' : 'a'];
      const own = r.pair[r.imposterSide];
      s.phase = { ...ph, guessed: true };
      finishRedemption(s, isCorrectGuess(a.text, maj, own), env, ev);
      return null;
    }

    case 'CONFIRM_GUESS': {
      if (online) return fail('mode', 'Offline only.');
      if (ph.kind !== 'redemption') return fail('phase', 'Not the redemption.');
      if (a.playerId !== ph.confirmerId) return fail('guess/notConfirmer', 'Another player confirms the guess.');
      finishRedemption(s, a.correct, env, ev);
      return null;
    }

    case 'NEXT_ROUND': {
      if (ph.kind !== 'roundResult') return fail('phase', 'Not between rounds.');
      if (online && a.playerId !== s.hostId) return fail('next/notHost', 'Only the host continues.');
      nextRound(s, env, ev);
      return null;
    }

    case 'PLAYER_DISCONNECTED': {
      if (!online) return fail('mode', 'Online only.');
      const p = player(s, a.playerId);
      if (!p) return fail('player', 'Unknown player.');
      if (ph.kind === 'lobby') {
        s.players = s.players.filter((x) => x.id !== p.id);
        if (s.hostId === p.id) {
          if (s.players.length) { s.hostId = pick(env.rng, s.players).id; ev.push({ type: 'host-changed', hostId: s.hostId }); }
        }
        return null;
      }
      p.connected = false;
      if (s.hostId === p.id) transferHost(s, env, ev, p.id);
      if (r && p.id === r.imposterId) {
        if (['wordReveal', 'clue', 'decision', 'vote'].includes(ph.kind)) finishRound(s, 'imposter-disconnected', null, env, ev);
        else if (ph.kind === 'redemption') finishRedemption(s, false, env, ev);
      }
      if (connectedCount(s) < RULES.minPlayers && s.phase.kind !== 'matchEnd') abortMatch(s, env, ev);
      return null;
    }

    case 'PLAYER_RECONNECTED': {
      if (!online) return fail('mode', 'Online only.');
      const p = player(s, a.playerId);
      if (!p) return fail('player', 'Unknown player.');
      p.connected = true;
      return null;
    }
  }
}

/**
 * The one entry point. Pure: the same state, action and env always give the same result.
 * `playerId` inside an action is trusted here; the server layer must set it from the authenticated user.
 */
export function reduce(state: GameState, action: GameAction, env: Env): ActionResult {
  const events: GameEvent[] = [];
  const settled = clone(state);
  settle(settled, env, events);
  const next = clone(settled);
  const out = handle(next, action, env, events);
  if (out && !out.persist) return { state: settled, events, error: out.error };
  settle(next, env, events);
  return { state: next, events, error: out ? out.error : null };
}
