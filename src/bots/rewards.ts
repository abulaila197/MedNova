import type { BotLevel } from './types';

/**
 * Rewards by rival level (G6, Yazan 2026-11-10): EXP (and so the tokens levels pay) scale with the table you picked,
 * under the same per-play cap as always. Freshmen x1, Scholars x1.25, Geniuses x1.5.
 */
export const BOOST: Record<BotLevel, number> = { easy: 1, medium: 1.25, hard: 1.5 };

export const rivalBoost = (mode: string, settings: Record<string, unknown>) => (mode === 'bots' ? (BOOST[settings.botLevel as BotLevel] ?? 1) : 1);
