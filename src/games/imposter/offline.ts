// Pass the phone: Yazan's engine runs on the phone (IM2). Seats become engine players "s0".."s5" in seat order,
// which is the clockwise order; seat 0 is the phone owner, the host and the device holder.
import pairsJson from './data/pairs.json';
import { createGame, reduce, type Env } from './engine/engine';
import { PROFANITY } from './engine/filter';
import type { GameAction, GameState, RoundSummary, SubtypeChoice, WordBank, WordPair } from './engine/types';

export const BANK = pairsJson as unknown as WordBank;

/** My own pairs (My diseases), by their "c:" id, so a practice match plays its pair first. */
export const OWN_PAIRS = new Map<string, WordPair>();
export const ownFirst = (custom: unknown) => {
  const p = typeof custom === 'string' ? OWN_PAIRS.get(custom) : undefined;
  return p ? [p] : undefined;
};

export const idOf = (seat: number) => `s${seat}`;
export const seatOf = (id: string) => Number(id.slice(1));

export function startOfflineGame(seats: { seat: number; name: string }[], subtype: SubtypeChoice, rounds: number, now: number, rng: () => number = Math.random, first?: WordPair[]): GameState {
  const [host, ...rest] = seats;
  let s = createGame({ roomId: 'offline', mode: 'offline', host: { id: idOf(host.seat), name: host.name } });
  for (const x of rest) s = act(s, { type: 'JOIN', playerId: idOf(x.seat), name: x.name }, now, rng).state;
  return act(s, { type: 'START_MATCH', playerId: idOf(host.seat), config: { subtype, rounds } }, now, rng, first).state;
}

export function act(s: GameState, a: GameAction, now: number, rng: () => number = Math.random, first?: WordPair[]) {
  const env: Env = { now, rng, bank: BANK, profanity: PROFANITY, first };
  return reduce(s, a, env);
}

/** A pause stops the discussion and redemption clocks: their deadlines move on by the time spent paused. */
export function shiftDeadlines(s: GameState, ms: number): GameState {
  const ph = s.phase;
  if ((ph.kind === 'offlineDiscussion' || ph.kind === 'redemption') && ms > 0) return { ...s, phase: { ...ph, deadline: ph.deadline + ms } };
  return s;
}

/** Whose turn it is on the phone right now, or null when the screen is for everyone. */
export function holderOf(s: GameState): string | null {
  const r = s.round;
  const ph = s.phase;
  if (!r) return null;
  if (ph.kind === 'wordReveal') return r.participants.find((id) => !r.acks.includes(id)) ?? null;
  if (ph.kind === 'decision') return r.participants.find((id) => !r.decisions[id]) ?? null;
  if (ph.kind === 'vote') return r.participants.find((id) => !r.votes[id]) ?? null;
  if (ph.kind === 'redemption') return ph.confirmerId;
  return null;
}

/** Live vote counts on each player (votes are visible as they are cast). */
export function tally(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of Object.values(s.round?.votes ?? {})) out[t] = (out[t] ?? 0) + 1;
  return out;
}

/** What one round meant for one seat, for the results list. */
export function roundOutcome(sum: RoundSummary, id: string): 'right' | 'wrong' {
  if (id === sum.imposterId) return sum.outcome === 'not-caught' || sum.redemptionCorrect ? 'right' : 'wrong';
  return sum.votes[id] === sum.imposterId ? 'right' : 'wrong';
}
