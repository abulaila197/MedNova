import { defaultKV } from '@/games/engine/storage';
import type { PlayItem, Seat, Standing } from '@/games/engine/types';
import { finishPlay, recordItem, startPlay } from '@/games/shell/flow';
import type { GameDef } from '@/games/shell/types';

const kv = defaultKV();

/** The local play already made for a match, so a reopened results screen never records it twice. */
export const playForMatch = (match: string) => kv.get<string>(`online:${match}`);

/**
 * When an online match ends, it becomes an ordinary play on the phone (mode 'online'):
 * your seat is 0, EXP is paid from the server's result (rule 6) and your misses feed Learn where the game does.
 */
export async function finishOnline(
  def: GameDef,
  match: string,
  a: { settings: Record<string, unknown>; seats: Seat[]; standings: Standing[]; score: number; items: Omit<PlayItem, 'id' | 'at' | 'playId'>[] },
) {
  const done = await playForMatch(match);
  if (done) return done;
  const play = await startPlay(def.key, 'online', a.settings, a.seats);
  await kv.set(`online:${match}`, play.id);
  for (const it of a.items) await recordItem(play, it);
  await finishPlay(def, play, a.score, a.standings);
  return play.id;
}
