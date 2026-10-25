import type { GameDef } from '../shell/types';
import { OfflinePlay } from './OfflinePlay';
import { OnlinePlay } from './OnlinePlay';
import { expOf } from './online';
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
    {
      mode: 'online',
      title: 'Online',
      blurb: '4 to 6 players, each on their own phone. The spymaster types the clue.',
      howTo: [
        'Join a room with 4 to 6 players. Pick Red or Blue, 2 or 3 a team, and claim the spymaster role or let the host pick.',
        'Only the spymasters see the key on their phones: which words are Red, Blue, neutral, and the one deadly word.',
        "On your turn the spymaster types one word and a number in 60 seconds. It can't be a word on the board or part of one.",
        'Guessers tap a card to mark it for the team, then tap it again to turn it over, up to the number plus one in 60 seconds.',
        'Find all your cards to win; the deadly card loses. Winners get 60 EXP and the others 20 a game, up to 60 a match.',
      ],
    },
  ],
  setup: { offline: [STYLE], online: [STYLE] },
  players: { offline: { min: 4, max: 6 }, online: { min: 4, max: 6 } },
  playersNote: () => 'You pick the teams and spymasters on the next page. Pass the phone earns no EXP.',
  Play: { offline: OfflinePlay },
  Online: OnlinePlay,
  // CC2: Pass the phone earns no EXP; Online gives winners 60 and losers 20.
  exp: (_score, items) => expOf(items.length, items.filter((x) => x.outcome === 'right').length),
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
