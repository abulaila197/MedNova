import type { GameDef } from '../shell/types';
import { OfflinePlay } from './OfflinePlay';
import { TERMS } from './offline';

const count = (style: string) => TERMS.filter((x) => x.style === style).length.toLocaleString('en-US');

const STYLE = {
  key: 'style',
  label: 'Words',
  choices: [
    { value: 'mixed', label: 'Mixed', note: 'half and half' },
    {
      value: 'clinical',
      label: 'Clinical',
      note: `${count('clinical')} words`,
    },
    { value: 'basic', label: 'Basic science', note: `${count('basic')} words` },
  ],
  initial: 'mixed',
};

/** Code Clinic (CC1-CC4): medical Codenames on Yazan's engine, Red vs Blue, 4 to 6 players. */
export const codeClinic: GameDef = {
  key: 'code-clinic',
  modes: [
    {
      mode: 'offline',
      title: 'Pass the phone',
      blurb: 'Two teams, one board of 25 medical words. Find yours, never the deadly one.',
      howTo: [
        'Add 4 to 6 players and split them into Red and Blue, 2 or 3 a team. Each team picks a spymaster.',
        'The spymasters hold the phone in turn to see the key: which words are Red, Blue, neutral, and the one deadly word.',
        'On your turn the spymaster says one word and a number out loud, like "Heart, 2", within 60 seconds.',
        'Your team taps the cards it thinks match, up to the number plus one, in 60 seconds. A neutral or enemy card ends the turn.',
        'Turn over all your cards to win. Touch the deadly card and your team loses. No EXP in this mode.',
      ],
    },
  ],
  setup: { offline: [STYLE] },
  players: { offline: { min: 4, max: 6 } },
  playersNote: () => 'You pick the teams and spymasters on the next page. Pass the phone earns no EXP.',
  Play: { offline: OfflinePlay },
  // CC2: Pass the phone earns no EXP; Online gives winners 60 and losers 20.
  exp: () => 0,
  expCap: (_settings, mode) => (mode === 'online' ? 60 : 0),
  itemLabel: (item) => {
    const d = item.gameData as {
      team?: string;
      winner?: string;
      spymaster?: boolean;
    };
    const team = d.team === 'red' ? 'Red' : 'Blue';
    return `${team} team${d.spymaster ? ', spymaster' : ''} · ${d.team === d.winner ? 'won' : 'lost'}`;
  },
  itemNoun: 'game',
  itemsTitle: 'Games',
};
