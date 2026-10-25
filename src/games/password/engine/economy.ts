import { CONFIG } from './config';
import type { TeamId } from './types';
import type { Winner } from './scoring';

/**
 * Online EXP (the server awards it from the match result; the client only shows it).
 * PLACEHOLDER numbers: win 60, draw 30, loss 20. Forfeiting players and guests earn nothing.
 * Offline earns no EXP or tokens.
 */
export function onlineExp(input: { team: TeamId; winner: Winner; forfeited: boolean; isSignedIn: boolean }): number {
  if (!input.isSignedIn || input.forfeited) return 0;
  if (input.winner === 'draw') return CONFIG.EXP_DRAW;
  return input.winner === input.team ? CONFIG.EXP_WIN : CONFIG.EXP_LOSS;
}

/** 200 EXP = 1 whole token; the remainder carries over. */
export function expBar(totalExp: number) {
  const remainder = ((totalExp % CONFIG.EXP_PER_TOKEN) + CONFIG.EXP_PER_TOKEN) % CONFIG.EXP_PER_TOKEN;
  return {
    tokens: Math.floor(Math.max(0, totalExp) / CONFIG.EXP_PER_TOKEN),
    remainder,
    progress: remainder / CONFIG.EXP_PER_TOKEN,
  };
}
