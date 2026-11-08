import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { engine, type Play, type PlayItem } from '@/games/engine';
import { gameDef } from '@/games/shell/registry';
import { sfx } from '@/lib/sound';
import { Results } from '@/games/shell/Results';

export default function ResultsPage() {
  const { game, play: playId } = useLocalSearchParams<{ game: string; play: string }>();
  const def = gameDef(game);
  const [data, setData] = useState<{ play: Play | null; items: PlayItem[] } | null>(null);
  useEffect(() => {
    (async () => {
      const play = await engine.recorder.get(playId);
      setData({ play, items: await engine.recorder.itemsOf(playId) });
      // The win sound, once, as a game just ended (not when old results are reopened): first place with others
      // playing, or any score when playing alone.
      if (play?.endedAt && Date.now() - play.endedAt < 60_000) {
        const first = play.standings.length > 1 ? play.standings.find((x) => x.seat === 0)?.rank === 1 : play.score > 0;
        if (first) void sfx('win');
      }
    })();
  }, [playId]);
  if (!def) return <Redirect href="/games" />;
  if (!data) return null;
  if (!data.play) return <Redirect href="/games" />;
  const Rs = def.screens?.Results ?? Results;
  return <Rs def={def} play={data.play} items={data.items} />;
}
