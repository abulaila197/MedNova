import type { GameDef } from '../shell/types';
import { SA } from './core';
import { WORDS, wordById, wordName } from './data';
import { OfflinePlay } from './OfflinePlay';
import { SoloPlay } from './SoloPlay';

const TURN = {
  key: 'turn',
  label: 'Time per turn',
  choices: SA.turnChoices.map((v) => ({ value: v, label: `${v} s` })),
  initial: 90,
};

const PERFORMS = {
  key: 'performs',
  label: 'Turns each',
  choices: [
    { value: 1, label: '1', note: 'quick' },
    { value: 2, label: '2' },
    { value: 3, label: '3', note: 'long' },
  ],
  initial: 1,
};

/** The Silent Artist on the shared shell (SA1-SA9, TMG-SA): Solo practice and Offline; Online waits for the shared online layer. */
export const silentArtist: GameDef = {
  key: 'the-silent-artist',
  modes: [
    {
      mode: 'solo',
      title: 'Practice sketch',
      blurb: `Draw ${WORDS.length} diseases alone against the clock. No score.`,
      howTo: [
        'Pick the fields you want, or keep them all.',
        'You see a disease and have 60 s to draw it on the slate.',
        'Then Next gives you a new disease, and Retry the same one on a clean board.',
        'It is practice only: no score, no EXP, nothing goes to Learn. Your diseases are listed at the end with their dossiers.',
      ],
    },
    {
      mode: 'offline',
      title: 'Pass the phone',
      blurb: 'One draws or acts a secret disease, the room shouts guesses.',
      howTo: [
        'Add 2 to 6 players, or split them into teams. Pick the time per turn and how many turns each.',
        'The performer holds to see 3 secret diseases, picks one in 10 s, and chooses to draw it or act it out.',
        'The room guesses out loud while the phone shows hints: word count, then the field, then letters.',
        'Got it? The performer names who guessed. Faster guesses score more, and the performer gets half.',
        'With teams, the performing team scores. On time up the next team gets one 15 s steal worth 10.',
      ],
    },
    {
      mode: 'online',
      title: 'Draw for the room',
      blurb: 'One draws, everyone types guesses live.',
      howTo: ['One player draws, everyone else types guesses.', 'Faster guesses score more.'],
      soon: true,
    },
  ],
  setup: { solo: [], offline: [TURN, PERFORMS] },
  players: { offline: { min: 2, max: 6 } },
  teams: { offline: true },
  playersNote: () => 'Player 1 is you, the phone owner. The Silent Artist earns no EXP and sends nothing to Learn.',
  Play: { solo: SoloPlay, offline: OfflinePlay },
  // SA1: no EXP and nothing to Learn in any mode.
  exp: () => 0,
  expCap: () => 0,
  itemLabel: (item) => {
    const w = wordById.get(item.itemId);
    return w ? wordName(w) : item.itemId;
  },
  itemNoun: 'disease',
  // SA2: Solo is practice only, so its list has no right/wrong marks or points.
  plainItems: (play) => play.mode === 'solo',
  itemsTitle: 'Diseases',
  summary: (play, items) => {
    if (play.mode === 'offline') {
      const got = items.filter((i) => i.outcome === 'right').length;
      return [
        { value: String(items.length), label: 'Turns' },
        { value: `${got}/${items.length}`, label: 'Guessed' },
      ];
    }
    return [{ value: String(items.length), label: 'Drawn' }];
  },
};
