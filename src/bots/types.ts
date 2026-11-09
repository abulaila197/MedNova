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
  /** The player level shown on its badge. */
  level: number;
};

export const TYPE_NAME: Record<BotType, string> = { freshman: 'Freshman', scholar: 'Scholar', genius: 'Genius' };
export const LEVEL_NAME: Record<BotLevel, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
