import { router } from 'expo-router';
import { useState } from 'react';

import type { Mode, Seat } from '../engine/types';
import { startPlay } from './flow';
import { presetTeam, type Team } from './teams';
import type { GameDef } from './types';

/** Player colours for one-phone games (decision DPO1: name + colour). */
export const SEAT_COLORS = ['#6fd6ff', '#a48bff', '#ff7aa8', '#f5b041', '#34d399', '#ff8a5b'];

/** Everything a setup page does, apart from how it looks: option values, players, teams and Start (rule 9). */
export function useSetup(def: GameDef, mode: Mode, prefill?: Record<string, unknown>, prefillSeats?: Seat[]) {
  const colors = def.palette?.seats ?? SEAT_COLORS;
  const preset = (id: number): Team => (def.palette ? { id, ...def.palette.teams[id % def.palette.teams.length] } : presetTeam(id));
  const opts = def.setup[mode] ?? [];
  const [vals, setVals] = useState<Record<string, string | number>>(() =>
    Object.fromEntries(opts.map((o) => [o.key, (prefill?.[o.key] as string | number | undefined) ?? o.initial])),
  );
  const [busy, setBusy] = useState(false);
  const range = def.players?.[mode];
  const [seats, setSeats] = useState<Seat[]>(() =>
    prefillSeats?.length
      ? prefillSeats.map((x, i) => ({ seat: i, name: x.name, color: x.color ?? colors[i], team: x.team }))
      : Array.from({ length: range?.min ?? 1 }, (_, i) => ({ seat: i, name: i === 0 ? 'You' : `Player ${i + 1}`, color: colors[i] })),
  );

  // TM1: optional teams, set by the host here. Players take their team's colour.
  const canTeam = !!range && !!def.teams?.[mode];
  const [teams, setTeams] = useState<Team[] | null>(() => {
    const t = prefill?.teams as Team[] | undefined;
    return canTeam && Array.isArray(t) && t.length >= 2 ? t : null;
  });
  const emptyTeam = teams?.find((tm) => !seats.some((x) => x.team === tm.id));

  const setSeat = (i: number, patch: Partial<Seat>) => setSeats((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addSeat = () =>
    setSeats((p) => [...p, { seat: p.length, name: `Player ${p.length + 1}`, color: colors.find((c) => !p.some((x) => x.color === c)), team: teams ? teams[p.length % teams.length].id : undefined }]);
  const removeSeat = (i: number) => setSeats((p) => p.filter((_, j) => j !== i).map((x, j) => ({ ...x, seat: j })));

  /** TM1-TM4: n teams (keeping valid picks, else dealing players round the teams), or 0 for off. */
  const teamCount = (n: number) => {
    if (!n) {
      setTeams(null);
      setSeats((p) => p.map(({ team: _t, ...x }) => x));
      return;
    }
    setTeams(Array.from({ length: n }, (_, i) => teams?.[i] ?? preset(i)));
    setSeats((p) => p.map((x, i) => ({ ...x, team: x.team != null && x.team < n ? x.team : i % n })));
  };
  const renameTeam = (i: number, name: string) => setTeams((ts) => ts && ts.map((y, j) => (j === i ? { ...y, name } : y)));
  const teamChoices = [{ value: 0, label: 'Off' }, ...Array.from({ length: Math.max(0, Math.min(6, seats.length) - 1) }, (_, i) => ({ value: i + 2, label: String(i + 2) }))];

  const start = async () => {
    setBusy(true);
    const named = range
      ? seats.map((x, i) => {
          const tm = teams?.find((y) => y.id === x.team);
          return { seat: i, name: x.name.trim() || `Player ${i + 1}`, color: tm?.color ?? x.color, ...(tm ? { team: tm.id } : null) };
        })
      : undefined;
    const settings = teams ? { ...vals, teams: teams.map((x) => ({ ...x, name: x.name.trim() || preset(x.id).name })) } : vals;
    const play = await startPlay(def.key, mode, settings, named);
    router.replace(`/play/${def.key}/run?play=${play.id}`);
  };

  return { opts, vals, setVals, range, seats, colors, setSeat, addSeat, removeSeat, canTeam, teams, teamCount, renameTeam, teamChoices, preset, emptyTeam, busy, start };
}
