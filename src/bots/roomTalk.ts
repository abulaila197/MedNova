import { personaOf } from './identity';
import type { Bot, BotType } from './types';

/** How long each type takes to join and to get ready in the room (ms): Geniuses are quick, Freshmen wander in. */
const JOIN: Record<BotType, [number, number]> = { freshman: [1600, 2600], scholar: [900, 1700], genius: [500, 1100] };
const READY: Record<BotType, [number, number]> = { freshman: [1200, 2600], scholar: [700, 1400], genius: [300, 800] };

/** Personality nudges it: a Show-off is first in, a Sleepy one takes its time. */
const pace = (b: Bot) => ({ showoff: 0.7, hot: 0.8, sleepy: 1.5, shy: 1.2 } as Record<string, number>)[b.persona ?? personaOf(b.name)] ?? 1;

export const between = ([a, b]: [number, number]) => a + Math.random() * (b - a);
export const joinMs = (b: Bot) => between(JOIN[b.type]) * pace(b);
export const readyMs = (b: Bot) => between(READY[b.type]) * pace(b);
