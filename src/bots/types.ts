// Bots instead of online play (Yazan 2026-11-09). Everything about bots runs on the phone, offline.

/** The three bot types: Dumb (clumsy), Hardworker (steady) and Nerd (fast know-it-all). */
export type BotType = 'dumb' | 'worker' | 'nerd';

/** The level the player picks in setup; it sets the mix of types at the table. */
export type BotLevel = 'easy' | 'medium' | 'hard';

/** One bot at the table. Saved on its seat, so a resumed or rematched match keeps the same bots. */
export type Bot = {
  /** Stable id, 'bot:<type>:<name>' (also the talk sender id). */
  id: string;
  type: BotType;
  name: string;
  /** The character it wears (never Admin): more stars for nerdier bots. */
  character: string;
  /** The player level shown on its badge. */
  level: number;
};

export const TYPE_NAME: Record<BotType, string> = { dumb: 'Dumb', worker: 'Hardworker', nerd: 'Nerd' };
export const LEVEL_NAME: Record<BotLevel, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
