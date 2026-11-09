import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { BotRoom } from '@/bots/BotRoom';
import { engine, type Play } from '@/games/engine';
import { gameDef } from '@/games/shell/registry';

/** The Vs bots room before a match (Yazan 2026-11-09): meet the bots, swap or kick them, then Start. */
export default function Room() {
  const { game, play: playId, left } = useLocalSearchParams<{ game: string; play: string; left?: string }>();
  const def = gameDef(game);
  const [play, setPlay] = useState<Play | null | undefined>(undefined);
  useEffect(() => {
    engine.recorder.get(playId).then(setPlay);
  }, [playId]);
  if (!def || play === null) return <Redirect href="/games" />;
  if (!play) return null;
  if (play.mode !== 'bots') return <Redirect href={`/play/${game}`} />;
  return <BotRoom key={play.id} def={def} play={play} left={left} />;
}
