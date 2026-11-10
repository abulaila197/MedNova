// Bots instead of online play (Yazan 2026-11-09). Everything about bots runs on the phone, offline.

/** The three bot types: Freshman (clumsy), Scholar (steady) and Genius (fast know-it-all). */
export type BotType = 'freshman' | 'scholar' | 'genius';

/** The level the player picks in setup; it sets the mix of types at the table. */
export type BotLevel = 'easy' | 'medium' | 'hard';

/** One bot at the table. Saved on its seat, so a resumed or rematched match keeps the same bots. */
export type Bot = {
  /** Stable id, 'bot:<type>:<name>' (also the talk sender id). */
  id: string;
  type: BotType;
  name: string;
  /** The character it wears (never Admin): more stars for smarter bots. */
  character: string;
  /** The player level shown on its badge (its starting level; it grows as you meet it, see memory.ts). */
  level: number;
  /** Hidden personality (Yazan 2026-11-09: in the code only, never shown). Fixed to the name. */
  persona?: Persona;
};

/**
 * Personalities (Yazan 2026-11-09): how a rival acts, on top of how good it is (its type).
 * Hidden from the player: only felt through how it plays and talks.
 */
export type Persona = 'showoff' | 'shy' | 'joker' | 'sore' | 'cheer' | 'cool' | 'hot' | 'sleepy';
export const PERSONAS: Persona[] = ['showoff', 'shy', 'joker', 'sore', 'cheer', 'cool', 'hot', 'sleepy'];

export const TYPE_NAME: Record<BotType, string> = { freshman: 'Freshman', scholar: 'Scholar', genius: 'Genius' };
/** What the player picks (Yazan 2026-11-09: named by the type the table is mostly made of). */
export const LEVEL_NAME: Record<BotLevel, string> = { easy: 'Freshmen', medium: 'Scholars', hard: 'Geniuses' };

/** Your head-to-head record with one rival (G6): wins and losses are yours. */
export type HeadToHead = {
  w: number;
  l: number;
  last: 'won' | 'lost';
  /** The last game you met it in, and that play's settings: "Play again" opens the same kind of room. */
  game: string;
  settings: Record<string, unknown>;
  at: number;
};
