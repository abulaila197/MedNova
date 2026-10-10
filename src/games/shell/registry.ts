import type { GameDef } from './types';

/*
 * Games that run on the shared engine. Each game's definition pulls in its whole question bank
 * (about 3 MB of data across the ten), so a game is only loaded the first time it is asked for,
 * not when the app starts. (The loading page asks for it early, while its bar runs.)
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const LOAD: Record<string, () => GameDef> = {
  'the-diagnostic-pursuit': () => require('../diagnostic/def').diagnosticPursuit,
  'nova-medicordle': () => require('../medicordle/def').novaMedicordle,
  'the-streak-master': () => require('../streak/def').streakMaster,
  'the-riddler': () => require('../riddler/def').riddler,
  'the-silent-artist': () => require('../silent/def').silentArtist,
  'case-files-unsolved': () => require('../casefiles/def').caseFiles,
  'nova-crossword': () => require('../crossword/def').novaCrossword,
  'the-wheels-of-chaos': () => require('../wheels/def').wheelsOfChaos,
  'the-conqueror': () => require('../conqueror/def').conqueror,
  'trust-me-not': () => require('../trustmenot/def').trustMeNot,
};

const loaded = new Map<string, GameDef>();

export function gameDef(key: string): GameDef | null {
  const hit = loaded.get(key);
  if (hit) return hit;
  const load = LOAD[key];
  if (!load) return null;
  const def = load();
  loaded.set(key, def);
  return def;
}
