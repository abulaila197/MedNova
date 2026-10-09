// The Conqueror online (CQ1-CQ21): the match run by the server. Every phase has a clock from his code, and a few
// short holds sit between phases so everyone sees what happened (his intro, solo tally, versus intro and results,
// and battle screens). The same code runs on the server; phones only ever get their own view (view.ts).
import type { Bank, Mix, Rng } from './bank';
import { BALANCE, startMatch, step, type Action, type Match } from './core';
import type { Hold } from './view';

export const HOLD_MS = {
  start: 6000,
  /** His 4 s between a solo round and what comes next. */
  soloResult: 4000,
  /** His 4 s versus intro. */
  versusIntro: 4000,
  /** His 5 s versus results. */
  versusResult: 5000,
  /** His 15 s battle screen. */
  battle: 15000,
};
/** His versus clocks: Closest number and Clue ladder 45 s, Category rush 50 s, Last one standing 15 s a question. */
const VERSUS_MS = { closest: 45000, rush: BALANCE.RUSH_SECONDS * 1000, standing: BALANCE.STANDING_SECONDS * 1000, clue: 45000 };
/** A late answer still counts: the network takes a moment. */
export const GRACE_MS = 700;

export type OnlineConqueror = {
  m: Match;
  /** When the current phase's clock runs out (after any hold). */
  deadline: number | null;
  /** When the current phase's clock started: times for answers are measured from here. */
  started: number;
  /** Short screens between phases, one after another; the clock starts after the last one. */
  holds: Hold[];
  key: string;
};

export function phaseMs(m: Match): number | null {
  switch (m.phase) {
    case 'solo_pick': return BALANCE.BOARD_PICK_SECONDS * 1000;
    case 'solo_play': return BALANCE.SOLO_QUESTION_SECONDS * 1000;
    case 'versus': return m.versus ? VERSUS_MS[m.versus.style] : null;
    case 'gap_cards': return BALANCE.GAP_CARDS_SECONDS * 1000;
    case 'gap_moves': return BALANCE.GAP_MOVES_SECONDS * 1000;
    case 'duel': return BALANCE.DUEL_SECONDS * BALANCE.DUEL_QUESTIONS * 1000 + 2000;
    default: return null;
  }
}

const keyOf = (m: Match) => [m.phase, m.stage, m.round, m.versus?.style === 'standing' ? m.versus.index : '', m.duelIndex].join('|');

/** The screens that come between two states of the match. */
function holdsFor(prev: Match, next: Match, now: number): Hold[] {
  if (next.phase === 'over') return [];
  const out: Hold[] = [];
  let t = now;
  const add = (h: Omit<Hold, 'until'>, ms: number) => {
    t += ms;
    out.push({ ...h, until: t });
  };
  if ((prev.phase === 'gap_moves' || prev.phase === 'duel') && next.phase !== prev.phase) {
    const log = next.log.slice(prev.log.length).filter((l) => !/^Stage \d+$/.test(l));
    add({ kind: 'battle', log }, HOLD_MS.battle);
  }
  if (prev.phase === 'solo_play' && next.phase !== 'solo_play') add({ kind: 'soloResult' }, HOLD_MS.soloResult);
  if (prev.phase === 'versus' && next.phase !== 'versus') add({ kind: 'versusResult' }, HOLD_MS.versusResult);
  if (next.phase === 'versus' && prev.phase !== 'versus' && next.versus) add({ kind: 'versusIntro', style: next.versus.style }, HOLD_MS.versusIntro);
  return out;
}

/** Starts the new clock when the match moved on, after any holds. */
function settle(o: OnlineConqueror, prev: Match, now: number): OnlineConqueror {
  const key = keyOf(o.m);
  if (key === o.key) return o;
  const holds = holdsFor(prev, o.m, now);
  const begin = holds.length ? holds[holds.length - 1].until : now;
  const ms = phaseMs(o.m);
  return { ...o, key, holds, started: begin, deadline: ms == null ? null : begin + ms };
}

export function startOnline(players: { id: string; name: string }[], mix: Mix, rng: Rng, now: number): OnlineConqueror {
  const m = startMatch(players.map((p) => ({ ...p, color: '' })), mix, rng);
  const hold: Hold = { kind: 'start', until: now + HOLD_MS.start };
  const ms = phaseMs(m)!;
  return { m, holds: [hold], started: hold.until, deadline: hold.until + ms, key: keyOf(m) };
}

/** Plays every clock that has run out by `now`, each at the moment it ran out. */
function catchUp(o: OnlineConqueror, now: number, bank: Bank, rng: Rng): OnlineConqueror {
  let s = o;
  for (let i = 0; i < 50 && s.m.phase !== 'over' && s.deadline != null && s.deadline <= now; i++) {
    const at = s.deadline;
    const next = step(s.m, { type: 'timeout' }, { bank, rng });
    if (next === s.m) break;
    s = settle({ ...s, m: next }, s.m, at);
  }
  return s;
}

/** What a phone may send: an action without the player (the server fills in who sent it). */
export type PhoneAction = { type: string; [k: string]: unknown };

/** The phone's action with its sender, its times measured by the server, and the clue number from the clock. */
function stamp(o: OnlineConqueror, a: PhoneAction, me: string, now: number): Action | null {
  const elapsed = Math.max(0, now - o.started);
  const clamp = (x: unknown, max: number) => Math.min(max, Math.max(0, Number(x) || 0));
  switch (a.type) {
    case 'pick': return { type: 'pick', player: me, tile: Number(a.tile) };
    case 'joker': return { type: 'joker', player: me, style: a.style as never };
    case 'solo': return Array.isArray(a.answers) ? { type: 'solo', player: me, answers: a.answers as never } : null;
    case 'closest': return { type: 'closest', player: me, item: Number(a.item), value: Number(a.value), ms: elapsed };
    case 'rush': return { type: 'rush', player: me, text: String(a.text ?? '').slice(0, 80), ms: elapsed };
    case 'standing': return Array.isArray(a.picks) ? { type: 'standing', player: me, picks: (a.picks as unknown[]).map(Number).slice(0, 3), ms: elapsed } : null;
    case 'clue':
      return { type: 'clue', player: me, mystery: Number(a.mystery), text: String(a.text ?? '').slice(0, 80), clue: Math.min(4, 1 + Math.floor(elapsed / (BALANCE.CLUE_INTERVAL_SECONDS * 1000))), ms: elapsed };
    case 'card': return { type: 'card', player: me, card: a.card as never, land: a.land ? String(a.land) : undefined, target: a.target ? String(a.target) : undefined };
    case 'propose': return { type: 'propose', from: me, to: String(a.to) };
    case 'respond': return { type: 'respond', from: String(a.from), to: me, accept: !!a.accept };
    case 'ready': return { type: 'ready', player: me };
    case 'moves': return Array.isArray(a.moves) ? { type: 'moves', player: me, moves: (a.moves as never[]).slice(0, 4) } : null;
    case 'duel': return { type: 'duel', player: me, answer: !!a.answer, ms: clamp(a.ms, BALANCE.DUEL_SECONDS * 1000) };
    default: return null;
  }
}

/**
 * One request to the referee: marks who has left or come back, plays out the clocks that ran out, then the
 * player's action if the match is open for it (never during a hold). Returns the same object when nothing changed.
 */
export function stepOnline(o: OnlineConqueror, a: PhoneAction | null, me: string | null, away: string[], bank: Bank, rng: Rng, now: number): OnlineConqueror {
  let s = o;
  const ctx = { bank, rng };
  for (const id of Object.keys(s.m.players)) {
    const gone = away.includes(id);
    const p = s.m.players[id];
    if (!p.out && p.connected === gone) s = { ...s, m: step(s.m, { type: 'connection', player: id, connected: !gone }, ctx) };
  }
  if (a && me && a.type !== 'tick') {
    s = catchUp(s, now - GRACE_MS, bank, rng);
    const held = s.started > now;
    const act = held ? null : stamp(s, a, me, now);
    if (act) {
      const next = step(s.m, act, ctx);
      if (next !== s.m) s = settle({ ...s, m: next }, s.m, now);
    }
  }
  return catchUp(s, now, bank, rng);
}

/** The next moment the server must step in. */
export const dueOf = (o: OnlineConqueror) => (o.m.phase === 'over' ? null : o.deadline);
