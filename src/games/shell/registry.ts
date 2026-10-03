import { diagnosticPursuit } from '../diagnostic/def';
import type { GameDef } from './types';

/** Games that run on the shared engine. The rest keep the placeholder sheet until they are ported. */
const GAMES: Record<string, GameDef> = {
  [diagnosticPursuit.key]: diagnosticPursuit,
};

export function gameDef(key: string): GameDef | null {
  return GAMES[key] ?? null;
}
