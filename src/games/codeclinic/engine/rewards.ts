import { REWARDS } from './config';
import type { GameRecord } from './records';

export interface Reward {
  xp: number;
}

export const NO_REWARD: Reward = { xp: 0 };

/** Online: every player in the game, winners 60 EXP and losers 20 (CC2). */
export function rewardFor(record: GameRecord, playerId: string): Reward {
  const me = record.players.find((p) => p.id === playerId);
  if (!me) return NO_REWARD;
  return { xp: me.team === record.winner ? REWARDS.winXp : REWARDS.loseXp };
}

/** Pass the phone earns nothing, like every Pass the phone mode. */
export const offlineReward = (): Reward => NO_REWARD;
