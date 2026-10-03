import { Redirect, useLocalSearchParams } from 'expo-router';

import { ModeLanding } from '@/games/shell/ModeLanding';
import { gameDef } from '@/games/shell/registry';

export default function Landing() {
  const { game } = useLocalSearchParams<{ game: string }>();
  const def = gameDef(game);
  return def ? <ModeLanding def={def} /> : <Redirect href="/games" />;
}
