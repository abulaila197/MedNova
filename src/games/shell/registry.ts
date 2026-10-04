import { diagnosticPursuit } from '../diagnostic/def';
import { novaMedicordle } from '../medicordle/def';
import { streakMaster } from '../streak/def';
import type { GameDef } from './types';

/** Games that run on the shared engine. The rest keep the placeholder sheet until they are ported. */
const GAMES: Record<string, GameDef> = {
  [diagnosticPursuit.key]: diagnosticPursuit,
  [novaMedicordle.key]: novaMedicordle,
  [streakMaster.key]: streakMaster,
};

export function gameDef(key: string): GameDef | null {
  return GAMES[key] ?? null;
}
