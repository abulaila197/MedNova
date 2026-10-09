import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { engine, type Mode, type Seat } from '@/games/engine';
import { gameDef } from '@/games/shell/registry';
import { Setup } from '@/games/shell/Setup';
import { OnlineSetup } from '@/online/OnlineSetup';

export default function SetupPage() {
  const { game, mode, from } = useLocalSearchParams<{ game: string; mode: Mode; from?: string }>();
  const def = gameDef(game);
  const [prefill, setPrefill] = useState<Record<string, unknown> | null | undefined>(from ? undefined : null);
  const [seats, setSeats] = useState<Seat[] | undefined>(undefined);
  useEffect(() => {
    if (from)
      engine.recorder.get(from).then((p) => {
        setSeats(p?.seats.filter((x) => !x.removed));
        setPrefill(p?.settings ?? null);
      });
  }, [from]);
  if (!def) return <Redirect href="/games" />;
  if (prefill === undefined) return null;
  // ON20 + ON27: online gets Join/Create in the game's own setup look.
  if (mode === 'online') {
    const O = def.screens?.OnlineSetup ?? OnlineSetup;
    return <O def={def} prefill={prefill ?? undefined} />;
  }
  const S = def.screens?.Setup ?? Setup;
  return <S def={def} mode={mode} prefill={prefill ?? undefined} prefillSeats={seats} />;
}
