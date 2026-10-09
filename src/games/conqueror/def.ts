import type { GameDef } from '../shell/types';
import { MIXES } from './bank';
import { KINGDOMS } from './atlas';
import { OnlinePlay } from './OnlinePlay';

// CQ11 / QS1: Mixed, Clinical or Basic science, Mixed first and picked by default.
const MIX = { key: 'mix', label: 'Questions', choices: MIXES, initial: 'mixed' };

/** The Conqueror (CQ1-CQ21): online only, 2 to 6 players, each on their own phone. */
export const conqueror: GameDef = {
  key: 'the-conqueror',
  modes: [
    {
      mode: 'online',
      title: 'The Last Empire',
      blurb: 'Answer to raise troops, then march on your rivals across an invented continent. 2 to 6 players.',
      howTo: [
        'Everyone starts with a capital and 2 outposts on a new map every match.',
        'Each stage has 2 solo rounds on a 60-number board: questions raise troops, 11 numbers hide action cards.',
        'Then a versus round against everyone for bonus troops.',
        'In the Gap you play cards, make alliances and send up to 2 troop moves at any land.',
        'Lose your capital and you are out. After 6 stages the most lands wins.',
      ],
    },
  ],
  setup: { online: [MIX] },
  players: { online: { min: 2, max: 6 } },
  Play: {},
  Online: OnlinePlay,
  palette: { seats: KINGDOMS, teams: [] },
  exp: () => 0,
  expCap: () => 0,
};
