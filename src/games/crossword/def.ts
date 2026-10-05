import type { GameDef } from '../shell/types';
import { CW } from './core';
import { PUZZLES, wordById } from './data';
import { OfflinePlay } from './OfflinePlay';
import { SoloPlay } from './SoloPlay';

/** Nova Crossword on the shared shell (CW1-CW9): Solo and Offline; Online comes with the shared online layer. */
export const novaCrossword: GameDef = {
  key: 'nova-crossword',
  modes: [
    {
      mode: 'solo',
      title: 'Puzzle by puzzle',
      blurb: `${PUZZLES.length} medical crosswords. One star opens the next.`,
      howTo: [
        'Tap part of the grid to zoom in, then tap a square to open its word. Tap the same square again to switch between across and down.',
        'Read the clue or the picture and type the answer. A full answer is checked straight away.',
        `You have ${CW.hearts} hearts per puzzle. A wrong answer costs one; trying the same wrong answer again costs nothing.`,
        'A hint costs 1 token and shows a third of the empty letters. Out of hearts, 1 token buys a heart, or replay.',
        `Stars count the words left: none left is 3 stars, one is 2, two is 1. Each new star earns ${CW.expPerStar} EXP.`,
      ],
    },
    {
      mode: 'offline',
      title: 'One grid, take turns',
      blurb: 'Pass the phone. Claim words to own their letters.',
      howTo: [
        'Add 2 to 6 players. Everyone plays the same grid, one word per turn, in a random order each lap.',
        'A right answer scores its length, plus any crossing word it completes. A wrong answer costs one of your 5 hearts.',
        'Closing a word ends your turn with no penalty. There are no hints and no EXP in this mode.',
        'At 0 hearts each player gets one revive, 1 token paid by the phone owner, or they are out.',
        'You can split players into teams. Teams take turns, and a team scores its players\' average.',
      ],
    },
    {
      mode: 'online',
      title: 'Race the same grid',
      blurb: 'Everyone plays the same grid live. First right answer claims the word.',
      howTo: ['Claim words before the others do.', 'Most letters owned wins.', 'One token revive per match.'],
      soon: true,
    },
  ],
  setup: { solo: [], offline: [] },
  players: { offline: { min: 2, max: 6 } },
  // TMG-CW: each player keeps their own hearts and words; a team scores its players' average.
  teams: { offline: true },
  teamScore: 'average',
  playersNote: () => 'Player 1 is you, the phone owner, and pays for revives. Offline earns no EXP.',
  Play: { solo: SoloPlay, offline: OfflinePlay },
  // CW9: Solo pays the EXP each puzzle earned this session (stored on its first word); Offline earns none.
  exp: (_score, items) => items.reduce((a, i) => a + (Number(i.gameData.exp) || 0), 0),
  expCap: (_settings, mode) => (mode === 'offline' ? 0 : PUZZLES.length * 3 * CW.expPerStar),
  itemLabel: (item) => wordById.get(item.itemId)?.answer ?? item.itemId,
  itemNoun: 'puzzle',
  itemsTitle: 'Words',
  summary: (play, items) => {
    if (play.mode === 'offline') {
      const mine = items.filter((i) => i.seat === 0 && i.outcome === 'right');
      return [
        { value: String(mine.reduce((a, i) => a + i.points, 0)), label: 'Your points' },
        { value: String(mine.length), label: 'Words you claimed' },
      ];
    }
    return [
      { value: `${items.filter((i) => i.outcome === 'right').length}/${items.length}`, label: 'Words solved' },
      { value: String(items.reduce((a, i) => a + (Number(i.gameData.stars) || 0), 0)), label: 'Stars' },
    ];
  },
};
