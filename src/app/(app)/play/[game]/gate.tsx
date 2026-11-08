import { Redirect, useLocalSearchParams } from 'expo-router';

import type { Mode } from '@/games/engine';
import { gameDef } from '@/games/shell/registry';
import { useSession } from '@/games/shell/session';
import { TrialGate } from '@/games/shell/TrialGate';

export default function Gate() {
  const { game, mode } = useLocalSearchParams<{ game: string; mode: Mode }>();
  const signedIn = useSession((s) => !!s.userId);
  const def = gameDef(game);
  const G = def?.screens?.Gate;
  // The gate is for guests: coming back here after signing in goes on to the game's page, not a stale "Sign in" (AP10e).
  if (signedIn) return <Redirect href={`/play/${game}`} />;
  return def && G ? <G def={def} mode={mode} /> : <TrialGate game={game} mode={mode} />;
}
