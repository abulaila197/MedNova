import { useLocalSearchParams } from 'expo-router';

import type { Mode } from '@/games/engine';
import { TrialGate } from '@/games/shell/TrialGate';

export default function Gate() {
  const { game, mode } = useLocalSearchParams<{ game: string; mode: Mode }>();
  return <TrialGate game={game} mode={mode} />;
}
