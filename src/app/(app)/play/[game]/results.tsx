import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { engine, type Play, type PlayItem } from '@/games/engine';
import { gameDef } from '@/games/shell/registry';
import { Results } from '@/games/shell/Results';

export default function ResultsPage() {
  const { game, play: playId } = useLocalSearchParams<{ game: string; play: string }>();
  const def = gameDef(game);
  const [data, setData] = useState<{ play: Play | null; items: PlayItem[] } | null>(null);
  useEffect(() => {
    (async () => setData({ play: await engine.recorder.get(playId), items: await engine.recorder.itemsOf(playId) }))();
  }, [playId]);
  if (!def) return <Redirect href="/games" />;
  if (!data) return null;
  if (!data.play) return <Redirect href="/games" />;
  return <Results def={def} play={data.play} items={data.items} />;
}
