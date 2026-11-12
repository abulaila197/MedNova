// Tilt & Tell: Read My Mind (Yazan's cards, 2026-11-12). Pass the phone only, teams only (2 to 4 teams, at least 2
// players each). Teams alternate (A1, B1, A2, B2...) for 1, 2 or 3 rounds. In a turn the player holds the phone on
// their forehead while their team gives clues (Describe it or Act it out): tilt down = correct, tilt up = pass
// (free, at most 3 a turn). After each turn the word list can be fixed by tapping a word. Most words wins; teams
// tied at the top each get one 30 s sudden-death turn, and if they are still tied they share the win.
// No EXP, nothing to Learn. Pure: node tests run it.
import type { Seat } from '../engine/types';
import { shuffle } from '../engine/random';
import { teamLap, type Team } from '../shell/teams';

export type Mark = 'right' | 'pass';
export type TurnWord = { id: string; mark: Mark };
export type Turn = { seat: number; team: number; sudden?: boolean; words: TurnWord[] };
export type Phase = 'handoff' | 'play' | 'review' | 'over';

export type TTState = {
  turns: Turn[];
  /** Index of the turn being played (or about to be). */
  at: number;
  phase: Phase;
  /** The word on the forehead now (shown, not marked yet), or null between words. */
  showing: string | null;
  passesLeft: number;
  /** Words still to show, in order. Refilled from the bank when it runs out. */
  deck: string[];
};

export const MAX_PASSES = 3;
export const SUDDEN_SECONDS = 30;

/** Every regular turn, in order: one lap of the players (teams alternating) per round. */
export function planTurns(seats: Seat[], teams: Team[], rounds: number): Turn[] {
  const lap = teamLap(seats, teams);
  const teamOf = new Map(seats.map((x) => [x.seat, x.team ?? 0]));
  const out: Turn[] = [];
  for (let r = 0; r < rounds; r++) for (const seat of lap) out.push({ seat, team: teamOf.get(seat) ?? 0, words: [] });
  return out;
}

export function newGame(seats: Seat[], teams: Team[], rounds: number, deck: string[]): TTState {
  return { turns: planTurns(seats, teams, rounds), at: 0, phase: 'handoff', showing: null, passesLeft: MAX_PASSES, deck };
}

export const current = (s: TTState): Turn | undefined => s.turns[s.at];

/** The forehead check passed and the 3-2-1 ran: the clock starts and the first word shows. */
export function startTurn(s: TTState): TTState {
  if (s.phase !== 'handoff') return s;
  return next({ ...s, phase: 'play', passesLeft: MAX_PASSES, showing: null });
}

/** Shows the next word from the deck (the caller refills the deck first when it is empty). */
function next(s: TTState): TTState {
  const [id, ...rest] = s.deck;
  return { ...s, showing: id ?? null, deck: rest };
}

/** A tilt (or a tap on the backup buttons) on the word showing. A pass with none left does nothing. */
export function mark(s: TTState, m: Mark): TTState {
  if (s.phase !== 'play' || !s.showing) return s;
  if (m === 'pass' && s.passesLeft <= 0) return s;
  const turns = s.turns.map((t, i) => (i === s.at ? { ...t, words: [...t.words, { id: s.showing!, mark: m }] } : t));
  return next({ ...s, turns, passesLeft: m === 'pass' ? s.passesLeft - 1 : s.passesLeft, showing: null });
}

/** Time is up: the word still showing doesn't count. */
export function endTurn(s: TTState): TTState {
  if (s.phase !== 'play') return s;
  return { ...s, phase: 'review', showing: null };
}

/** Review: tapping a word swaps correct and pass (fixing a wrong tilt) before the points count. */
export function fix(s: TTState, i: number): TTState {
  if (s.phase !== 'review') return s;
  const turns = s.turns.map((t, j) =>
    j === s.at ? { ...t, words: t.words.map((w, k) => (k === i ? { ...w, mark: (w.mark === 'right' ? 'pass' : 'right') as Mark } : w)) } : t,
  );
  return { ...s, turns };
}

export const points = (t: Turn) => t.words.filter((w) => w.mark === 'right').length;

/** Words each team has, all turns so far (sudden death included). */
export function teamTotals(s: TTState, teams: Team[]): Map<number, number> {
  const m = new Map(teams.map((t) => [t.id, 0]));
  for (const t of s.turns) m.set(t.team, (m.get(t.team) ?? 0) + points(t));
  return m;
}

/** Teams level at the top. One team means a clear winner. */
export function leaders(s: TTState, teams: Team[]): number[] {
  const tot = teamTotals(s, teams);
  const best = Math.max(...tot.values());
  return teams.filter((t) => tot.get(t.id) === best).map((t) => t.id);
}

/** The player of `team` who has had the fewest turns (the earliest of them), for sudden death. */
function nextOf(s: TTState, team: number, seats: Seat[]): number {
  const mine = seats.filter((x) => x.team === team && !x.removed);
  const count = (seat: number) => s.turns.filter((t) => t.seat === seat).length;
  return [...mine].sort((a, b) => count(a.seat) - count(b.seat) || a.seat - b.seat)[0]?.seat ?? mine[0]?.seat ?? 0;
}

/** Review done: the next turn's hand-off, sudden death for tied leaders after the last turn, or the end. */
export function confirm(s: TTState, seats: Seat[], teams: Team[]): TTState {
  if (s.phase !== 'review') return s;
  const at = s.at + 1;
  if (at < s.turns.length) return { ...s, at, phase: 'handoff' };
  const tied = leaders(s, teams);
  const hadSudden = s.turns.some((t) => t.sudden);
  if (tied.length > 1 && !hadSudden) {
    const extra = tied.map((team) => ({ seat: nextOf(s, team, seats), team, sudden: true, words: [] as TurnWord[] }));
    return { ...s, turns: [...s.turns, ...extra], at, phase: 'handoff' };
  }
  return { ...s, at: s.turns.length, phase: 'over' };
}

/** A removed player's turns still to come are skipped (rule 17); a turn already running stays. */
export function dropSeat(s: TTState, seat: number): TTState {
  const turns = s.turns.filter((t, i) => i <= s.at || t.seat !== seat);
  return { ...s, turns };
}

/** Words for the deck: unseen ones in the chosen categories first; when all are seen, they all come back. */
export function freshDeck(pool: readonly string[], seen: ReadonlySet<string>, rng: () => number = Math.random) {
  const unseen = pool.filter((id) => !seen.has(id));
  return { deck: shuffle(unseen.length ? unseen : pool, rng), reset: unseen.length === 0 };
}

/** Each player's words (sudden death included), for the standings. */
export function seatScores(s: TTState): Map<number, number> {
  const m = new Map<number, number>();
  for (const t of s.turns) m.set(t.seat, (m.get(t.seat) ?? 0) + points(t));
  return m;
}

/** Seconds a turn lasts. */
export const turnSeconds = (t: Turn | undefined, setting: number) => (t?.sudden ? SUDDEN_SECONDS : setting);
