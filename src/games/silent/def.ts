import type { GameDef } from '../shell/types';
import { SA } from './core';
import { isBasic, MIXES, PICKABLE, wordById, wordName } from './data';
import { OfflinePlay } from './OfflinePlay';
import { SoloPlay } from './SoloPlay';
import { tr } from '@/i18n';

const TURN = {
  key: 'turn',
  label: tr('Time per turn'),
  choices: SA.turnChoices.map((v) => ({ value: v, label: `${v} s` })),
  initial: 90,
};

// QS1: Mixed (default), Clinical or Basic science words.
const MIX = {
  key: 'mix',
  label: tr('Words'),
  choices: MIXES.map((m) => ({ ...m, note: tr('{n} words', { n: m.value === 'mixed' ? PICKABLE.length : PICKABLE.filter((w) => isBasic(w) === (m.value === 'basic')).length }) })),
  initial: 'mixed',
};

const PERFORMS = {
  key: 'performs',
  label: tr('Turns each'),
  choices: [
    { value: 1, label: '1', note: 'quick' },
    { value: 2, label: '2' },
    { value: 3, label: '3', note: 'long' },
  ],
  initial: 1,
};

/** The Silent Artist on the shared shell (SA1-SA12, TMG-SA): Solo practice, Offline and Online Multiplayer. */
export const silentArtist: GameDef = {
  key: 'the-silent-artist',
  modes: [
    {
      mode: 'solo',
      title: tr('Practice sketch'),
      blurb: tr('Draw {n} diseases and basic science words alone against the clock. No score.', { n: PICKABLE.length }),
      howTo: [
        tr('Pick the fields you want, or keep them all.'),
        tr('You see a word and have 60 s to draw it on the slate, or pick No clock and tap Done when you finish.'),
        tr('Then Next gives you a new word, and Retry the same one on a clean board.'),
        tr('It is practice only: no score, no EXP, nothing goes to Learn. Your words are listed at the end with their dossiers.'),
      ],
    },
    {
      mode: 'offline',
      title: tr('Pass the phone'),
      blurb: tr('One draws or acts a secret word, the room shouts guesses.'),
      howTo: [
        tr('Add 2 to 6 players, or split them into teams. Pick the words, the time per turn and how many turns each.'),
        tr('The performer holds to see 3 secret words, picks one in 10 s, and chooses to draw it or act it out.'),
        tr('The room guesses out loud while the phone shows hints: word count, then the field, then letters.'),
        tr('Got it? The performer names who guessed. Faster guesses score more, and the performer gets half.'),
        tr('With teams, the performing team scores. On time up the next team gets one 15 s steal worth 10.'),
      ],
    },
  ],
  // QS1 + SA5 + SA12: the host picks the words, the turn time and 1, 2 or 3 draws each.
  setup: { solo: [], offline: [MIX, TURN, PERFORMS] },
  players: { offline: { min: 2, max: 6 } },
  teams: { offline: true },
  playersNote: () => tr('Player 1 is you, the phone owner. Sketch It earns no EXP and sends nothing to Learn.'),
  Play: { solo: SoloPlay, offline: OfflinePlay },
  // SA1: nothing to Learn in any mode. Online pays 1 EXP per 10 points, up to 60 (Yazan 2026-10-27); Solo and
  // Pass the phone stay EXP-free.
  exp: (score) => Math.min(60, Math.max(0, Math.floor(score / 10))),
  expCap: (_settings, mode) => (mode === 'online' ? 60 : 0),
  itemLabel: (item) => {
    const w = wordById.get(item.itemId);
    return w ? wordName(w) : item.itemId;
  },
  itemNoun: 'word',
  // SA2: Solo is practice only, so its list has no right/wrong marks or points.
  plainItems: (play) => play.mode === 'solo',
  itemsTitle: tr('Words'),
  summary: (play, items) => {
    if (play.mode === 'online') {
      const guessed = items.filter((i) => i.gameData.kind === 'guessed');
      return [
        { value: String(items.reduce((a, i) => a + i.points, 0)), label: tr('Your points') },
        { value: `${guessed.filter((i) => i.outcome === 'right').length}/${guessed.length}`, label: tr('You guessed') },
      ];
    }
    if (play.mode === 'offline') {
      const got = items.filter((i) => i.outcome === 'right').length;
      return [
        { value: String(items.length), label: tr('Turns') },
        { value: `${got}/${items.length}`, label: tr('Guessed') },
      ];
    }
    return [{ value: String(items.length), label: tr('Drawn') }];
  },
};
