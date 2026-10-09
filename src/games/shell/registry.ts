import { caseFiles } from '../casefiles/def';
import { conqueror } from '../conqueror/def';
import { novaCrossword } from '../crossword/def';
import { diagnosticPursuit } from '../diagnostic/def';
import { novaMedicordle } from '../medicordle/def';
import { riddler } from '../riddler/def';
import { silentArtist } from '../silent/def';
import { streakMaster } from '../streak/def';
import { trustMeNot } from '../trustmenot/def';
import { wheelsOfChaos } from '../wheels/def';
import type { GameDef } from './types';

/** Games that run on the shared engine. The rest keep the placeholder sheet until they are ported. */
const GAMES: Record<string, GameDef> = {
  [diagnosticPursuit.key]: diagnosticPursuit,
  [novaMedicordle.key]: novaMedicordle,
  [streakMaster.key]: streakMaster,
  [riddler.key]: riddler,
  [silentArtist.key]: silentArtist,
  [caseFiles.key]: caseFiles,
  [novaCrossword.key]: novaCrossword,
  [wheelsOfChaos.key]: wheelsOfChaos,
  [conqueror.key]: conqueror,
  [trustMeNot.key]: trustMeNot,
};

export function gameDef(key: string): GameDef | null {
  return GAMES[key] ?? null;
}
