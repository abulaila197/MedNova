// Online (IM2): the same engine as Pass the phone, run by the 'imposter' edge function. Engine player ids are the
// players' user ids, so a move's playerId is always the signed-in user (the engine's withAuth rule). This file is the
// referee's whole logic, kept here so it is tested with the rest of the game; the edge function only loads and saves.
import { createGame, nextDeadline, reduce } from './engine/engine';
import { PROFANITY } from './engine/filter';
import type { GameAction, GameEvent, GameState, RoundSummary, SubtypeChoice } from './engine/types';
import { getView, type PlayerView } from './engine/view';
import { BANK } from './offline';

/** The moves a phone may send; the referee fills in playerId from the signed-in user. */
export type Move =
  | { type: 'TICK' }
  | { type: 'SUBMIT_CLUE'; text: string }
  | { type: 'DECIDE'; choice: 'vote' | 'extra' }
  | { type: 'CAST_VOTE'; target: string }
  | { type: 'SUBMIT_GUESS'; text: string }
  | { type: 'NEXT_ROUND' };

/** A note for one player (the host hears when someone keeps trying blocked words). */
export type Alert = { to: string; text: string; at: number };

/** What is saved: the engine's game plus the notes waiting to be shown. */
export type Saved = { g: GameState; alerts: Alert[] };

/**
 * One player's screen: the engine's view, plus who was caught once the vote has caught them, and the finished
 * rounds (their results are shown to everyone anyway; the phone records them when the match ends).
 */
export type ImView = PlayerView & { caught: string | null; alerts: Alert[]; history: RoundSummary[] };

const envAt = (now: number, rng: () => number) => ({ now, rng, bank: BANK, profanity: PROFANITY });

export function startOnlineGame(o: {
  roomId: string;
  host: string;
  seats: string[];
  names: Record<string, string>;
  style: SubtypeChoice;
  rounds: number;
  now: number;
  rng?: () => number;
}): GameState {
  const rng = o.rng ?? Math.random;
  const env = envAt(o.now, rng);
  const host = o.seats.includes(o.host) ? o.host : o.seats[0];
  const name = (id: string) => o.names[id]?.trim() || 'Player';
  let s = createGame({ roomId: o.roomId, mode: 'online', host: { id: host, name: name(host) } });
  for (const id of o.seats) if (id !== host) s = reduce(s, { type: 'JOIN', playerId: id, name: name(id) }, env).state;
  const rounds = Math.min(5, Math.max(1, Math.round(o.rounds) || 3));
  const style = (['mixed', 'clinical', 'basic'] as const).includes(o.style) ? o.style : 'mixed';
  return reduce(s, { type: 'START_MATCH', playerId: host, config: { subtype: style, rounds } }, env).state;
}

const MAX_ALERTS = 6;

/**
 * One request: players who dropped out leave the game first, then the move is applied for `me`.
 * Returns the new save (the same object when nothing changed) and the refusal for my move, if any.
 */
export function stepOnline(saved: Saved, me: string, move: Move, dropped: string[], now: number, rng: () => number = Math.random): { next: Saved; refused: { code: string; message: string } | null } {
  const env = envAt(now, rng);
  let g = saved.g;
  const events: GameEvent[] = [];
  for (const id of dropped) {
    const p = g.players.find((x) => x.id === id);
    if (p?.connected && g.phase.kind !== 'matchEnd') {
      const r = reduce(g, { type: 'PLAYER_DISCONNECTED', playerId: id }, env);
      g = r.state;
      events.push(...r.events);
    }
  }
  const a: GameAction = move.type === 'TICK' ? move : ({ ...move, playerId: me } as GameAction);
  const r = reduce(g, a, env);
  g = r.state;
  events.push(...r.events);
  let alerts = saved.alerts;
  for (const e of events) {
    if (e.type !== 'profanity-threshold') continue;
    const who = g.players.find((p) => p.id === e.playerId)?.name ?? 'A player';
    alerts = [...alerts, { to: e.notifyId, text: `${who} has tried blocked words 3 times.`, at: now }].slice(-MAX_ALERTS);
  }
  const next = { g, alerts };
  const refused = move.type === 'TICK' ? null : r.error;
  if (JSON.stringify(next) === JSON.stringify(saved)) return { next: saved, refused };
  return { next, refused };
}

/** Each player's own view, keyed by user id, plus 'watch' for spectators (no words at all). */
export function viewsOf(saved: Saved, now: number): Record<string, ImView> {
  const g = saved.g;
  const caught = g.phase.kind === 'redemption' && g.round ? g.round.imposterId : null;
  // Notes stay up for 8 s, for their own player only.
  const live = saved.alerts.filter((x) => now - x.at < 8_000);
  const out: Record<string, ImView> = {};
  for (const p of g.players) out[p.id] = { ...getView(g, p.id), caught, alerts: live.filter((x) => x.to === p.id), history: g.history };
  out.watch = { ...getView(g, null), myWord: null, caught, alerts: [], history: g.history };
  return out;
}

export const dueOf = (s: Saved): number | null => nextDeadline(s.g);

/** Places for the match_players rows, in seat order: points, then the earliest right votes (credits); ties share. */
export function onlineRanks(g: GameState, seats: string[]): number[] {
  const key = (id: string) => {
    const p = g.players.find((x) => x.id === id);
    return [p?.score ?? 0, p?.credits ?? 0] as const;
  };
  return seats.map((id) => {
    const [s, c] = key(id);
    return 1 + seats.filter((o) => {
      const [s2, c2] = key(o);
      return s2 > s || (s2 === s && c2 > c);
    }).length;
  });
}

export const scoresOf = (g: GameState, seats: string[]) => seats.map((id) => g.players.find((p) => p.id === id)?.score ?? 0);
