import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Back } from '@/features/learn/Back';
import { GAMES } from '@/data/games';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import type { Mode } from '../engine/types';
import { startPlay } from './flow';
import type { GameDef } from './types';
import { Body, Btn, Card, Chips, GameScreen, Kick, Title } from './ui';

/** Shared setup: the game's options as chips. Rule 9: they lock when the game starts. `prefill` comes from "Change settings". */
export function Setup({ def, mode, prefill }: { def: GameDef; mode: Mode; prefill?: Record<string, unknown> }) {
  const t = useTheme();
  const g = GAMES.find((x) => x.key === def.key)!;
  const opts = def.setup[mode] ?? [];
  const [vals, setVals] = useState<Record<string, string | number>>(() =>
    Object.fromEntries(opts.map((o) => [o.key, (prefill?.[o.key] as string | number | undefined) ?? o.initial])),
  );
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    const play = await startPlay(def.key, mode, vals);
    router.replace(`/play/${def.key}/run?play=${play.id}`);
  };

  return (
    <GameScreen>
      <Back label={`${g.lead} ${g.em}`} fallback={`/play/${def.key}`} />
      <View style={{ gap: u(6) }}>
        <Kick>Set up your game</Kick>
        <Title lead={g.lead} em={g.em} size={26} />
      </View>
      {opts.map((o) => (
        <Card key={o.key}>
          <Text style={[s.lbl, { color: t.white }]}>{o.label}</Text>
          <Chips choices={o.choices} value={vals[o.key]} onChange={(v) => setVals((p) => ({ ...p, [o.key]: v }))} />
        </Card>
      ))}
      <Body style={{ textAlign: 'center' }}>Settings lock once the game starts.</Body>
      <Btn label="Start" onPress={start} disabled={busy} />
    </GameScreen>
  );
}

const s = StyleSheet.create({ lbl: { fontFamily: F.bodySemi, fontSize: u(12.5), lineHeight: u(16) } });
