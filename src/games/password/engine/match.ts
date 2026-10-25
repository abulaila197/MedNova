import { shuffle, termsOfBank } from './terms';
import type { Rng, Settings, TeamId, Term, TermId } from './types';

/** The words of one round for each team. */
export interface RoundPlan {
  lists: Record<TeamId, TermId[]>;
}

export type PlanResult = { ok: true; rounds: RoundPlan[] } | { ok: false; reason: 'NOT_ENOUGH_TERMS' };

/**
 * Draws the words of a whole match.
 *  - online: both teams get the SAME words, in a different order;
 *  - offline: each team gets its OWN random words (no balancing: there is no difficulty), because
 *    the teams take turns and would hear each other's answers;
 *  - round 2 always uses new words.
 */
export function planMatch(input: {
  terms: readonly Term[];
  settings: Settings;
  mode: 'online' | 'offline';
  rng: Rng;
}): PlanResult {
  const { settings, mode, rng } = input;
  const pool = shuffle(termsOfBank(input.terms, settings.bank), rng);
  const perRound = mode === 'online' ? settings.wordsPerTeam : settings.wordsPerTeam * 2;
  if (pool.length < perRound * settings.rounds) return { ok: false, reason: 'NOT_ENOUGH_TERMS' };

  const rounds: RoundPlan[] = [];
  for (let r = 0; r < settings.rounds; r++) {
    const slice = pool.slice(r * perRound, (r + 1) * perRound).map((t) => t.id);
    if (mode === 'offline') {
      rounds.push({ lists: { A: slice.slice(0, settings.wordsPerTeam), B: slice.slice(settings.wordsPerTeam) } });
    } else {
      rounds.push({ lists: { A: slice, B: differentOrder(slice, rng) } });
    }
  }
  return { ok: true, rounds };
}

/** A shuffle of the same words that is not the same order (when there is more than one word). */
export function differentOrder(ids: readonly TermId[], rng: Rng): TermId[] {
  if (ids.length < 2) return ids.slice();
  for (let i = 0; i < 10; i++) {
    const s = shuffle(ids, rng);
    if (s.some((id, k) => id !== ids[k])) return s;
  }
  return [...ids.slice(1), ids[0]]; // guaranteed different
}
