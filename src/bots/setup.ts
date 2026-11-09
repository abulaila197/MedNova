import type { Seat } from '@/games/engine/types';
import { SEAT_COLOURS } from '@/games/shell/characters';
import { presetTeam } from '@/games/shell/teams';
import type { GameDef, SetupOption } from '@/games/shell/types';
import { useAccount } from '@/state/account';

import { dealBots } from './core';
import type { Bot, BotLevel } from './types';

/** The Vs bots choices every game shares, after the game's own options (Yazan 2026-11-09). */
export function botSetup(def: GameDef): SetupOption[] {
  const range = def.bots ?? { min: 1, max: 3 };
  const counts = Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i);
  const own = def.setup.bots ?? [];
  const extra: SetupOption[] = [
    {
      key: 'botLevel',
      label: 'Rivals',
      choices: [
        { value: 'easy', label: 'Easy', note: 'mostly Dumb' },
        { value: 'medium', label: 'Medium', note: 'mostly Hardworker' },
        { value: 'hard', label: 'Hard', note: 'mostly Nerd' },
      ],
      initial: 'medium',
    },
    { key: 'botCount', label: 'How many', choices: counts.map((n) => ({ value: n, label: String(n) })), initial: Math.min(range.max, 3) },
  ];
  // Teams with bots (Yazan 2026-11-09): you and bot teammates against a bot team.
  if (def.teams?.bots) extra.push({ key: 'botTeams', label: 'Teams', choices: [{ value: 0, label: 'Off' }, { value: 2, label: '2 teams' }], initial: 0 });
  return [...own, ...extra];
}

/** A seat's colour: one of the 8, in seat order (bots never share yours). */
const colourOf = (i: number) => SEAT_COLOURS[i % SEAT_COLOURS.length].color;

/** The seats for a new Vs bots play: you first, then the dealt bots. */
export function botSeats(def: GameDef, settings: Record<string, unknown>): { seats: Seat[]; settings: Record<string, unknown> } {
  const level = (settings.botLevel as BotLevel) ?? 'medium';
  const n = Number(settings.botCount) || 1;
  const me = useAccount.getState().profile;
  const bots = dealBots(level, n, me?.display_name ? [me.display_name] : []);
  const seats = seatsFor(bots, me?.avatar, Number(settings.botTeams) || 0);
  const teams = Number(settings.botTeams) >= 2 ? { teams: [presetTeam(0), presetTeam(1)] } : null;
  return { seats, settings: { ...teams } };
}

/** You at seat 0, then each bot. With teams, you lead team 1 and the bots are dealt to keep the teams even. */
export function seatsFor(bots: Bot[], myFace: string | undefined, teams: number): Seat[] {
  const out: Seat[] = [{ seat: 0, name: 'You', color: colourOf(0), character: myFace, ...(teams >= 2 ? { team: 0 } : null) }];
  bots.forEach((b, i) => {
    const team = teams >= 2 ? (i % 2 === 0 ? 1 : 0) : undefined;
    out.push({ seat: i + 1, name: b.name, color: teams >= 2 ? presetTeam(team!).color : colourOf(i + 1), character: b.character, bot: b, ...(team != null ? { team } : null) });
  });
  if (teams >= 2) out[0].color = presetTeam(0).color;
  return out;
}

/** The bots of a play (its live seats), in seat order. */
export const botsOf = (seats: Seat[]) => seats.filter((x) => !x.removed && x.bot).map((x) => x.bot!);
