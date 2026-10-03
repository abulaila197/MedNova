import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Back } from '@/features/learn/Back';
import { GAMES } from '@/data/games';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import type { Mode, Seat } from '../engine/types';
import { startPlay } from './flow';
import type { GameDef } from './types';
import { Body, Btn, Card, Chips, GameScreen, Ghost, Kick, Title } from './ui';

/** Player colours for one-phone games (decision DPO1: name + colour). */
export const SEAT_COLORS = ['#6fd6ff', '#a48bff', '#ff7aa8', '#f5b041', '#34d399', '#ff8a5b'];

/** Shared setup: the game's options as chips. Rule 9: they lock when the game starts. `prefill` comes from "Change settings". */
export function Setup({ def, mode, prefill, prefillSeats }: { def: GameDef; mode: Mode; prefill?: Record<string, unknown>; prefillSeats?: Seat[] }) {
  const t = useTheme();
  const g = GAMES.find((x) => x.key === def.key)!;
  const opts = def.setup[mode] ?? [];
  const [vals, setVals] = useState<Record<string, string | number>>(() =>
    Object.fromEntries(opts.map((o) => [o.key, (prefill?.[o.key] as string | number | undefined) ?? o.initial])),
  );
  const [busy, setBusy] = useState(false);
  const range = def.players?.[mode];
  const [seats, setSeats] = useState<Seat[]>(() =>
    prefillSeats?.length
      ? prefillSeats.map((x, i) => ({ seat: i, name: x.name, color: x.color ?? SEAT_COLORS[i] }))
      : Array.from({ length: range?.min ?? 1 }, (_, i) => ({ seat: i, name: i === 0 ? 'You' : `Player ${i + 1}`, color: SEAT_COLORS[i] })),
  );

  const start = async () => {
    setBusy(true);
    const named = range ? seats.map((x, i) => ({ seat: i, name: x.name.trim() || `Player ${i + 1}`, color: x.color })) : undefined;
    const play = await startPlay(def.key, mode, vals, named);
    router.replace(`/play/${def.key}/run?play=${play.id}`);
  };

  return (
    <GameScreen>
      <Back label={`${g.lead} ${g.em}`} fallback={`/play/${def.key}`} />
      <View style={{ gap: u(6) }}>
        <Kick>Set up your game</Kick>
        <Title lead={g.lead} em={g.em} size={26} />
      </View>
      {range ? <Players seats={seats} setSeats={setSeats} min={range.min} max={range.max} /> : null}
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

/** Players for a one-phone game: a name and a colour each. Player 1 is the phone owner (DPO6). */
function Players({ seats, setSeats, min, max }: { seats: Seat[]; setSeats: (f: (p: Seat[]) => Seat[]) => void; min: number; max: number }) {
  const t = useTheme();
  const set = (i: number, patch: Partial<Seat>) => setSeats((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const add = () =>
    setSeats((p) => [...p, { seat: p.length, name: `Player ${p.length + 1}`, color: SEAT_COLORS.find((c) => !p.some((x) => x.color === c)) }]);
  const remove = (i: number) => setSeats((p) => p.filter((_, j) => j !== i).map((x, j) => ({ ...x, seat: j })));
  return (
    <Card>
      <Text style={[s.lbl, { color: t.white }]}>Players</Text>
      {seats.map((x, i) => (
        <View key={i} style={s.prow}>
          <View style={[s.pin, { borderColor: x.color ?? t.chipLine, backgroundColor: t.chip }]}>
            <TextInput
              value={x.name}
              onChangeText={(v) => set(i, { name: v })}
              maxLength={14}
              placeholder={`Player ${i + 1}`}
              placeholderTextColor={t.dim}
              style={[s.pname, { color: t.fg }]}
              accessibilityLabel={`Player ${i + 1} name`}
            />
            {seats.length > min ? (
              <Pressable onPress={() => remove(i)} hitSlop={u(6)} accessibilityRole="button" accessibilityLabel={`Remove player ${i + 1}`}>
                <Text style={[s.px, { color: t.dim }]}>✕</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={s.sw}>
            {SEAT_COLORS.map((c) => {
              const taken = seats.some((o, j) => j !== i && o.color === c);
              const on = x.color === c;
              return (
                <Pressable
                  key={c}
                  disabled={taken}
                  onPress={() => set(i, { color: c })}
                  style={[s.swb, { backgroundColor: c, opacity: taken ? 0.2 : 1, borderColor: on ? t.white : 'transparent' }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled: taken }}
                  accessibilityLabel={`Colour ${c} for player ${i + 1}`}
                />
              );
            })}
          </View>
        </View>
      ))}
      {seats.length < max ? <Ghost label="Add player" onPress={add} /> : null}
      <Body>Player 1 is you, the phone owner. Only your points earn EXP and only your missed cases go to Learn.</Body>
    </Card>
  );
}

const s = StyleSheet.create({
  lbl: { fontFamily: F.bodySemi, fontSize: u(12.5), lineHeight: u(16) },
  prow: { gap: u(6) },
  pin: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: u(12), paddingHorizontal: u(11) },
  pname: { flex: 1, minWidth: 0, fontFamily: F.bodySemi, fontSize: u(12), paddingVertical: u(8), ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
  px: { fontFamily: F.bodyBold, fontSize: u(11) },
  sw: { flexDirection: 'row', gap: u(8), paddingLeft: u(2) },
  swb: { width: u(18), height: u(18), borderRadius: u(9), borderWidth: 2 },
});
