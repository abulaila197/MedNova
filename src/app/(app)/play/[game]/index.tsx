import { Redirect, useLocalSearchParams } from 'expo-router';

import { ModeLanding } from '@/games/shell/ModeLanding';
import { gameDef } from '@/games/shell/registry';

export default function Landing() {
  const { game } = useLocalSearchParams<{ game: string }>();
  const def = gameDef(game);
  if (!def) return <Redirect href="/games" />;
  // RS3: a game with its own look brings its own landing.
  const L = def.screens?.Landing ?? ModeLanding;
  return <L def={def} />;
}
