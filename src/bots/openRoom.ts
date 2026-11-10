import { router } from 'expo-router';

import { sparksCost } from '@/features/sparks/costs';
import { needSparks } from '@/features/sparks/sparks';
import { engine } from '@/games/engine';
import type { GameKey } from '@/games/engine/types';
import { alwaysFree, startPlay } from '@/games/shell/flow';
import { gameDef } from '@/games/shell/registry';
import { useSession } from '@/games/shell/session';
import { useAccount } from '@/state/account';

import { dealBots } from './core';
import { botSetup, seatsFor } from './setup';
import type { Bot, BotLevel } from './types';

/**
 * Opens a Vs rivals room straight from the Nemesis page (G6): the chosen rival sits down with you, and the other seats
 * are dealt like any room of these settings. Same gate as Play: guests out of free plays sign in, Sparks are asked first.
 */
export async function openRoomWith(game: GameKey, rival: Bot, prefill: Record<string, unknown> = {}) {
  const def = gameDef(game);
  if (!def) return false;
  const opts = botSetup(def);
  const own: Record<string, unknown> = { ...Object.fromEntries(opts.map((o) => [o.key, o.initial])), ...prefill, botTeams: 0 };
  delete own.teams;
  const level = (own.botLevel as BotLevel) ?? 'medium';
  const n = Math.min(def.bots?.max ?? 3, Math.max(def.bots?.min ?? 1, Number(own.botCount) || 1));
  own.botCount = n;
  const signedIn = !!useSession.getState().userId;
  if (await engine.gate.mustSignIn('bots', signedIn)) {
    router.push(`/play/${game}/gate?mode=bots`);
    return false;
  }
  if (!alwaysFree({ game, mode: 'bots', settings: own }) && !(await needSparks(sparksCost(game, 'bots', own)))) return false;
  const me = useAccount.getState().profile;
  const bots = [rival, ...dealBots(level, n - 1, [me?.display_name ?? 'You', rival.name])];
  const play = await startPlay(game, 'bots', own, seatsFor(bots, me?.avatar, 0));
  router.push(`/play/${game}/room?play=${play.id}`);
  return true;
}
