import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { engine, type Play, type Standing } from '@/games/engine';
import { finishPlay } from '@/games/shell/flow';
import { gameDef } from '@/games/shell/registry';

/** Hosts a game's play screen and does the shared start/finish/quit bookkeeping. */
export default function Run() {
  const { game, play: playId } = useLocalSearchParams<{ game: string; play: string }>();
  const def = gameDef(game);
  const [play, setPlay] = useState<Play | null | undefined>(undefined);
  useEffect(() => {
    engine.recorder.get(playId).then(setPlay);
  }, [playId]);

  // Quitting while the finish is still saving leaves for good: the results never pull the player back.
  const here = useRef(true);
  useEffect(() => {
    here.current = true;
    return () => {
      here.current = false;
    };
  }, []);
  const onFinish = useCallback(
    async (score: number, standings?: Standing[]) => {
      if (!def || !play) return;
      await finishPlay(def, play, score, standings);
      if (here.current) router.replace(`/play/${game}/results?play=${play.id}`);
    },
    [def, play, game],
  );
  // Solo and Pass the phone keep their bookmark, so the game's page offers to resume it (rule 7; Pass the phone
  // added by Yazan 2026-11-15). A Vs rivals match ends.
  const onQuit = useCallback(async () => {
    if (play && play.mode !== 'solo' && play.mode !== 'offline') await engine.recorder.discard(play.id);
    router.replace(`/play/${game}`);
  }, [play, game]);

  if (!def || play === null) return <Redirect href="/games" />;
  if (!play) return null;
  const P = def.Play[play.mode];
  return P ? <P play={play} onFinish={onFinish} onQuit={onQuit} /> : <Redirect href={`/play/${game}`} />;
}
