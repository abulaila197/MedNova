import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/AppText';

import { Back } from '@/features/learn/Back';
import { GAMES } from '@/data/games';
import { useTheme } from '@/state/app';
import { u } from '@/theme/scale';
import { F } from '@/theme/tokens';

import type { Mode, Seat } from '../engine/types';
import { CHARACTERS } from './characters';
import { Face } from './Face';
import type { Team } from './teams';
import type { GameDef } from './types';
import { useSetup } from './useSetup';
import { Btn, Card, Chips, GameScreen, Title } from './ui';

export { SEAT_COLORS } from './useSetup';

/** Shared setup: the game's options as chips. Rule 9: they lock when the game starts. `prefill` comes from "Change settings". */
export function Setup({ def, mode, prefill, prefillSeats }: { def: GameDef; mode: Mode; prefill?: Record<string, unknown>; prefillSeats?: Seat[] }) {
  const t = useTheme();
  const g = GAMES.find((x) => x.key === def.key)!;
  const st = useSetup(def, mode, prefill, prefillSeats);
  const { opts, vals, setVals, range, seats, teams, canTeam, emptyTeam, busy, start } = st;

  // Compact on purpose: every game's setup fits one phone screen without scrolling (Yazan, 2026-10-05).
  return (
    <GameScreen bodyStyle={{ paddingTop: u(10), gap: u(10) }}>
      <Back label={`${g.lead} ${g.em}`} fallback={`/play/${def.key}`} />
      <Title lead={g.lead} em={g.em} size={21} />
      {canTeam || opts.length ? (
        <Card style={s.card}>
          {canTeam ? <Teams st={st} /> : null}
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
      {range ? <Players st={st} min={range.min} max={range.max} note={def.playersNote?.(seats.length)} teams={teams} /> : null}
      <Text style={[s.small, { color: t.dim, textAlign: 'center' }]}>
        {emptyTeam ? `${emptyTeam.name} has no players yet.` : 'Settings lock once the game starts.'}
      </Text>
      <Btn label="Start" onPress={start} disabled={busy || !!emptyTeam} />
    </GameScreen>
  );
}

type SetupState = ReturnType<typeof useSetup>;

/** Players for a one-phone game: a name and a character each (AV1). Player 1 is the phone owner (DPO6). */
function Players({ st, min, max, note, teams }: { st: SetupState; min: number; max: number; note?: string; teams: Team[] | null }) {
  const t = useTheme();
  const { seats, setSeat: set, addSeat: add, removeSeat: remove, pickCharacter } = st;
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
          <View style={teams.length <= 3 ? s.tin : s.tsw}>
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
          <View style={s.sw}>
            {CHARACTERS.map((c) => {
              const taken = seats.some((o, j) => j !== i && o.character === c.slug);
              const on = x.character === c.slug;
              return (
                <Pressable
                  key={c.slug}
                  disabled={taken}
                  onPress={() => pickCharacter(i, c.slug)}
                  hitSlop={u(1)}
                  style={[s.face, { opacity: taken ? 0.2 : 1, borderColor: on ? t.white : 'transparent' }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled: taken }}
                  accessibilityLabel={`${c.name} for player ${i + 1}`}
                >
                  <Face slug={c.slug} size={u(15.5)} />
                </Pressable>
              );
            })}
          </View>
          {teams && teams.length > 3 ? teamDots : null}
        </View>
        );
      })}
      </View>
      <Text style={[s.small, { color: t.mute }]}>{note ?? 'Player 1 is you, the phone owner. Offline earns no EXP; only your missed cases go to Learn.'}</Text>
    </Card>
  );
}

/** TM1-TM4: teams on or off, how many, and their names (preset colour each; the host can rename). */
function Teams({ st }: { st: SetupState }) {
  const t = useTheme();
  const { teams, teamCount, renameTeam, teamChoices: choices, preset } = st;
  const count = teams?.length ?? 0;
  return (
    <View style={s.opt}>
      <View style={s.line}>
        <Text style={[s.lbl, s.side, { color: t.white }]}>Teams</Text>
        <View style={{ flex: 1 }}>
          <Chips choices={choices} value={count} onChange={(v) => teamCount(Number(v))} />
        </View>
      </View>
      {teams ? (
        <View style={s.tnames}>
          {teams.map((tm, i) => (
            <View key={tm.id} style={[s.pin, s.tname, { borderColor: tm.color, backgroundColor: t.chip }]}>
              <View style={[s.tdot, { backgroundColor: tm.color, marginRight: u(6) }]} />
              <TextInput
                value={tm.name}
                onChangeText={(v) => renameTeam(i, v)}
                maxLength={16}
                placeholder={preset(tm.id).name}
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
  sw: { flexDirection: 'row', flexWrap: 'wrap', gap: u(2), paddingLeft: u(1) },
  face: { padding: 1, borderRadius: u(12), borderWidth: 2 },
  tsw: { flexDirection: 'row', gap: u(5), paddingLeft: u(2) },
});
