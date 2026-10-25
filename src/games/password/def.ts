import type { GameDef } from '../shell/types';
import { OfflinePlay } from './OfflinePlay';
import { OnlinePlay } from './OnlinePlay';
import { expOf } from './online';
import { TERMS } from './offline';

const count = (bank: string) => TERMS.filter((x) => x.bank === bank).length.toLocaleString('en-US');

const SETUP = [
  {
    key: 'bank',
    label: 'Words',
    choices: [
      { value: 'mixed', label: 'Mixed', note: 'both banks' },
      { value: 'clinical', label: 'Clinical', note: `${count('clinical')} terms` },
      { value: 'basic', label: 'Basic science', note: `${count('basic')} terms` },
    ],
    initial: 'mixed',
  },
  {
    key: 'words',
    label: 'Words per team',
    choices: [
      { value: 5, label: '5' },
      { value: 10, label: '10' },
    ],
    initial: 5,
  },
  {
    key: 'rounds',
    label: 'Rounds',
    choices: [
      { value: 1, label: '1' },
      { value: 2, label: '2', note: 'roles swap' },
    ],
    initial: 1,
  },
];

/** Nova Password (medical Password) on Yazan's engine: 4 players, 2 teams of 2, one-word clues, fewest clues wins. */
export const novaPassword: GameDef = {
  key: 'nova-password',
  modes: [
    {
      mode: 'offline',
      title: 'Pass the phone',
      blurb: 'Two teams of two. One gives one-word clues, one guesses the medical term.',
      howTo: [
        'Exactly 4 players in 2 teams of 2. In each team one gives clues and the other guesses; roles swap in round 2.',
        'Teams take turns. The clue giver holds the phone and sees one secret term at a time, with words they must not say.',
        'Say one word per clue, out loud, and tap +1 each time. Wrong guesses are free; Skip sends the word to the back.',
        'Each team has 3 minutes for its list. Most words wins, then the fewest clues, then the least time.',
        'No EXP in this mode.',
      ],
    },
    {
      mode: 'online',
      title: 'Online',
      blurb: '4 players on their own phones. Both teams play at once on the same words.',
      howTo: [
        'Exactly 4 players. The host sets the two teams of two and who gives clues first; roles swap in round 2.',
        'Both teams play at the same time, on the same words in a different order. You only see how many words the other team has done.',
        'The clue giver types one-word clues. The app turns down part of the term, the same root, a crossed-out word or a repeat.',
        'The guesser types 3 letters and picks a term from the list. Wrong guesses are free. 3 minutes a round.',
        'Most words wins, then the fewest clues, then the least time. Win 60 EXP, draw 40, loss 20, at most 60 a match.',
      ],
    },
  ],
  setup: { offline: SETUP, online: SETUP },
  players: { offline: { min: 4, max: 4 }, online: { min: 4, max: 4 } },
  playersNote: () => 'You pick the teams and clue givers on the next page. Pass the phone earns no EXP.',
  Play: { offline: OfflinePlay },
  Online: OnlinePlay,
  // Pass the phone earns no EXP; Online gives win 60, draw 40, loss 20, nothing after a forfeit.
  exp: (_score, items) =>
    expOf(
      items
        .filter((x) => (x.gameData as { forfeit?: boolean } | null)?.forfeit !== undefined)
        .map((x) => ({ outcome: x.outcome === 'right' ? 'win' : x.outcome === 'skipped' ? 'draw' : 'loss', forfeit: !!(x.gameData as { forfeit?: boolean }).forfeit })),
    ),
  expCap: (_settings, mode) => (mode === 'online' ? 60 : 0),
  itemLabel: (item) => {
    const d = item.gameData as { team?: string; winner?: string };
    const team = d.team === 'A' ? 'Coral' : 'Mint';
    return `${team} team · ${d.winner === 'draw' ? 'draw' : d.team === d.winner ? 'won' : 'lost'}`;
  },
  itemNoun: 'match',
  itemsTitle: 'Matches',
};
