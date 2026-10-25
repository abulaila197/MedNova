import { router } from 'expo-router';
import { useState } from 'react';

import { sparksCost } from '@/features/sparks/costs';
import { needSparks } from '@/features/sparks/sparks';

import type { Mode, Seat } from '../engine/types';
import { alwaysFree, startPlay } from './flow';
import { freeColour, SEAT_COLOURS } from './characters';
import { presetTeam, type Team } from './teams';
import type { GameDef } from './types';


/** Everything a setup page does, apart from how it looks: option values, players, teams and Start (rule 9). */
export function useSetup(def: GameDef, mode: Mode, prefill?: Record<string, unknown>, prefillSeats?: Seat[]) {
  const preset = (id: number): Team => (def.palette ? { id, ...def.palette.teams[id % def.palette.teams.length] } : presetTeam(id));
  const opts = def.setup[mode] ?? [];
  const [vals, setVals] = useState<Record<string, string | number>>(() =>
    Object.fromEntries(opts.map((o) => [o.key, (prefill?.[o.key] as string | number | undefined) ?? o.initial])),
  );
  const [busy, setBusy] = useState(false);
  const range = def.players?.[mode];
  // Every player picks one of the 8 colours (Yazan 2026-10-18); characters live in Profile.
  const [seats, setSeats] = useState<Seat[]>(() => {
    if (!prefillSeats?.length) return Array.from({ length: range?.min ?? 1 }, (_, i) => ({ seat: i, name: i === 0 ? 'You' : `Player ${i + 1}`, color: SEAT_COLOURS[i].color }));
    const out: Seat[] = [];
    prefillSeats.forEach((x, i) => {
      const keep = SEAT_COLOURS.some((c) => c.color === x.color) && !out.some((o) => o.color === x.color);
      out.push({ seat: i, name: x.name, color: keep ? x.color : freeColour(out.map((o) => o.color)), team: x.team });
    });
    return out;
  });

  // TM1: optional teams, set by the host here. Players take their team's colour.
  const canTeam = !!range && !!def.teams?.[mode];
  const [teams, setTeams] = useState<Team[] | null>(() => {
    const t = prefill?.teams as Team[] | undefined;
    return canTeam && Array.isArray(t) && t.length >= 2 ? t : null;
  });
  const emptyTeam = teams?.find((tm) => !seats.some((x) => x.team === tm.id));

  const setSeat = (i: number, patch: Partial<Seat>) => setSeats((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const pickColour = (i: number, color: string) => {
    if (!seats.some((o, j) => j !== i && o.color === color)) setSeat(i, { color });
  };
  const addSeat = () =>
    setSeats((p) => {
      const color = freeColour(p.map((x) => x.color));
      return [...p, { seat: p.length, name: `Player ${p.length + 1}`, color, team: teams ? teams[p.length % teams.length].id : undefined }];
    });
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
    // The chosen setup sets the cost; too few Sparks opens the Recharge sheet first (#70). Daily Medicordle is free (TR3).
    if (!alwaysFree({ game: def.key, mode, settings: vals }) && !(await needSparks(sparksCost(def.key, mode, vals)))) return;
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

  return { opts, vals, setVals, range, seats, setSeat, pickColour, addSeat, removeSeat, canTeam, teams, teamCount, renameTeam, teamChoices, preset, emptyTeam, busy, start };
}
