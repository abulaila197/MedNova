import type { GameDef } from '../shell/types';
import { MAX_CASE_POINTS } from './core';
import { caseById, guessById, guessName, LEVELS, levelCount } from './data';
import { OfflinePlay } from './OfflinePlay';
import { OnlinePlay } from './OnlinePlay';
import { SoloPlay } from './SoloPlay';

/** The Diagnostic Pursuit on the shared shell: Solo, Offline Multiplayer and Online (the online pilot). */
export const diagnosticPursuit: GameDef = {
  key: 'the-diagnostic-pursuit',
  modes: [
    {
      mode: 'solo',
      title: 'Just you and the cases',
      blurb: 'Clues arrive one by one. Name the disease with as few as you can.',
      howTo: [
        'Each case starts with one clue. Type a diagnosis and submit it.',
        'A wrong guess shows the next clue. A wrong guess when all six clues are showing ends the case.',
        'Reveal shows a clue for fewer points. Hint shows the medical field for 1 token.',
        'Fewer clues and a faster answer score more.',
      ],
    },
    {
      mode: 'offline',
      title: 'Pass and play',
      blurb: 'Take turns on one phone. Everyone gets their own case.',
      howTo: [
        'Add 2 to 6 players. Player 1 is you, the phone owner.',
        'Each round, every player gets their own case and 90 seconds.',
        'A wrong guess shows the next clue. Reveal shows one for fewer points. There is no hint.',
        'Pass the phone when the curtain shows the next name. Most points after the last round wins.',
        'You can split players into teams. Teams take turns one after another, and a team scores its players\' average.',
      ],
    },
    {
      mode: 'online',
      title: 'Race players live',
      blurb: 'A new clue every 10 seconds. First to the diagnosis scores most.',
      howTo: [
        'Join a room with a code or from the open list, or host your own. 2 to 6 players.',
        'Everyone gets the same case. A new clue appears every 10 seconds, and a case lasts 60 seconds.',
        'Guess as often as you like. A wrong guess locks you out for 5 seconds. There is no Skip, Reveal or Hint.',
        'Points: solving order (100, 80, 65, 50, 40, 30) + fewer clues (up to 50) + time left (up to 20).',
        'Most points after the last case wins. Your unsolved cases go to your Learn review.',
      ],
    },
  ],
  setup: {
    solo: [
      {
        key: 'difficulty',
        label: 'Difficulty',
        choices: LEVELS.map((d) => ({ value: d, label: d, note: `${levelCount(d)} cases` })),
        initial: 'Medium',
      },
      {
        key: 'cases',
        label: 'Cases',
        choices: [
          { value: 5, label: '5', note: 'about 5 min' },
          { value: 10, label: '10', note: 'about 10 min' },
        ],
        initial: 5,
      },
    ],
    offline: [
      {
        key: 'difficulty',
        label: 'Difficulty',
        choices: LEVELS.map((d) => ({ value: d, label: d, note: `${levelCount(d)} cases` })),
        initial: 'Medium',
      },
      {
        key: 'cases',
        label: 'Rounds',
        choices: [
          { value: 3, label: '3', note: 'quick' },
          { value: 5, label: '5' },
          { value: 10, label: '10', note: 'long' },
        ],
        initial: 3,
      },
    ],
    online: [
      {
        key: 'difficulty',
        label: 'Difficulty',
        choices: LEVELS.map((d) => ({ value: d, label: d })),
        initial: 'Medium',
      },
      {
        key: 'cases',
        label: 'Cases',
        choices: [
          { value: 3, label: '3' },
          { value: 5, label: '5' },
          { value: 10, label: '10' },
        ],
        initial: 5,
      },
    ],
  },
  teams: { offline: true, online: true },
  players: { offline: { min: 2, max: 6 } },
  Play: { solo: SoloPlay, offline: OfflinePlay },
  Online: OnlinePlay,
  // DP4: EXP = points ÷ 10; the cap is the most a game of this length can earn.
  exp: (score) => Math.floor(score / 10),
  // DPO6 (revised): Offline earns no EXP, like Medicordle; the owner's misses still feed Learn.
  // Online can make up to 170 a case (100 for 1st + 50 for one clue + 20 time, DPN3).
  expCap: (settings, mode) => (mode === 'offline' ? 0 : Math.floor((Number(settings.cases) || 5) * (mode === 'online' ? 170 : MAX_CASE_POINTS) / 10)),
  itemLabel: (item) => {
    const c = caseById.get(item.itemId);
    return (c && guessById.has(c.answer_id) ? guessName(c.answer_id) : c?.disease) ?? item.itemId;
  },
};
