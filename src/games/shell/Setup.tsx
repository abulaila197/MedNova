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
import { presetTeam, type Team } from './teams';
import type { GameDef } from './types';
import { Btn, Card, Chips, GameScreen, Title } from './ui';

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
      ? prefillSeats.map((x, i) => ({ seat: i, name: x.name, color: x.color ?? SEAT_COLORS[i], team: x.team }))
      : Array.from({ length: range?.min ?? 1 }, (_, i) => ({ seat: i, name: i === 0 ? 'You' : `Player ${i + 1}`, color: SEAT_COLORS[i] })),
  );

  // TM1: optional teams, set by the host here. Players take their team's colour.
  const canTeam = !!range && !!def.teams?.[mode];
  const [teams, setTeams] = useState<Team[] | null>(() => {
    const t = prefill?.teams as Team[] | undefined;
    return canTeam && Array.isArray(t) && t.length >= 2 ? t : null;
  });
  const emptyTeam = teams?.find((tm) => !seats.some((x) => x.team === tm.id));

  const start = async () => {
    setBusy(true);
    const named = range
      ? seats.map((x, i) => {
          const tm = teams?.find((y) => y.id === x.team);
          return { seat: i, name: x.name.trim() || `Player ${i + 1}`, color: tm?.color ?? x.color, ...(tm ? { team: tm.id } : null) };
        })
      : undefined;
    const settings = teams ? { ...vals, teams: teams.map((x) => ({ ...x, name: x.name.trim() || presetTeam(x.id).name })) } : vals;
    const play = await startPlay(def.key, mode, settings, named);
    router.replace(`/play/${def.key}/run?play=${play.id}`);
  };

  // Compact on purpose: every game's setup fits one phone screen without scrolling (Yazan, 2026-10-05).
  return (
    <GameScreen bodyStyle={{ paddingTop: u(10), gap: u(10) }}>
      <Back label={`${g.lead} ${g.em}`} fallback={`/play/${def.key}`} />
      <Title lead={g.lead} em={g.em} size={21} />
      {canTeam || opts.length ? (
        <Card style={s.card}>
          {canTeam ? <Teams teams={teams} setTeams={setTeams} seats={seats} setSeats={setSeats} /> : null}
          {opts.map((o, i) => (
            <View key={o.key} style={[s.opt, (canTeam || i > 0) && { borderTopWidth: 1, borderTopColor: t.panelLine, paddingTop: u(8) }]}>
              <View style={s.line}>
                <Text style={[s.lbl, s.side, { color: t.white }]}>{o.label}</Text>
                <View style={{ flex: 1 }}>
                  <Chips choices={o.choices} value={vals[o.key]} onChange={(v) => setVals((p) => ({ ...p, [o.key]: v }))} />
                </View>
              </View>
            </View>
          ))}
        </Card>
      ) : null}
      {range ? <Players seats={seats} setSeats={setSeats} min={range.min} max={range.max} note={def.playersNote?.(seats.length)} teams={teams} /> : null}
      <Text style={[s.small, { color: t.dim, textAlign: 'center' }]}>
        {emptyTeam ? `${emptyTeam.name} has no players yet.` : 'Settings lock once the game starts.'}
      </Text>
      <Btn label="Start" onPress={start} disabled={busy || !!emptyTeam} />
    </GameScreen>
  );
}

/** Players for a one-phone game: a name and a colour each. Player 1 is the phone owner (DPO6). */
function Players({ seats, setSeats, min, max, note, teams }: { seats: Seat[]; setSeats: (f: (p: Seat[]) => Seat[]) => void; min: number; max: number; note?: string; teams: Team[] | null }) {
  const t = useTheme();
  const set = (i: number, patch: Partial<Seat>) => setSeats((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const add = () =>
    setSeats((p) => [...p, { seat: p.length, name: `Player ${p.length + 1}`, color: SEAT_COLORS.find((c) => !p.some((x) => x.color === c)), team: teams ? teams[p.length % teams.length].id : undefined }]);
  const remove = (i: number) => setSeats((p) => p.filter((_, j) => j !== i).map((x, j) => ({ ...x, seat: j })));
  return (
    <Card style={s.card}>
      <View style={s.head}>
        <Text style={[s.lbl, { color: t.white }]}>Players</Text>
        {seats.length < max ? (
          <Pressable onPress={add} hitSlop={u(8)} accessibilityRole="button" accessibilityLabel="Add player">
            <Text style={[s.add, { color: t.accent }]}>+ Add player</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={s.grid}>
      {seats.map((x, i) => {
        // Team dots sit inside the name box for up to 3 teams, under it for more.
        const teamDots = teams ? (
          <View style={teams.length <= 3 ? s.tin : s.sw}>
            {teams.map((tm) => {
              const on = x.team === tm.id;
              return (
                <Pressable
                  key={tm.id}
                  onPress={() => set(i, { team: tm.id })}
                  hitSlop={u(3)}
                  style={[s.tchip, { borderColor: on ? tm.color : t.chipLine, backgroundColor: on ? tm.color : 'transparent' }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Put player ${i + 1} in ${tm.name}`}
                />
              );
            })}
          </View>
        ) : null;
        return (
        <View key={i} style={s.prow}>
          <View style={[s.pin, { borderColor: (teams?.find((y) => y.id === x.team)?.color ?? x.color) ?? t.chipLine, backgroundColor: t.chip }]}>
            <TextInput
              value={x.name}
              onChangeText={(v) => set(i, { name: v })}
              maxLength={14}
              placeholder={`Player ${i + 1}`}
              placeholderTextColor={t.dim}
              style={[s.pname, { color: t.fg }]}
              accessibilityLabel={`Player ${i + 1} name`}
            />
            {teams && teams.length <= 3 ? teamDots : null}
            {seats.length > min ? (
              <Pressable onPress={() => remove(i)} hitSlop={u(6)} accessibilityRole="button" accessibilityLabel={`Remove player ${i + 1}`}>
                <Text style={[s.px, { color: t.dim }]}>✕</Text>
              </Pressable>
            ) : null}
          </View>
          {teams ? (teams.length > 3 ? teamDots : null) : (
            <View style={s.sw}>
              {SEAT_COLORS.map((c) => {
                const taken = seats.some((o, j) => j !== i && o.color === c);
                const on = x.color === c;
                return (
                  <Pressable
                    key={c}
                    disabled={taken}
                    onPress={() => set(i, { color: c })}
                    hitSlop={u(2)}
                    style={[s.swb, { backgroundColor: c, opacity: taken ? 0.2 : 1, borderColor: on ? t.white : 'transparent' }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on, disabled: taken }}
                    accessibilityLabel={`Colour ${c} for player ${i + 1}`}
                  />
                );
              })}
            </View>
          )}
        </View>
        );
      })}
      </View>
      <Text style={[s.small, { color: t.mute }]}>{note ?? 'Player 1 is you, the phone owner. Offline earns no EXP; only your missed cases go to Learn.'}</Text>
    </Card>
  );
}

/** TM1-TM4: teams on or off, how many, and their names (preset colour each; the host can rename). */
function Teams({ teams, setTeams, seats, setSeats}: { teams: Team[] | null; setTeams: (t: Team[] | null) => void; seats: Seat[]; setSeats: (f: (p: Seat[]) => Seat[]) => void }) {
  const t = useTheme();
  const count = teams?.length ?? 0;
  const max = Math.min(6, seats.length);
  const make = (n: number) => {
    const next = Array.from({ length: n }, (_, i) => teams?.[i] ?? presetTeam(i));
    setTeams(next);
    // Everyone gets a team: keep a valid pick, otherwise deal players round the teams in order.
    setSeats((p) => p.map((x, i) => ({ ...x, team: x.team != null && x.team < n ? x.team : i % n })));
  };
  const off = () => {
    setTeams(null);
    setSeats((p) => p.map(({ team: _t, ...x }) => x));
  };
  const choices = [{ value: 0, label: 'Off' }, ...Array.from({ length: Math.max(0, max - 1) }, (_, i) => ({ value: i + 2, label: String(i + 2) }))];
  return (
    <View style={s.opt}>
      <View style={s.line}>
        <Text style={[s.lbl, s.side, { color: t.white }]}>Teams</Text>
        <View style={{ flex: 1 }}>
          <Chips choices={choices} value={count} onChange={(v) => (v ? make(Number(v)) : off())} />
        </View>
      </View>
      {teams ? (
        <View style={s.tnames}>
          {teams.map((tm, i) => (
            <View key={tm.id} style={[s.pin, s.tname, { borderColor: tm.color, backgroundColor: t.chip }]}>
              <View style={[s.tdot, { backgroundColor: tm.color, marginRight: u(6) }]} />
              <TextInput
                value={tm.name}
                onChangeText={(v) => setTeams(teams.map((y, j) => (j === i ? { ...y, name: v } : y)))}
                maxLength={16}
                placeholder={presetTeam(tm.id).name}
                placeholderTextColor={t.dim}
                style={[s.pname, { color: t.fg }]}
                accessibilityLabel={`Team ${i + 1} name`}
              />
            </View>
          ))}
        </View>
      ) : null}
      {teams ? <Text style={[s.small, { color: t.mute }]}>{'Tap a dot by each player to pick their team.'}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { padding: u(10), gap: u(7) },
  opt: { gap: u(5) },
  line: { flexDirection: 'row', alignItems: 'center', gap: u(8) },
  side: { width: u(62) },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  add: { fontFamily: F.bodySemi, fontSize: u(11) },
  small: { fontFamily: F.body, fontSize: u(9.5), lineHeight: u(13) },
  tnames: { flexDirection: 'row', flexWrap: 'wrap', gap: u(6) },
  tname: { flexBasis: '47%', flexGrow: 1, flex: 1 },
  tin: { flexDirection: 'row', gap: u(4), marginRight: u(6) },
  tchip: { width: u(12), height: u(12), borderRadius: u(6), borderWidth: 1.5 },
  tdot: { width: u(8), height: u(8), borderRadius: u(4) },
  lbl: { fontFamily: F.bodySemi, fontSize: u(11), lineHeight: u(14) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: u(8), rowGap: u(8) },
  prow: { width: '48%', flexGrow: 1, gap: u(5) },
  pin: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: u(10), paddingHorizontal: u(9) },
  pname: { flex: 1, minWidth: 0, fontFamily: F.bodySemi, fontSize: u(11), paddingVertical: u(4.5), ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null) },
  px: { fontFamily: F.bodyBold, fontSize: u(10) },
  sw: { flexDirection: 'row', gap: u(5), paddingLeft: u(2) },
  swb: { width: u(14), height: u(14), borderRadius: u(7), borderWidth: 2 },
});
