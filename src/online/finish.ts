import { router, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { defaultKV } from '@/games/engine/storage';
import type { PlayItem, Seat, Standing } from '@/games/engine/types';
import { countPlay, finishPlay, recordItem, startPlay } from '@/games/shell/flow';
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
  await countPlay(play); // every player pays their own Sparks (TR4)
  for (const it of a.items) await recordItem(play, it);
  await finishPlay(def, play, a.score, a.standings);
  return play.id;
}

/**
 * Opens a finished match's results, but only while the match is on screen: covered by another page (the Store,
 * the menu) it waits until the player comes back, and once they left it never pulls them back (Yazan, 2026-10-13).
 * Also sends a reopened, already finished match straight to its results. Returns `show(playId)` for the finish.
 */
export function useShowResults(game: string, matchId: string, done: boolean) {
  const focused = useIsFocused();
  const shown = useRef(focused);
  useEffect(() => {
    shown.current = focused;
    return () => {
      shown.current = false;
    };
  }, [focused]);
  useEffect(() => {
    if (!done || !focused) return;
    let live = true;
    playForMatch(matchId).then((id) => live && id && router.replace(`/play/${game}/results?play=${id}`));
    return () => {
      live = false;
    };
  }, [done, focused, matchId, game]);
  return useCallback((id: string) => {
    if (shown.current) router.replace(`/play/${game}/results?play=${id}`);
  }, [game]);
}
