// The shared play flow every game uses, so the general rules never differ between games.
import { engine, GUEST_TRIALS, TRIAL_MODES } from '../engine';
import type { GameKey, Mode, Play, PlayItem, Seat, Standing } from '../engine/types';
import { syncAccount } from '@/lib/sync';

import { useSession } from './session';
import type { GameDef } from './types';

/** Free plays left for a guest (shared by Solo and Offline Multiplayer); 0 for Online; null when signed in. */
export async function trialsLeft(game: GameKey, mode: Mode) {
  if (useSession.getState().userId) return null;
  if (!TRIAL_MODES.includes(mode)) return 0;
  return Math.max(0, GUEST_TRIALS - (await engine.gate.used(game, mode)));
}

/** Rule 9: settings are frozen here. Starting a new game drops the old bookmark for that mode (rule 7). */
export async function startPlay(game: GameKey, mode: Mode, settings: Record<string, unknown>, seats?: Seat[]) {
  const old = await engine.recorder.resumable(game, mode);
  if (old) await engine.recorder.discard(old.id);
  return engine.recorder.start({ game, mode, settings, seats, userId: useSession.getState().userId });
}

/** Records one answered item. The first one counts the guest trial (rule 20). */
export async function recordItem(play: Play, item: Omit<PlayItem, 'id' | 'at' | 'playId'>) {
  const row = await engine.recorder.recordItem({ ...item, playId: play.id });
  if (!play.userId) await engine.gate.countPlay(play.game, play.mode, play.id);
  return row;
}

/** Ends the play, then pays EXP on the phone at once (rule 6). */
export async function finishPlay(def: GameDef, play: Play, score: number, standings?: Standing[]) {
  const items = await engine.recorder.itemsOf(play.id);
  const exp = Math.max(0, Math.min(def.exp(score, items, play.settings), def.expCap(play.settings, play.mode)));
  await engine.recorder.finish(play.id, { score, standings, expEarned: exp });
  const paid = await engine.wallet.earn(play.id, exp, def.expCap(play.settings, play.mode));
  if (paid.levelsGained > 0) await engine.recorder.noteLevelUp(play.id, paid.level, paid.levelsGained);
  const uid = useSession.getState().userId;
  if (uid) syncAccount(uid).catch(() => {}); // offline is fine: it uploads next time
  return { exp: paid.amount, levelUp: paid.levelsGained > 0 ? paid.level : null, items };
}
