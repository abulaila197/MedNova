import type { GameDef } from '../shell/types';
import { offlineRows } from './core';
import { wordById } from './data';
import { BotsPlay } from './BotsPlay';
import { OfflinePlay } from './OfflinePlay';
import { SoloPlay } from './SoloPlay';
import { tr } from '@/i18n';

const STYLE = {
  key: 'style',
  label: tr('Style'),
  choices: [
    { value: 'classic', label: tr('Classic'), note: tr('6 letters') },
    { value: 'five', label: tr('Classic 5'), note: tr('5 letters') },
    { value: 'custom', label: tr('Custom'), note: tr('7 to 15 letters') },
  ],
  initial: 'classic',
};

/** How a word is played (Yazan 2026-11-18): guessed in six tries, or repaired from its scrambled letters. */
const WAY = {
  key: 'way',
  label: tr('Play style'),
  choices: [
    { value: 'tries', label: tr('Guess It'), note: tr('guess real words') },
    { value: 'surgeon', label: tr('Word Surgeon'), note: tr('fix the scrambled word') },
  ],
  initial: 'tries',
};

/** What the words ask about (Yazan 2026-11-17): every word is tagged clinical or basic science. */
const KNOW = {
  key: 'know',
  label: tr('Knowledge'),
  choices: [
    { value: 'clinical', label: tr('Clinical years|setup'), note: tr('diseases and care') },
    { value: 'basic', label: tr('Preclinical years'), note: tr('body, cells, lab') },
    { value: 'mixed', label: tr('All years'), note: tr('both') },
  ],
  initial: 'mixed',
};

/** Nova Medicordle on the shared shell (NM1-NM25): Solo, Offline and Online Multiplayer. */
export const novaMedicordle: GameDef = {
  key: 'nova-medicordle',
  modes: [
    {
      mode: 'solo',
      title: tr('One word, six tries'),
      blurb: tr('Word after word, as long as you like.'),
      howTo: [
        tr('Guess the hidden medical word in six tries. Every guess must be a real word.'),
        tr('Word Surgeon: the word\'s own letters come scrambled. Fill every slot and tap Check: a try is only right or wrong, then every letter goes back for the next try. Six tries.'),
        tr('Green is the right letter in the right place, yellow is in the word but elsewhere, grey is not in the word.'),
        tr('Classic words have 6 letters, or 5 in Classic 5. Custom words have 7 to 15, and a guess can be shorter than the word.'),
        tr('The definition appears on your last guess. Helpers above the keyboard give a letter (1 token, then 2), clear 3 wrong letters (1) or show the definition early (1).'),
        tr('Fewer guesses earn more EXP. Each word costs 10 Sparks, paid as it ends.'),
      ],
    },
    {
      mode: 'offline',
      title: tr('One board, take turns'),
      blurb: tr('Pass the phone. Whoever guesses the word wins it.'),
      howTo: [
        tr('Add 2 to 6 players. Everyone guesses on the same board, one guess per turn.'),
        tr('Word Surgeon: the word\'s own letters come scrambled. Fill every slot and tap Check: a try is only right or wrong, then every letter goes back for the next try. Six tries.'),
        tr('Each lap goes round every player in a random order, and nobody plays twice in a row.'),
        tr('Rows round up so everyone gets the same number of guesses. A turn that runs out of time passes.'),
        tr('Whoever guesses the word wins it. Most words wins. There are no hints and no EXP in this mode.'),
        tr('You can split players into teams. Teams take turns one after another, and the guesser\'s whole team wins the word.'),
      ],
    },
    {
      mode: 'bots',
      title: tr('Word duel'),
      blurb: tr('The same word as the rivals, each on your own board.'),
      howTo: [
        tr('Pick Freshmen, Scholars, Geniuses or Random and 1 to 3 rivals. Meet them in the room: tap a rival for its profile, swap it or kick it.'),
        tr('Everyone gets the same word at the same time, six tries each. The rivals\' small boards fill with colours as they guess, never letters.'),
        tr('Word Surgeon: the word\'s own letters come scrambled. Fill every slot and tap Check: a try is only right or wrong, then every letter goes back for the next try. Six tries.'),
        tr('First solver scores 100, then 80, 65 and so on, plus 10 for each guess left.'),
        tr('Helpers above the keyboard give a letter (1 token, then 2), clear 3 wrong letters (1) or show the definition early (1). The definition also appears free in the last 20 seconds.'),
        tr('EXP works like Solo: 12 for a first-guess solve, down to 2 on the sixth.'),
      ],
    },
  ],
  setup: {
    solo: [
      // Endless words only (Yazan 2026-11-24: the Daily word is gone).
      WAY,
      STYLE,
      KNOW,
    ],
    offline: [
      WAY,
      STYLE,
      KNOW,
      {
        key: 'words',
        label: tr('Words'),
        choices: [
          { value: 3, label: '3', note: 'quick' },
          { value: 5, label: '5', note: 'long' },
        ],
        initial: 3,
      },
      {
        key: 'turn',
        label: tr('Time per guess'),
        choices: [
          { value: 10, label: '10 s' },
          { value: 20, label: '20 s' },
          { value: 30, label: '30 s' },
        ],
        initial: 20,
      },
    ],
    // NM15: style, 3, 5 or 10 words, and 60, 90 or 120 s per word.
    bots: [
      WAY,
      STYLE,
      KNOW,
      {
        key: 'words',
        label: tr('Words'),
        choices: [
          { value: 3, label: '3', note: 'quick' },
          { value: 5, label: '5', note: 'long' },
        ],
        initial: 5,
      },
      {
        key: 'wordtime',
        label: tr('Time per word'),
        choices: [
          { value: 60, label: '60 s' },
          { value: 90, label: '90 s' },
          { value: 120, label: '120 s' },
        ],
        initial: 90,
      },
    ],
  },
  players: { offline: { min: 2, max: 6 } },
  // TMG-NM: offline, the guesser's whole team wins the word, so a team scores its words; NM27: online is the average.
  bots: { min: 1, max: 3 },
  teams: { offline: true, bots: true },
  teamScore: { offline: 'sum', bots: 'average' },
  playersNote: (n) => tr('Player 1 is you, the phone owner. With {n} players the board has {n2} rows, {n3} guesses each.', { n, n2: offlineRows(n), n3: offlineRows(n) / n }),
  Play: { solo: SoloPlay, offline: OfflinePlay, bots: BotsPlay },
  // NM22: Solo EXP per word is stored on each item; NM25: Offline earns none.
  exp: (_score, items) => items.reduce((a, i) => a + (Number(i.gameData.exp) || 0), 0),
  expCap: (settings, mode) => (mode === 'bots' ? 12 * (Number(settings.words) || 5) : mode === 'solo' ? 12 * 150 : 0),
  itemLabel: (item) => wordById.get(item.itemId)?.word ?? item.itemId,
  itemNoun: 'word',
  itemsTitle: tr('Words'),
  summary: (play, items) =>
    play.mode === 'offline'
      ? [
          { value: String(items.filter((i) => i.seat === 0).length), label: tr('Words you won') },
          { value: `${items.filter((i) => i.outcome === 'right').length}/${items.length}`, label: tr('Guessed') },
        ]
      : null,
};
