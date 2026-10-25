// The shared play flow every game uses, so the general rules never differ between games.
import { engine } from '../engine';
import type { GameKey, Mode, Play, PlayItem, Seat, Standing } from '../engine/types';
import { bonusOf } from '@/features/shop/robots';
import { chargePlay } from '@/features/sparks/sparks';
import { useAccount } from '@/state/account';
import { sfxVerdict } from '@/lib/sound';
import { syncAccount } from '@/lib/sync';

import { useSession } from './session';
import type { GameDef } from './types';

/** Medicordle's Daily word never costs Sparks (TR3), nor does playing your own custom case (practice). */
export const alwaysFree = (play: Pick<Play, 'game' | 'mode' | 'settings'>) =>
  (play.game === 'nova-medicordle' && play.mode === 'solo' && play.settings.word !== 'endless') || !!play.settings.custom;

/** Pays for the play once (TR2: at its first answer; online: when the match ends): Sparks, or a guest play. */
export const countPlay = (play: Play) => chargePlay(play, alwaysFree(play));

/** The worn character's EXP bonus (#88), never above the game's per-play cap. */
const withBonus = (exp: number, cap: number) => Math.min(cap, Math.round(exp * (1 + bonusOf(useAccount.getState().profile?.avatar).exp / 100)));

/** Rule 9: settings are frozen here. Starting a new game drops the old bookmark for that mode (rule 7). */
export async function startPlay(game: GameKey, mode: Mode, settings: Record<string, unknown>, seats?: Seat[]) {
  const old = await engine.recorder.resumable(game, mode);
  if (old) await engine.recorder.discard(old.id);
  return engine.recorder.start({ game, mode, settings, seats, userId: useSession.getState().userId });
}

/**
 * Records one answered item. The first one pays for the play (TR2). Solo and Offline give the right, wrong or
 * time-up sound here, as the answer shows; `quiet` is for games that record a batch at the end and sound each answer
 * themselves. Online never sounds here: its items arrive at the end, and its reveal plays the sound (useRevealSound).
 */
export async function recordItem(play: Play, item: Omit<PlayItem, 'id' | 'at' | 'playId'>, quiet = false) {
  if (!quiet && play.mode !== 'online' && item.outcome !== 'skipped') void sfxVerdict(item.outcome === 'timed_out' ? 'timeup' : item.outcome === 'right');
  const row = await engine.recorder.recordItem({ ...item, playId: play.id });
  await countPlay(play);
  return row;
}

/** Ends the play, then pays EXP on the phone at once (rule 6). */
export async function finishPlay(def: GameDef, play: Play, score: number, standings?: Standing[]) {
  const items = await engine.recorder.itemsOf(play.id);
  const cap = def.expCap(play.settings, play.mode);
  const exp = Math.max(0, withBonus(Math.min(def.exp(score, items, play.settings), cap), cap));
  await engine.recorder.finish(play.id, { score, standings, expEarned: exp });
  const paid = await engine.wallet.earn(play.id, exp, cap);
  if (paid.levelsGained > 0) await engine.recorder.noteLevelUp(play.id, paid.level, paid.tokensGained);
  const uid = useSession.getState().userId;
  if (uid) syncAccount(uid).catch(() => {}); // offline is fine: it uploads next time
  return { exp: paid.amount, levelUp: paid.levelsGained > 0 ? paid.level : null, items };
}
