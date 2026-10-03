import type { GameDef } from '../shell/types';
import { offlineRows } from './core';
import { wordById } from './data';
import { OfflinePlay } from './OfflinePlay';
import { SoloPlay } from './SoloPlay';

const STYLE = {
  key: 'style',
  label: 'Style',
  choices: [
    { value: 'classic', label: 'Classic', note: '6 letters' },
    { value: 'custom', label: 'Custom', note: '7 to 15 letters' },
  ],
  initial: 'classic',
};

/** Nova Medicordle on the shared shell (NM1-NM25): Solo and Offline Multiplayer; Online comes with the shared online layer. */
export const novaMedicordle: GameDef = {
  key: 'nova-medicordle',
  modes: [
    {
      mode: 'solo',
      title: 'One word, six tries',
      blurb: "Today's word for everyone, or keep going with endless words.",
      howTo: [
        'Guess the hidden medical word in six tries. Every guess must be a real word.',
        'Green is the right letter in the right place, yellow is in the word but elsewhere, grey is not in the word.',
        'Classic words have 6 letters. Custom words have 7 to 15, and a guess can be shorter than the word.',
        'The definition appears on your last guess. Custom words also have up to two letter hints, 1 token then 2.',
        'Fewer guesses earn more EXP. The daily word earns double and keeps your streak going.',
      ],
    },
    {
      mode: 'offline',
      title: 'One board, take turns',
      blurb: 'Pass the phone. Whoever guesses the word wins it.',
      howTo: [
        'Add 2 to 6 players. Everyone guesses on the same board, one guess per turn.',
        'Each lap goes round every player in a random order, and nobody plays twice in a row.',
        'Rows round up so everyone gets the same number of guesses. A turn that runs out of time passes.',
        'Whoever guesses the word wins it. Most words wins. There are no hints and no EXP in this mode.',
      ],
    },
    {
      mode: 'online',
      title: 'Same word, race live',
      blurb: 'Everyone plays the same word on their own board.',
      howTo: ['Solve faster and in fewer guesses to score more.', 'You see when someone solves it, or gets close.', 'No hints online.'],
      soon: true,
    },
  ],
  setup: {
    solo: [
      {
        key: 'word',
        label: 'Word',
        choices: [
          { value: 'daily', label: 'Daily', note: 'one a day, double EXP' },
          { value: 'endless', label: 'Endless', note: 'word after word' },
        ],
        initial: 'daily',
      },
      STYLE,
    ],
    offline: [
      STYLE,
      {
        key: 'words',
        label: 'Words',
        choices: [
          { value: 3, label: '3', note: 'quick' },
          { value: 5, label: '5' },
          { value: 10, label: '10', note: 'long' },
        ],
        initial: 3,
      },
      {
        key: 'turn',
        label: 'Time per guess',
        choices: [
          { value: 10, label: '10 s' },
          { value: 20, label: '20 s' },
          { value: 30, label: '30 s' },
        ],
        initial: 20,
      },
    ],
  },
  players: { offline: { min: 2, max: 6 } },
  playersNote: (n) => `Player 1 is you, the phone owner. With ${n} players the board has ${offlineRows(n)} rows, ${offlineRows(n) / n} guesses each.`,
  Play: { solo: SoloPlay, offline: OfflinePlay },
  // NM22: Solo EXP per word is stored on each item; NM25: Offline earns none.
  exp: (_score, items) => items.reduce((a, i) => a + (Number(i.gameData.exp) || 0), 0),
  expCap: (settings) => (settings.word === 'daily' ? 24 : settings.word === 'endless' ? 12 * 150 : 0),
  itemLabel: (item) => wordById.get(item.itemId)?.word ?? item.itemId,
  itemNoun: 'word',
  itemsTitle: 'Words',
  summary: (play, items) =>
    play.mode === 'offline'
      ? [
          { value: String(items.filter((i) => i.seat === 0).length), label: 'Words you won' },
          { value: `${items.filter((i) => i.outcome === 'right').length}/${items.length}`, label: 'Guessed' },
        ]
      : null,
};
