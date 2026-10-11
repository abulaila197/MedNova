// The Conqueror core: one online match as a pure reducer (CQ1-CQ12 in build/shared-rules.md).
// Ported from Yazan's stateMachine.ts, combatResolver.ts, breakingDuel.ts and botLogic.ts.
// Timers live on the server: it sends { type: 'timeout' } when a phase's clock runs out.

import { indexNames, nameKey, nameKeys, searchNames, type NameIndex } from '../shell/names';
import {
  draw, SOLO_STYLES, TILE_ITEMS,
  type Bank, type ClosestQ, type ClueQ, type Mix, type Named, type Rng, type RushQ, type SoloQ, type SoloStyle, type StandingQ, type TfQ,
} from './bank';
import { shuffle } from '../engine/random';

export const BALANCE = {
  BOARD_PICK_SECONDS: 10,
  SOLO_QUESTION_SECONDS: 45,
  CLOSEST_SECONDS: 15,
  RUSH_SECONDS: 50,
  STANDING_SECONDS: 15,
  CLUE_INTERVAL_SECONDS: 8,
  GAP_CARDS_SECONDS: 40,
  GAP_MOVES_SECONDS: 75,
  DUEL_SECONDS: 6,

  TROOPS_PER_POINT: 1000,
  START_OUTPOST_TROOPS: 10000,
  START_CAPITAL_TROOPS: 30000,
  MIN_MOVE_TROOPS: 1000,
  MAX_MOVES: 2,
  MAX_STAGES: 6, // CQ4
  FAILED_TILE_PENALTY: 1000,
  REVOLUTION_TROOPS: 5000,

  TILES: 60,
  /** 11 card tiles so all 11 cards are on every board (CQ15). */
  CARD_TILES: 11,

  CLOSEST_ITEMS: 3,
  STANDING_HEARTS: 2,
  STANDING_MAX_QUESTIONS: 10,
  CLUE_MYSTERIES: 2,
  /** Clue ladder: solved on clue 1/2/3/4, minus 5 per wrong guess (his -5). */
  CLUE_SCORES: [40, 30, 20, 10],
  CLUE_WRONG_PENALTY: 5,
  DUEL_QUESTIONS: 3,
  /** Versus payout in points: 1st 5, 2nd 2 (his Last one standing; all 4 styles, CQ13). */
  VERSUS_PAYOUT: [5, 2],
  /** CQ12: away for this many full stages = removed. */
  AWAY_STAGES_LIMIT: 2,

  SUGGEST_MIN_LETTERS: 4,
  SUGGEST_MAX: 3,
} as const;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6; // CQ2

export type CardType =
  | 'double_attack' | 'shield' | 'spy' | 'trap' | 'reinforcements' | 'ambush'
  | 'earthquake' | 'revolution' | 'betrayal' | 'joker' | 'hide_troops';

export const CARDS: Record<CardType, { name: string; text: string }> = {
  double_attack: { name: 'Double attack', text: 'One extra troop move this Gap.' },
  shield: { name: 'Shield', text: 'Attacks on one of your lands bounce back this stage.' },
  spy: { name: 'Spy', text: "See every player's reserve troops and the cards played this Gap." },
  trap: { name: 'Trap', text: 'The biggest force attacking one of your lands loses half its troops.' },
  reinforcements: { name: 'Reinforcements', text: 'One troop move gets +50%.' },
  ambush: { name: 'Ambush', text: 'One player gets one move fewer this Gap.' },
  earthquake: { name: 'Earthquake', text: "Every other player's non-capital lands lose 20% of their troops." },
  revolution: { name: 'Revolution', text: '+5,000 troops on one of your lands, if you hold fewer lands than average.' },
  betrayal: { name: 'Betrayal', text: "Take one of your ally's non-capital lands and end the alliance." },
  joker: { name: 'Joker', text: 'Switch your solo tile to another question style.' },
  hide_troops: { name: 'Hide troops', text: 'Your troop counts are hidden from others this stage.' },
};
export const CARD_TYPES = Object.keys(CARDS) as CardType[];

export type VersusStyle = 'closest' | 'rush' | 'standing' | 'clue';
export const VERSUS_STYLES: VersusStyle[] = ['closest', 'rush', 'standing', 'clue'];

export type Phase = 'solo_pick' | 'solo_play' | 'versus' | 'gap_cards' | 'gap_moves' | 'duel' | 'over';

export type Player = {
  id: string;
  name: string;
  color: string;
  reserve: number;
  cards: CardType[];
  ally: string | null;
  /** Eliminated (capital fell, or away too long): a spectator from then on. */
  out: boolean;
  outOrder?: number;
  outReason?: 'capital' | 'away';
  connected: boolean;
  /** CQ12: full stages in a row spent disconnected. */
  awayStages: number;
  awayThisStage: boolean;
  /** `right` counts every right answer in solo, versus and duels (EXP, Scholar's share). */
  stats: { attempted: number; correct: number; captured: number; right: number };
};

export type Land = { id: string; name: string; owner: string | null; capital: boolean; troops: number; shielded: boolean; trapped: boolean; hidden: boolean };

export type Tile = { n: number; kind: 'question' | 'card'; style?: SoloStyle; card?: CardType; by: string | null };

export type SoloTurn = {
  tile: number;
  /** A card tile gives a card and no questions. */
  card?: CardType;
  style?: SoloStyle;
  questions: SoloQ[];
  result?: { correct: number; total: number; points: number; penalty: number };
};

/** One player's solo answers: MCQ = chosen indices, TF = booleans, Order = items in order, Match = right side per left. */
export type SoloAnswers = number[] | boolean[] | string[];

export type Versus =
  | { style: 'closest'; items: ClosestQ[]; guesses: Record<string, ({ value: number; ms: number } | null)[]> }
  | { style: 'rush'; q: RushQ; found: Record<string, { label: string; ms: number }[]> }
  | {
      style: 'standing';
      qs: StandingQ[];
      index: number;
      hearts: Record<string, number>;
      answers: Record<string, { picks: number[]; ms: number }>;
      /** Time spent on right answers, the tie-break. */
      ms: Record<string, number>;
      /** When each player lost their last heart (question number), for ranking. */
      outAt: Record<string, number>;
    }
  | { style: 'clue'; qs: ClueQ[]; solved: Record<string, (number | null)[]>; wrong: Record<string, number>; ms: Record<string, number> };

export type VersusResult = { style: VersusStyle; ranking: string[]; points: Record<string, number> };

export type Move = { from: string | null; to: string; troops: number; reinforce?: boolean };
export type PlayedCard = { by: string; card: CardType; land?: string; player?: string };
export type Proposal = { from: string; to: string; status: 'pending' | 'accepted' | 'declined' };

export type Duel = {
  land: string;
  p1: string;
  p2: string;
  t1: number;
  t2: number;
  questions: TfQ[];
  a1: { right: boolean; ms: number }[];
  a2: { right: boolean; ms: number }[];
};

export type Match = {
  mix: Mix;
  stage: number;
  round: 1 | 2;
  phase: Phase;
  order: string[];
  players: Record<string, Player>;
  lands: Record<string, Land>;
  landOrder: string[];
  board: Tile[];
  solo: Record<string, SoloTurn>;
  versus: Versus | null;
  versusHistory: VersusStyle[];
  lastVersus: VersusResult | null;
  gap: { cards: PlayedCard[]; proposals: Proposal[]; moves: Record<string, Move[]>; ready: string[] };
  duels: Duel[];
  duelIndex: number;
  used: string[];
  log: string[];
  winner: string | null;
  /** The last solo round's tiles, kept for the tally screen. */
  lastSolo?: Record<string, SoloTurn>;
};

export type Action =
  | { type: 'timeout' }
  | { type: 'pick'; player: string; tile: number }
  | { type: 'joker'; player: string; style: SoloStyle }
  | { type: 'solo'; player: string; answers: SoloAnswers }
  | { type: 'closest'; player: string; item: number; value: number; ms: number }
  | { type: 'rush'; player: string; text: string; ms: number }
  | { type: 'standing'; player: string; picks: number[]; ms: number }
  | { type: 'clue'; player: string; mystery: number; text: string; clue: number; ms: number }
  | { type: 'card'; player: string; card: CardType; land?: string; target?: string }
  | { type: 'propose'; from: string; to: string }
  | { type: 'respond'; from: string; to: string; accept: boolean }
  | { type: 'ready'; player: string }
  | { type: 'moves'; player: string; moves: Move[] }
  | { type: 'duel'; player: string; answer: boolean; ms: number }
  | { type: 'connection'; player: string; connected: boolean };

export type Ctx = { bank: Bank; rng: Rng };

// ---------------------------------------------------------------- setup

export const active = (m: Match) => m.order.map((id) => m.players[id]).filter((p) => !p.out);
export const landsOf = (m: Match, id: string) => m.landOrder.map((l) => m.lands[l]).filter((l) => l.owner === id);
export const accuracy = (p: Player) => (p.stats.attempted ? p.stats.correct / p.stats.attempted : 0);
export const totalTroops = (m: Match, id: string) => m.players[id].reserve + landsOf(m, id).reduce((s, l) => s + l.troops, 0);

/** A fresh shuffled board: 60 tiles, card tiles hold the cards (all 11 when there are 11 tiles), the rest share the 4 solo styles evenly. */
export function makeBoard(rng: Rng): Tile[] {
  const cards = shuffle(CARD_TYPES, rng);
  const cardSlots = BALANCE.CARD_TILES;
  const kinds: Omit<Tile, 'n' | 'by'>[] = [];
  for (let i = 0; i < cardSlots; i++) kinds.push({ kind: 'card', card: cards[i % cards.length] });
  for (let i = 0; i < BALANCE.TILES - cardSlots; i++) kinds.push({ kind: 'question', style: SOLO_STYLES[i % SOLO_STYLES.length] });
  return shuffle(kinds, rng).map((k, i) => ({ ...k, n: i + 1, by: null }));
}

/** Each player starts with a capital (30,000) and 2 outposts (10,000 each); no neutral lands (his code). */
export function startMatch(list: { id: string; name: string; color: string }[], mix: Mix, rng: Rng): Match {
  if (list.length < MIN_PLAYERS || list.length > MAX_PLAYERS) throw new Error(`The Conqueror needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players`);
  const players: Record<string, Player> = {};
  const lands: Record<string, Land> = {};
  const landOrder: string[] = [];
  let n = 1;
  const addLand = (owner: string, name: string, capital: boolean) => {
    const id = `land_${n++}`;
    lands[id] = { id, name, owner, capital, troops: capital ? BALANCE.START_CAPITAL_TROOPS : BALANCE.START_OUTPOST_TROOPS, shielded: false, trapped: false, hidden: false };
    landOrder.push(id);
  };
  for (const p of list) {
    players[p.id] = {
      ...p, reserve: 0, cards: [], ally: null, out: false, connected: true, awayStages: 0, awayThisStage: false,
      stats: { attempted: 0, correct: 0, captured: 0, right: 0 },
    };
    addLand(p.id, `${p.name}'s Capital`, true);
    addLand(p.id, `${p.name}'s Outpost 1`, false);
    addLand(p.id, `${p.name}'s Outpost 2`, false);
  }
  return {
    mix, stage: 1, round: 1, phase: 'solo_pick', order: list.map((p) => p.id), players, lands, landOrder,
    board: makeBoard(rng), solo: {}, versus: null, versusHistory: [], lastVersus: null,
    gap: { cards: [], proposals: [], moves: {}, ready: [] }, duels: [], duelIndex: 0, used: [], log: ['Stage 1'], winner: null,
  };
}

// ---------------------------------------------------------------- typed answers

function editDistance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[a.length][b.length];
}

/** His tolerance: 1 typo for names under 6 letters, 2 otherwise; only the main name and its 2 other names count (NL1). */
export function typedMatches(text: string, n: Named) {
  const k = nameKey(text);
  if (!k) return false;
  return nameKeys(n).some((t) => k === t || editDistance(k, t) <= (t.length < 6 ? 1 : 2));
}

/** Type-ahead chips after 4 letters, up to 3, drawn from a whole style's answers so they don't give the round away. */
export const suggest = (index: NameIndex<Named>, text: string) => searchNames(index, text, { min: BALANCE.SUGGEST_MIN_LETTERS, max: BALANCE.SUGGEST_MAX });
export const clueIndex = (bank: Bank) => indexNames(bank.byStyle.clue.map((q) => q.answer));

// ---------------------------------------------------------------- reducer

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

export function step(prev: Match, a: Action, ctx: Ctx): Match {
  if (prev.phase === 'over') return prev;
  const m = clone(prev);
  const used = new Set(m.used);
  const out = reduce(m, a, ctx, used);
  if (!out) return prev;
  m.used = [...used];
  return m;
}

/** Returns false when the action is not allowed (the match stays as it was). */
function reduce(m: Match, a: Action, ctx: Ctx, used: Set<string>): boolean {
  const p = 'player' in a ? m.players[a.player] : undefined;
  if ('player' in a && (!p || (p.out && a.type !== 'connection'))) return false;
  switch (a.type) {
    case 'connection': {
      p!.connected = a.connected;
      if (a.connected) p!.awayThisStage = false;
      return true;
    }
    case 'timeout':
      return onTimeout(m, ctx, used);
    case 'pick': {
      if (m.phase !== 'solo_pick' || m.solo[a.player]) return false;
      const tile = m.board.find((t) => t.n === a.tile);
      if (!tile || tile.by) return false;
      takeTile(m, a.player, tile, ctx, used);
      if (active(m).filter((x) => x.connected).every((x) => m.solo[x.id])) m.phase = 'solo_play';
      return true;
    }
    case 'joker': {
      const turn = m.solo[a.player];
      if (m.phase !== 'solo_play' || !turn || turn.card || turn.result || turn.style === a.style || !p!.cards.includes('joker')) return false;
      p!.cards.splice(p!.cards.indexOf('joker'), 1);
      turn.style = a.style;
      turn.questions = draw(ctx.bank, a.style, TILE_ITEMS[a.style], m.mix, used, ctx.rng);
      m.log.push(`${p!.name} used Joker`);
      return true;
    }
    case 'solo': {
      const turn = m.solo[a.player];
      if (m.phase !== 'solo_play' || !turn || turn.card || turn.result) return false;
      scoreSolo(p!, turn, a.answers);
      if (soloDone(m)) endSolo(m, ctx, used);
      return true;
    }
    case 'closest': {
      const v = m.versus;
      if (m.phase !== 'versus' || v?.style !== 'closest' || a.item < 0 || a.item >= v.items.length || v.guesses[a.player]?.[a.item]) return false;
      (v.guesses[a.player] ??= v.items.map(() => null))[a.item] = { value: a.value, ms: a.ms };
      if (active(m).filter((x) => x.connected).every((x) => v.guesses[x.id]?.every(Boolean))) finishVersus(m);
      return true;
    }
    case 'rush': {
      const v = m.versus;
      if (m.phase !== 'versus' || v?.style !== 'rush') return false;
      const hit = v.q.answers.find((n) => typedMatches(a.text, n));
      const found = (v.found[a.player] ??= []);
      if (!hit || found.some((f) => f.label === hit.label)) return false;
      found.push({ label: hit.label, ms: a.ms });
      p!.stats.right++;
      return true;
    }
    case 'standing': {
      const v = m.versus;
      if (m.phase !== 'versus' || v?.style !== 'standing' || !(v.hearts[a.player] > 0) || v.answers[a.player]) return false;
      v.answers[a.player] = { picks: [...new Set(a.picks)].sort((x, y) => x - y), ms: a.ms };
      if (Object.keys(v.hearts).filter((id) => v.hearts[id] > 0 && m.players[id].connected).every((id) => v.answers[id])) nextStanding(m);
      return true;
    }
    case 'clue': {
      const v = m.versus;
      if (m.phase !== 'versus' || v?.style !== 'clue' || a.mystery < 0 || a.mystery >= v.qs.length || a.clue < 1 || a.clue > 4) return false;
      const solved = (v.solved[a.player] ??= v.qs.map(() => null));
      if (solved[a.mystery] !== null) return false;
      if (typedMatches(a.text, v.qs[a.mystery].answer)) {
        solved[a.mystery] = a.clue;
        p!.stats.right++;
        v.ms[a.player] = (v.ms[a.player] ?? 0) + a.ms;
      } else v.wrong[a.player] = (v.wrong[a.player] ?? 0) + 1;
      if (active(m).filter((x) => x.connected).every((x) => v.solved[x.id]?.every((s) => s !== null))) finishVersus(m);
      return true;
    }
    case 'card':
      return m.phase === 'gap_cards' && playCard(m, p!, a);
    case 'propose': {
      const from = m.players[a.from];
      const to = m.players[a.to];
      // CQ8: alliances only in the Gap, one ally at a time, none once 2 players are left.
      if (m.phase !== 'gap_cards' || !from || !to || from.out || to.out || a.from === a.to || active(m).length <= 2 || from.ally || to.ally) return false;
      if (m.gap.proposals.some((x) => x.status === 'pending' && x.from === a.from && x.to === a.to)) return false;
      m.gap.proposals.push({ from: a.from, to: a.to, status: 'pending' });
      return true;
    }
    case 'respond': {
      const pr = m.gap.proposals.find((x) => x.from === a.from && x.to === a.to && x.status === 'pending');
      if (m.phase !== 'gap_cards' || !pr) return false;
      const from = m.players[a.from];
      const to = m.players[a.to];
      if (a.accept && (from.ally || to.ally)) return false;
      pr.status = a.accept ? 'accepted' : 'declined';
      if (a.accept) {
        from.ally = to.id;
        to.ally = from.id;
        m.log.push(`${from.name} and ${to.name} are allies this stage`);
      }
      return true;
    }
    case 'ready': {
      if ((m.phase !== 'gap_cards' && m.phase !== 'gap_moves') || m.gap.ready.includes(a.player)) return false;
      m.gap.ready.push(a.player);
      if (active(m).filter((x) => x.connected).every((x) => m.gap.ready.includes(x.id))) {
        if (m.phase === 'gap_cards') toMoves(m);
        else battle(m, ctx, used);
      }
      return true;
    }
    case 'moves': {
      if (m.phase !== 'gap_moves' || m.gap.moves[a.player]) return false;
      const moves = validMoves(m, p!, a.moves);
      if (!moves) return false;
      m.gap.moves[a.player] = moves;
      if (!m.gap.ready.includes(a.player)) m.gap.ready.push(a.player);
      if (active(m).filter((x) => x.connected).every((x) => m.gap.ready.includes(x.id))) battle(m, ctx, used);
      return true;
    }
    case 'duel': {
      const d = m.duels[m.duelIndex];
      if (m.phase !== 'duel' || !d || (a.player !== d.p1 && a.player !== d.p2)) return false;
      const answers = a.player === d.p1 ? d.a1 : d.a2;
      if (answers.length >= d.questions.length) return false;
      const ok = a.answer === d.questions[answers.length].answer;
      answers.push({ right: ok, ms: a.ms });
      if (ok) p!.stats.right++;
      if (d.a1.length >= d.questions.length && d.a2.length >= d.questions.length) finishDuel(m, ctx, used);
      return true;
    }
  }
}

// ---------------------------------------------------------------- solo rounds

function takeTile(m: Match, id: string, tile: Tile, ctx: Ctx, used: Set<string>) {
  tile.by = id;
  if (tile.kind === 'card') {
    m.players[id].cards.push(tile.card!);
    m.solo[id] = { tile: tile.n, card: tile.card, questions: [] };
  } else {
    m.solo[id] = { tile: tile.n, style: tile.style, questions: draw(ctx.bank, tile.style!, TILE_ITEMS[tile.style!], m.mix, used, ctx.rng) };
  }
}

/** How many items were right: MCQ/TF per question; Order per position; Match per pair. */
export function soloCorrect(turn: SoloTurn, answers: SoloAnswers): { correct: number; total: number } {
  const qs = turn.questions;
  switch (turn.style) {
    case 'mcq':
      return { correct: qs.filter((q, i) => q.style === 'mcq' && answers[i] === q.answer).length, total: qs.length };
    case 'tf':
      return { correct: qs.filter((q, i) => q.style === 'tf' && answers[i] === q.answer).length, total: qs.length };
    case 'order': {
      const q = qs[0];
      if (q?.style !== 'order') return { correct: 0, total: 5 };
      return { correct: q.items.filter((item, i) => answers[i] === item).length, total: q.items.length };
    }
    case 'match': {
      const q = qs[0];
      if (q?.style !== 'match') return { correct: 0, total: 5 };
      return { correct: q.pairs.filter(([, right], i) => answers[i] === right).length, total: q.pairs.length };
    }
    default:
      return { correct: 0, total: 0 };
  }
}

/** CQ5: MCQ/TF 3/3 = 2 pts, 2/3 = 1 pt, else -1,000; Order/Match 5/5 = 3 pts, 3-4 = 2 pts, else -1,000. 1 pt = 1,000 reserve troops. */
export function soloPoints(style: SoloStyle, correct: number): number | 'penalty' {
  if (style === 'mcq' || style === 'tf') return correct === 3 ? 2 : correct === 2 ? 1 : 'penalty';
  return correct === 5 ? 3 : correct >= 3 ? 2 : 'penalty';
}

function scoreSolo(p: Player, turn: SoloTurn, answers: SoloAnswers) {
  const { correct, total } = soloCorrect(turn, answers);
  const pts = soloPoints(turn.style!, correct);
  const penalty = pts === 'penalty' ? Math.min(p.reserve, BALANCE.FAILED_TILE_PENALTY) : 0;
  const points = pts === 'penalty' ? 0 : pts;
  p.reserve += points * BALANCE.TROOPS_PER_POINT - penalty;
  p.stats.attempted += total;
  p.stats.correct += correct;
  p.stats.right += correct;
  turn.result = { correct, total, points, penalty };
}

const soloDone = (m: Match) => active(m).filter((x) => x.connected).every((x) => m.solo[x.id] && (m.solo[x.id].card || m.solo[x.id].result));

function endSolo(m: Match, ctx: Ctx, used: Set<string>) {
  m.lastSolo = m.solo;
  if (m.round === 1) {
    m.round = 2;
    m.solo = {};
    m.phase = 'solo_pick';
    return;
  }
  startVersus(m, ctx, used);
}

// ---------------------------------------------------------------- versus round

/** CQ6: one of the 4 styles at random, never the same style twice in a row. */
export function pickVersusStyle(last: VersusStyle | undefined, rng: Rng): VersusStyle {
  const options = VERSUS_STYLES.filter((s) => s !== last);
  return options[Math.floor(rng() * options.length)];
}

function startVersus(m: Match, ctx: Ctx, used: Set<string>) {
  const style = pickVersusStyle(m.versusHistory[m.versusHistory.length - 1], ctx.rng);
  m.versusHistory.push(style);
  m.phase = 'versus';
  m.solo = {};
  const ids = active(m).map((x) => x.id);
  if (style === 'closest') m.versus = { style, items: draw(ctx.bank, 'closest', BALANCE.CLOSEST_ITEMS, m.mix, used, ctx.rng), guesses: {} };
  else if (style === 'rush') m.versus = { style, q: draw(ctx.bank, 'rush', 1, m.mix, used, ctx.rng)[0], found: {} };
  else if (style === 'clue') m.versus = { style, qs: draw(ctx.bank, 'clue', BALANCE.CLUE_MYSTERIES, m.mix, used, ctx.rng), solved: {}, wrong: {}, ms: {} };
  else
    m.versus = {
      style, qs: draw(ctx.bank, 'standing', BALANCE.STANDING_MAX_QUESTIONS, m.mix, used, ctx.rng), index: 0,
      hearts: Object.fromEntries(ids.map((id) => [id, BALANCE.STANDING_HEARTS])), answers: {}, ms: {}, outAt: {},
    };
}

/**
 * Last one standing (his code, now judged on the bank's own right answers): a wrong or missing answer loses a heart;
 * when every living player is right, the slowest loses one. Ends with 1 player left or after 10 questions.
 */
function nextStanding(m: Match) {
  const v = m.versus;
  if (v?.style !== 'standing') return;
  const q = v.qs[v.index];
  const living = Object.keys(v.hearts).filter((id) => v.hearts[id] > 0);
  const right: { id: string; ms: number }[] = [];
  for (const id of living) {
    const ans = v.answers[id];
    if (ans && ans.picks.length === q.answers.length && ans.picks.every((x, i) => x === q.answers[i])) {
      right.push({ id, ms: ans.ms });
      m.players[id].stats.right++;
      v.ms[id] = (v.ms[id] ?? 0) + ans.ms;
    } else v.hearts[id]--;
  }
  if (right.length === living.length && living.length > 1) {
    const slowest = [...right].sort((x, y) => y.ms - x.ms)[0];
    v.hearts[slowest.id]--;
  }
  for (const id of living) if (v.hearts[id] <= 0 && v.outAt[id] === undefined) v.outAt[id] = v.index;
  const alive = Object.keys(v.hearts).filter((id) => v.hearts[id] > 0);
  if (alive.length <= 1 || v.index >= v.qs.length - 1) return finishVersus(m);
  v.index++;
  v.answers = {};
}

/** Ranks the versus round (best first). Ties go to the faster player (CQ22); only identical results keep seat order. */
export function versusRanking(m: Match): string[] {
  const v = m.versus!;
  const ids = active(m).map((x) => x.id);
  const by = (score: (id: string) => number[]) =>
    [...ids].sort((x, y) => {
      const a = score(x);
      const b = score(y);
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
      return 0;
    });
  switch (v.style) {
    case 'closest': {
      // Closest guess wins each item (ties share it); then the smaller total miss, relative to the answer.
      const wins: Record<string, number> = {};
      const miss: Record<string, number> = {};
      const ms = (id: string) => (v.guesses[id] ?? []).reduce((a, g) => a + (g?.ms ?? 0), 0);
      v.items.forEach((q, i) => {
        const dist = (id: string) => {
          const g = v.guesses[id]?.[i];
          return g ? Math.abs(g.value - q.answer) / Math.max(1, Math.abs(q.answer)) : Infinity;
        };
        const best = Math.min(...ids.map(dist));
        for (const id of ids) {
          if (dist(id) === best && best !== Infinity) wins[id] = (wins[id] ?? 0) + 1;
          miss[id] = (miss[id] ?? 0) + Math.min(dist(id), 1e9);
        }
      });
      return by((id) => [wins[id] ?? 0, -(miss[id] ?? 0), -ms(id)]);
    }
    case 'rush':
      return by((id) => {
        const f = v.found[id] ?? [];
        return [f.length, -(f[f.length - 1]?.ms ?? 0)];
      });
    case 'standing':
      return by((id) => [v.hearts[id] ?? 0, v.outAt[id] ?? 99, -(v.ms[id] ?? 0)]);
    case 'clue':
      return by((id) => [clueScore(v, id), -(v.ms[id] ?? 0)]);
  }
}

/** CQ22: whether a player got anything right this versus round; a player who didn't is never paid. */
export function versusScored(v: Versus, id: string): boolean {
  switch (v.style) {
    case 'closest':
      return v.items.some((q, i) => {
        const dist = (x: string) => {
          const g = v.guesses[x]?.[i];
          return g ? Math.abs(g.value - q.answer) : Infinity;
        };
        const best = Math.min(...Object.keys(v.guesses).map(dist));
        return best !== Infinity && dist(id) === best;
      });
    case 'rush':
      return (v.found[id] ?? []).length > 0;
    case 'standing':
      return v.ms[id] !== undefined; // set on each right answer
    case 'clue':
      return clueScore(v, id) > 0;
  }
}

export function clueScore(v: Extract<Versus, { style: 'clue' }>, id: string) {
  const solved = (v.solved[id] ?? []).reduce<number>((s, c) => s + (c ? BALANCE.CLUE_SCORES[c - 1] : 0), 0);
  return solved - (v.wrong[id] ?? 0) * BALANCE.CLUE_WRONG_PENALTY;
}

function finishVersus(m: Match) {
  const ranking = versusRanking(m);
  // Closest number: the closest guess on an item (ties share it) counts as a right answer.
  const v = m.versus;
  if (v?.style === 'closest')
    v.items.forEach((q, i) => {
      const dist = (id: string) => {
        const g = v.guesses[id]?.[i];
        return g ? Math.abs(g.value - q.answer) : Infinity;
      };
      const best = Math.min(...active(m).map((x) => dist(x.id)));
      if (best !== Infinity) for (const x of active(m)) if (dist(x.id) === best) x.stats.right++;
    });
  const points: Record<string, number> = {};
  const paid = ranking.filter((id) => versusScored(m.versus!, id)); // CQ22: no payout for nothing right
  BALANCE.VERSUS_PAYOUT.forEach((pts, i) => {
    const id = paid[i];
    if (!id) return;
    points[id] = pts;
    m.players[id].reserve += pts * BALANCE.TROOPS_PER_POINT;
  });
  m.lastVersus = { style: m.versus!.style, ranking, points };
  m.phase = 'gap_cards';
  m.gap = { cards: [], proposals: [], moves: {}, ready: [] };
}

// ---------------------------------------------------------------- the Gap: cards and alliances

function useCard(p: Player, card: CardType) {
  const i = p.cards.indexOf(card);
  if (i < 0) return false;
  p.cards.splice(i, 1);
  return true;
}

function playCard(m: Match, p: Player, a: Extract<Action, { type: 'card' }>): boolean {
  if (!p.cards.includes(a.card)) return false;
  const land = a.land ? m.lands[a.land] : undefined;
  const own = !!land && land.owner === p.id;
  switch (a.card) {
    case 'joker':
    case 'reinforcements':
      return false; // Joker is played on a solo tile, Reinforcements on a troop move.
    case 'shield':
      if (!own) return false;
      land!.shielded = true;
      break;
    case 'trap':
      if (!own) return false;
      land!.trapped = true;
      break;
    case 'revolution': {
      const ids = active(m);
      const average = m.landOrder.filter((l) => m.lands[l].owner).length / (ids.length || 1);
      if (!own || landsOf(m, p.id).length >= average) return false; // his code: rejected, card kept
      land!.troops += BALANCE.REVOLUTION_TROOPS;
      break;
    }
    case 'earthquake':
      for (const l of m.landOrder.map((id) => m.lands[id]))
        if (l.owner && l.owner !== p.id && !l.capital && !l.shielded) l.troops = Math.floor(l.troops * 0.8);
      break;
    case 'hide_troops':
      for (const l of landsOf(m, p.id)) l.hidden = true;
      break;
    case 'betrayal': {
      // His code: takes one non-capital land of the ally with 0 troops, and the alliance ends.
      if (!p.ally || !land || land.owner !== p.ally || land.capital) return false;
      const ally = m.players[p.ally];
      land.owner = p.id;
      land.troops = 0;
      ally.ally = null;
      p.ally = null;
      m.log.push(`${p.name} betrayed ${ally.name} and took ${land.name}`);
      break;
    }
    case 'ambush':
      if (!a.target || a.target === p.id || !m.players[a.target] || m.players[a.target].out) return false;
      break;
    case 'double_attack':
    case 'spy':
      break;
  }
  useCard(p, a.card);
  m.gap.cards.push({ by: p.id, card: a.card, land: a.land, player: a.target });
  return true;
}

/** Spy (CQ14): every player's reserve and the cards played this Gap. */
export function spyView(m: Match, viewer: string) {
  if (!m.gap.cards.some((c) => c.by === viewer && c.card === 'spy')) return null;
  return { reserves: Object.fromEntries(active(m).map((x) => [x.id, x.reserve])), cards: m.gap.cards.filter((c) => c.by !== viewer) };
}

function toMoves(m: Match) {
  m.phase = 'gap_moves';
  m.gap.ready = [];
}

/** Moves allowed this Gap: 2, +1 with Double attack, -1 when ambushed (never below 1). */
export function maxMoves(m: Match, id: string) {
  let n = BALANCE.MAX_MOVES;
  if (m.gap.cards.some((c) => c.by === id && c.card === 'double_attack')) n++;
  if (m.gap.cards.some((c) => c.player === id && c.card === 'ambush')) n--;
  return Math.max(1, n);
}

/** CQ3: any land can be targeted; CQ8: never an ally's land. At least 1,000 troops per move, from reserve or an own land. */
function validMoves(m: Match, p: Player, moves: Move[]): Move[] | null {
  if (moves.length > maxMoves(m, p.id)) return null;
  if (moves.filter((x) => x.reinforce).length > p.cards.filter((c) => c === 'reinforcements').length) return null;
  for (const mv of moves) {
    const to = m.lands[mv.to];
    if (!to || mv.troops < BALANCE.MIN_MOVE_TROOPS) return null;
    if (mv.from !== null && m.lands[mv.from]?.owner !== p.id) return null;
    if (mv.from === mv.to) return null;
    if (to.owner && to.owner !== p.id && to.owner === p.ally) return null;
  }
  for (const mv of moves) if (mv.reinforce) useCard(p, 'reinforcements');
  return moves.map((x) => ({ ...x }));
}

/** His bot for a disconnected player: the whole reserve (in thousands) onto their weakest land. */
export function botMoves(m: Match, id: string): Move[] {
  const p = m.players[id];
  const lands = landsOf(m, id).sort((a, b) => a.troops - b.troops);
  const troops = Math.floor(p.reserve / 1000) * 1000;
  return troops >= 1000 && lands.length ? [{ from: null, to: lands[0].id, troops }] : [];
}

// ---------------------------------------------------------------- battles

function eliminate(m: Match, id: string, reason: 'capital' | 'away') {
  const p = m.players[id];
  if (p.out) return;
  p.out = true;
  p.outReason = reason;
  p.outOrder = Object.values(m.players).filter((x) => x.out).length;
  p.reserve = 0;
  p.cards = [];
  if (p.ally && m.players[p.ally]) m.players[p.ally].ally = null;
  p.ally = null;
  for (const l of landsOf(m, id)) l.owner = null; // CQ10: their lands go neutral, garrisons stay
  m.log.push(reason === 'capital' ? `${p.name}'s capital fell` : `${p.name} was away too long`);
}

/** All moves land at once (his combatResolver): own lands are reinforced, then each attacked land is fought for. */
function battle(m: Match, ctx: Ctx, used: Set<string>) {
  const moves: { by: string; to: string; troops: number }[] = [];
  for (const p of active(m)) {
    const list = m.gap.moves[p.id] ?? (p.connected ? [] : botMoves(m, p.id));
    for (const mv of list) {
      const src = mv.from === null ? null : m.lands[mv.from];
      const have = src ? (src.owner === p.id ? src.troops : 0) : p.reserve;
      const troops = Math.min(mv.troops, have);
      if (troops <= 0) continue;
      if (src) src.troops -= troops;
      else p.reserve -= troops;
      moves.push({ by: p.id, to: mv.to, troops: mv.reinforce ? Math.ceil((troops * 1.5) / 1000) * 1000 : troops });
    }
  }
  const attacks = new Map<string, { by: string; troops: number }[]>();
  for (const mv of moves) {
    const to = m.lands[mv.to];
    if (to.owner === mv.by) to.troops += mv.troops;
    else attacks.set(mv.to, [...(attacks.get(mv.to) ?? []), { by: mv.by, troops: mv.troops }]);
  }
  const duels: Duel[] = [];
  for (const [landId, attackers] of attacks) {
    const land = m.lands[landId];
    if (land.shielded) {
      for (const x of attackers) m.players[x.by].reserve += x.troops;
      m.log.push(`${land.name} was shielded`);
      continue;
    }
    if (land.trapped) {
      const biggest = [...attackers].sort((x, y) => y.troops - x.troops)[0];
      biggest.troops -= Math.floor(biggest.troops * 0.5);
      m.log.push(`A trap hit ${m.players[biggest.by].name} at ${land.name}`);
    }
    const total = attackers.reduce((s, x) => s + x.troops, 0);
    if (land.troops >= total) {
      land.troops -= total; // the defender wins ties
      m.log.push(`${land.name} held`);
      continue;
    }
    if (attackers.length === 1) {
      capture(m, landId, attackers[0].by, attackers[0].troops - land.troops);
      continue;
    }
    // Several attackers overwhelm the land: losses split by size, the top 2 duel, the rest go home.
    const garrison = land.troops;
    const left = attackers
      .map((x) => ({ by: x.by, troops: Math.max(0, x.troops - Math.round(garrison * (x.troops / total))) }))
      .sort((x, y) => y.troops - x.troops);
    for (const x of left.slice(2)) m.players[x.by].reserve += x.troops;
    duels.push({
      land: landId, p1: left[0].by, p2: left[1].by, t1: left[0].troops, t2: left[1].troops,
      questions: draw(ctx.bank, 'tf', BALANCE.DUEL_QUESTIONS, m.mix, used, ctx.rng), a1: [], a2: [],
    });
    m.log.push(`Breaking Duel at ${land.name}`);
  }
  m.duels = duels;
  m.duelIndex = 0;
  if (duels.length) m.phase = 'duel';
  else endStage(m, ctx);
}

function capture(m: Match, landId: string, by: string, troops: number) {
  const land = m.lands[landId];
  const before = land.owner;
  land.owner = by;
  land.troops = troops;
  land.hidden = false;
  m.players[by].stats.captured++;
  m.log.push(`${m.players[by].name} took ${land.name}`);
  if (land.capital && before && before !== by) eliminate(m, before, 'capital');
}

/** CQ9: most right answers wins, then the faster total, then a coin flip. The loser's surplus goes home. */
export function duelWinner(d: Duel, rng: Rng): 1 | 2 {
  const r1 = d.a1.filter((x) => x.right).length;
  const r2 = d.a2.filter((x) => x.right).length;
  if (r1 !== r2) return r1 > r2 ? 1 : 2;
  const ms1 = d.a1.reduce((s, x) => s + x.ms, 0);
  const ms2 = d.a2.reduce((s, x) => s + x.ms, 0);
  if (ms1 !== ms2) return ms1 < ms2 ? 1 : 2;
  return rng() < 0.5 ? 1 : 2;
}

function finishDuel(m: Match, ctx: Ctx, used: Set<string>) {
  const d = m.duels[m.duelIndex];
  const w = duelWinner(d, ctx.rng);
  const [winner, loser, wt, lt] = w === 1 ? [d.p1, d.p2, d.t1, d.t2] : [d.p2, d.p1, d.t2, d.t1];
  if (!m.players[loser].out) m.players[loser].reserve += Math.max(0, lt - wt);
  if (!m.players[winner].out) capture(m, d.land, winner, wt);
  else m.players[loser].reserve += wt; // the winner fell earlier in this Gap: the land stays as it was
  m.duelIndex++;
  if (m.duelIndex >= m.duels.length) endStage(m, ctx);
  void used;
}

// ---------------------------------------------------------------- stage end and win

/** CQ10: lands, then troops (reserve + lands), then accuracy. */
export function compareStanding(m: Match, a: Player, b: Player) {
  return landsOf(m, b.id).length - landsOf(m, a.id).length || totalTroops(m, b.id) - totalTroops(m, a.id) || accuracy(b) - accuracy(a);
}

/** Final places: players still in by CQ10, then the eliminated, last out first. */
export function standings(m: Match): Player[] {
  const inGame = active(m).sort((a, b) => compareStanding(m, a, b));
  const out = m.order.map((id) => m.players[id]).filter((p) => p.out).sort((a, b) => (b.outOrder ?? 0) - (a.outOrder ?? 0));
  return [...inGame, ...out];
}

function endStage(m: Match, ctx: Ctx) {
  // CQ12: a player away for the whole stage counts it; 2 in a row and they are removed.
  for (const p of active(m)) {
    p.awayStages = p.awayThisStage && !p.connected ? p.awayStages + 1 : 0;
    if (p.awayStages >= BALANCE.AWAY_STAGES_LIMIT) eliminate(m, p.id, 'away');
  }
  const left = active(m);
  if (left.length <= 1 || m.stage >= BALANCE.MAX_STAGES) {
    m.phase = 'over';
    m.winner = left.length ? standings(m)[0].id : lastCapitalTaker(m);
    m.log.push(`${m.players[m.winner].name} wins`);
    return;
  }
  m.stage++;
  m.round = 1;
  m.phase = 'solo_pick';
  m.solo = {};
  m.versus = null;
  m.duels = [];
  m.duelIndex = 0;
  m.board = makeBoard(ctx.rng);
  for (const l of Object.values(m.lands)) Object.assign(l, { shielded: false, trapped: false, hidden: false });
  for (const p of Object.values(m.players)) {
    p.ally = null; // CQ8: alliances end every stage
    p.awayThisStage = !p.connected;
  }
  m.log.push(`Stage ${m.stage}`);
}

/** Everyone fell in the same Gap (his edge case): the last one eliminated wins. */
function lastCapitalTaker(m: Match) {
  return [...m.order].sort((a, b) => (m.players[b].outOrder ?? 0) - (m.players[a].outOrder ?? 0))[0];
}

// ---------------------------------------------------------------- timeouts

function onTimeout(m: Match, ctx: Ctx, used: Set<string>): boolean {
  switch (m.phase) {
    case 'solo_pick': {
      // Players who didn't pick get a random free tile; disconnected players sit the round out.
      for (const p of active(m)) {
        if (m.solo[p.id] || !p.connected) continue;
        const free = m.board.filter((t) => !t.by);
        if (free.length) takeTile(m, p.id, free[Math.floor(ctx.rng() * free.length)], ctx, used);
      }
      m.phase = 'solo_play';
      if (soloDone(m)) endSolo(m, ctx, used);
      return true;
    }
    case 'solo_play': {
      // An unanswered tile scores as all wrong (his timeout).
      for (const p of active(m)) {
        const turn = m.solo[p.id];
        if (turn && !turn.card && !turn.result) scoreSolo(p, turn, []);
      }
      endSolo(m, ctx, used);
      return true;
    }
    case 'versus':
      if (m.versus?.style === 'standing') nextStanding(m);
      else finishVersus(m);
      return true;
    case 'gap_cards':
      toMoves(m);
      return true;
    case 'gap_moves':
      battle(m, ctx, used);
      return true;
    case 'duel': {
      // Missing duel answers count as wrong at the full 6 s.
      const d = m.duels[m.duelIndex];
      for (const list of [d.a1, d.a2]) while (list.length < d.questions.length) list.push({ right: false, ms: BALANCE.DUEL_SECONDS * 1000 });
      finishDuel(m, ctx, used);
      return true;
    }
    default:
      return false;
  }
}
