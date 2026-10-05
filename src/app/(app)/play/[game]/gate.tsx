import { useLocalSearchParams } from 'expo-router';

import type { Mode } from '@/games/engine';
import { gameDef } from '@/games/shell/registry';
import { TrialGate } from '@/games/shell/TrialGate';

export default function Gate() {
  const { game, mode } = useLocalSearchParams<{ game: string; mode: Mode }>();
  const def = gameDef(game);
  const G = def?.screens?.Gate;
  return def && G ? <G def={def} mode={mode} /> : <TrialGate game={game} mode={mode} />;
}
