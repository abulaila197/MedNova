// Pass the phone: Yazan's engine (offlineMachine + gameCore) runs on the phone. Seats are split into Red and Blue
// on the team page; seat 0 is the phone owner.
import { sfx } from '@/lib/sound';

import termsJson from './data/terms.json';
import { newBoard } from './engine/board';
import type { GameEffect } from './engine/gameCore';
import type { OfflineRoster } from './engine/offlineMachine';
import type { Team, Term } from './engine/types';

export const TERMS = termsJson as Term[];

/** Seats on each team, in the order they were placed (the spymaster rotates through it on a rematch). */
export type Split = {
  red: number[];
  blue: number[];
  spymaster: Record<Team, number>;
};

/** Seats dealt round the two teams (1st red, 2nd blue, ...), the first player of each team as spymaster. */
export function dealTeams(seats: number[]): Split {
  return {
    red: seats.filter((_, i) => i % 2 === 0),
    blue: seats.filter((_, i) => i % 2 === 1),
    spymaster: { red: 0, blue: 0 },
  };
}

export const rosterOf = (split: Split, nameOf: (seat: number) => string): OfflineRoster => ({
  red: split.red.map(nameOf),
  blue: split.blue.map(nameOf),
  spymaster: split.spymaster,
});

export const board = (style: Parameters<typeof newBoard>[1]) => newBoard(TERMS, style, Math.random);

/** The engine's sounds, on the app's six. */
export function playEffects(effects: readonly { type: string }[]) {
  const ids = new Set(effects.flatMap((e) => ((e as GameEffect).type === 'sound' ? [(e as Extract<GameEffect, { type: 'sound' }>).id] : [])));
  const timeUp = effects.some((e) => (e as GameEffect).type === 'notice' && /TIMEOUT/.test((e as Extract<GameEffect, { type: 'notice' }>).code));
  if (ids.has('win')) void sfx('win');
  else if (ids.has('assassin') || ids.has('wrong')) void sfx('wrong');
  else if (timeUp) void sfx('timeup');
  else if (ids.has('correct')) void sfx('right');
  else if (ids.has('neutral') || ids.has('clue')) void sfx('tap');
}
