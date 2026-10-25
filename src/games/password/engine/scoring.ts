import type { TeamId, TeamRoundResult } from './types';

/**
 * Ranking for a round and for the match totals:
 *  1. more words completed, 2. fewer clues, 3. less time. Equal on all three is a draw.
 * Negative = `a` is better.
 */
export function compareResults(a: TeamRoundResult, b: TeamRoundResult): number {
  return b.wordsCompleted - a.wordsCompleted || a.clues - b.clues || a.timeMs - b.timeMs;
}

export type Winner = TeamId | 'draw';

export function decideWinner(a: TeamRoundResult, b: TeamRoundResult): Winner {
  const c = compareResults(a, b);
  return c < 0 ? a.teamId : c > 0 ? b.teamId : 'draw';
}

/** Adds up one team's results over the rounds (words, clues and time are all summed). */
export function sumResults(teamId: TeamId, rounds: readonly TeamRoundResult[]): TeamRoundResult {
  return rounds.reduce<TeamRoundResult>(
    (acc, r) => ({
      teamId,
      wordsCompleted: acc.wordsCompleted + r.wordsCompleted,
      clues: acc.clues + r.clues,
      timeMs: acc.timeMs + r.timeMs,
    }),
    { teamId, wordsCompleted: 0, clues: 0, timeMs: 0 },
  );
}

export interface MatchSummary {
  rounds: Record<TeamId, TeamRoundResult>[];
  totals: Record<TeamId, TeamRoundResult>;
  roundWinners: Winner[];
  winner: Winner;
}

export function summarizeMatch(rounds: readonly Record<TeamId, TeamRoundResult>[]): MatchSummary {
  const totals = {
    A: sumResults(
      'A',
      rounds.map((r) => r.A),
    ),
    B: sumResults(
      'B',
      rounds.map((r) => r.B),
    ),
  };
  return {
    rounds: rounds.slice(),
    totals,
    roundWinners: rounds.map((r) => decideWinner(r.A, r.B)),
    winner: decideWinner(totals.A, totals.B),
  };
}

/** A team that forfeits a round completes 0 words in it and its time counts as the full cap. */
export const forfeitedResult = (teamId: TeamId, clues: number, capMs: number): TeamRoundResult => ({
  teamId,
  wordsCompleted: 0,
  clues,
  timeMs: capMs,
});
