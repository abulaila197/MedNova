import type { GameDef } from '../shell/types';
import { CW } from './core';
import { PUZZLES, wordById } from './data';
import { BotsPlay } from './BotsPlay';
import { OfflinePlay } from './OfflinePlay';
import { SoloPlay } from './SoloPlay';

/** Online puzzles in a row (1-3; an older room has none and plays one). */
const cases = (settings: Record<string, unknown>) => Math.min(3, Math.max(1, Number(settings.count) || 1));

/** Nova Crossword on the shared shell (CW1-CW12): Solo, Offline and Online Multiplayer. */
export const novaCrossword: GameDef = {
  key: 'nova-crossword',
  modes: [
    {
      mode: 'solo',
      title: 'Puzzle by puzzle',
      blurb: `${PUZZLES.length} medical crosswords. One star opens the next.`,
      howTo: [
        'Tap a square to light up its word, and tap it again for the word going the other way. Double tap to open the lit word.',
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
        `A right answer scores its length, plus any crossing word it completes. A wrong answer costs one of your ${CW.hearts} hearts.`,
        'Closing a word ends your turn with no penalty. There are no hints and no EXP in this mode.',
        'At 0 hearts each player gets one revive, 1 token paid by the phone owner, or they are out.',
        'You can split players into teams. Teams take turns, and a team scores its players\' average.',
      ],
    },
    {
      mode: 'bots',
      title: 'Grid showdown',
      blurb: 'The same grid as the rivals. First right answer claims the word.',
      howTo: [
        'Pick Freshmen, Scholars or Geniuses and 1 to 3 rivals. Meet them in the room: tap a rival for its profile, swap it or kick it.',
        'Everyone plays the same grid. The first right answer claims the word and its letters. A rival never takes the word you are typing.',
        `Pick 1, 2 or 3 puzzles. They come one after another, each with the full time limit, ${CW.onlineHearts} fresh hearts and its own revive.`,
        `A wrong answer costs one of your ${CW.onlineHearts} hearts; trying the same wrong answer again costs nothing. No hints.`,
        'The race ends when every word is claimed, everyone is out, or time runs out. Most letters owned wins.',
        `EXP by place on each puzzle: 1st earns 3 stars, 2nd 2, everyone else who claimed a word 1. Each star is ${CW.expPerStar} EXP.`,
      ],
    },
  ],
  setup: {
    solo: [],
    offline: [],
    // CW11: the host's time limit, per puzzle; 1 to 3 puzzles back to back, points add up (Yazan, 2026-10-25).
    bots: [
      {
        key: 'count',
        label: 'Puzzles',
        choices: [
          { value: 1, label: '1 puzzle' },
          { value: 2, label: '2 puzzles' },
          { value: 3, label: '3 puzzles' },
        ],
        initial: 1,
      },
      {
        key: 'timelimit',
        label: 'Time limit',
        choices: [
          { value: 5, label: '5 min', note: 'quick' },
          { value: 10, label: '10 min' },
          { value: 15, label: '15 min', note: 'long' },
        ],
        initial: 10,
      },
    ],
  },
  players: { offline: { min: 2, max: 6 } },
  // TMG-CW: each player keeps their own hearts and words; a team scores its players' average.
  bots: { min: 1, max: 3 },
  teams: { offline: true, bots: true },
  teamScore: 'average',
  playersNote: () => 'Player 1 is you, the phone owner, and pays for revives. Pass the phone earns no EXP.',
  Play: { solo: SoloPlay, offline: OfflinePlay, bots: BotsPlay },
  // CW9: Solo pays the EXP each puzzle earned this session (stored on its first word); Offline earns none; CW12: Online up to 3 stars.
  exp: (_score, items) => items.reduce((a, i) => a + (Number(i.gameData.exp) || 0), 0),
  expCap: (settings, mode) => (mode === 'offline' ? 0 : mode === 'bots' ? cases(settings) * 3 * CW.expPerStar : PUZZLES.length * 3 * CW.expPerStar),
  itemLabel: (item) => wordById.get(item.itemId)?.answer ?? item.itemId,
  itemNoun: 'puzzle',
  itemsTitle: 'Words',
  summary: (play, items) => {
    if (play.mode === 'offline' || play.mode === 'bots') {
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
