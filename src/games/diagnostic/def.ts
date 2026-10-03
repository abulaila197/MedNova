import type { GameDef } from '../shell/types';
import { MAX_CASE_POINTS } from './core';
import { caseById, guessById, LEVELS, levelCount } from './data';
import { SoloPlay } from './SoloPlay';

/** The Diagnostic Pursuit on the shared shell. Solo first; the multiplayer modes follow. */
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
      blurb: 'Take turns on one phone. Everyone gets the same case.',
      howTo: ['Each player gets 90 seconds on the case.', 'A wrong guess shows the next clue.', 'Fewer clues used means more points.'],
      soon: true,
    },
    {
      mode: 'online',
      title: 'Race players live',
      blurb: 'A new clue every 10 seconds. First to the diagnosis scores most.',
      howTo: ['Everyone sees the same clues at the same time.', 'A wrong guess locks you out for 5 seconds.', 'Faster solves rank higher.'],
      soon: true,
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
  },
  Play: { solo: SoloPlay },
  // DP4: EXP = points ÷ 10; the cap is the most a game of this length can earn.
  exp: (score) => Math.floor(score / 10),
  expCap: (settings) => Math.floor((Number(settings.cases) || 5) * MAX_CASE_POINTS / 10),
  itemLabel: (item) => {
    const c = caseById.get(item.itemId);
    return (c && guessById.get(c.answer_id)?.label) ?? c?.disease ?? item.itemId;
  },
};
